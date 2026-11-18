#!/usr/bin/env node
// Extrait les glyphes SVG utilisés par le template depuis la police
// FontAwesome Free (SIL OFL 1.1) de la source 2097_pop, et écrit `src/icons.js`.
// Pourquoi : le template embarque les icônes en `<path>` inline (zéro police,
// zéro requête, bundle léger) tout en gardant les glyphes d'origine du design.
//
// Usage : node tools/extract-icons.mjs
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "..", "2097_pop", "fontawesome", "webfonts", "fa-solid-900.svg");

/** Code Unicode FontAwesome → nom de sortie. */
const WANTED = {
  f015: "home",
  f0c0: "users",
  f2b5: "handshake",
  f075: "comments",
  f00d: "close",
  f1d8: "send",
  f03e: "image",
  f1ce: "spinner",
  f00c: "check",
  f053: "chevronLeft",
  f054: "chevronRight",
  f0c6: "paperclip",
  f1f8: "trash",
  f017: "clock",
  f05a: "infoCircle",
  f063: "arrowDown",
  f005: "star",
  f02d: "book",
  f0c1: "link",
  f15b: "file",
  f007: "user",
  f118: "smile",
  f119: "frown",
  f11a: "meh",
  f10d: "quoteLeft",
  f121: "code",
  f03a: "list",
  f058: "checkCircle",
  f06a: "exclamationCircle",
  f002: "search",
  f067: "plus",
  f078: "chevronDown",
  f141: "ellipsis",
  f0e0: "envelope",
  f095: "phone",
  f0ac: "globe",
  f133: "calendar",
  f019: "download",
  f35d: "externalLink",
  f2ed: "trashAlt",
  f01e: "redo",
  f06e: "eye",
  f070: "eyeSlash",
};

/**
 * Bbox approchée d'un chemin SVG (toutes commandes, absolues/relatives).
 * Les points de contrôle des courbes sont inclus : le cadre est donc légèrement
 * plus grand que la forme (marge symétrique invisible).
 *
 * Les glyphes issus d'une police SVG sont en repère **y montant** (origine au
 * bas de la ligne de base) alors que SVG dessine en y descendant : on renvoie le
 * viewBox compensé `[minX, -maxY, w, h]` pour un rendu avec `scale(1, -1)`.
 * @returns {[number, number, number, number]} `[x, y, w, h]` arrondi à l'extérieur.
 */
function pathBox(d) {
  const tokens = d.match(/-?\d*\.?\d+(?:[eE][-+]?\d+)?|[a-zA-Z]/g) ?? [];
  let i = 0;
  let cmd = "";
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const num = () => parseFloat(tokens[i++]);
  const point = (px, py) => {
    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px);
    maxY = Math.max(maxY, py);
  };
  const at = () => (cmd === cmd.toLowerCase() ? [x, y] : [0, 0]);

  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) {
      cmd = tokens[i];
      i += 1;
      if (cmd.toUpperCase() === "Z") {
        x = sx;
        y = sy;
        continue;
      }
    } else if (cmd === "") {
      i += 1;
      continue;
    }
    const [ox, oy] = at();
    switch (cmd.toUpperCase()) {
      case "M":
      case "L": {
        x = num() + ox;
        y = num() + oy;
        if (cmd.toUpperCase() === "M") {
          sx = x;
          sy = y;
        }
        point(x, y);
        break;
      }
      case "H": {
        x = num() + ox;
        point(x, y);
        break;
      }
      case "V": {
        y = num() + oy;
        point(x, y);
        break;
      }
      case "C": {
        point(num() + ox, num() + oy);
        point(num() + ox, num() + oy);
        x = num() + ox;
        y = num() + oy;
        point(x, y);
        break;
      }
      case "S":
      case "Q": {
        point(num() + ox, num() + oy);
        x = num() + ox;
        y = num() + oy;
        point(x, y);
        break;
      }
      case "T": {
        x = num() + ox;
        y = num() + oy;
        point(x, y);
        break;
      }
      case "A": {
        num(); // rx
        num(); // ry
        num(); // rotation
        num(); // large-arc
        num(); // sweep
        x = num() + ox;
        y = num() + oy;
        point(x, y);
        break;
      }
      default:
        i += 1;
        break;
    }
  }
  const x0 = Math.floor(minX);
  const y0 = Math.floor(minY);
  const x1 = Math.ceil(maxX);
  const y1 = Math.ceil(maxY);
  return [x0, -y1, x1 - x0, y1 - y0];
}

const xml = await readFile(source, "utf8");
const icons = {};
for (const match of xml.matchAll(/<glyph\b([^>]*)\/>/g)) {
  const attrs = match[1];
  const unicode = /unicode="&#x([0-9a-fA-F]+);"/.exec(attrs)?.[1]?.toLowerCase();
  const name = WANTED[unicode];
  if (!name) continue;
  const d = /\bd="([^"]+)"/.exec(attrs)?.[1];
  if (d) icons[name] = { d: d.trim(), box: pathBox(d) };
}
const missing = Object.values(WANTED).filter((name) => !(name in icons));
if (missing.length) {
  console.error(`Glyphes introuvables : ${missing.join(", ")}`);
  process.exit(1);
}

const out = join(root, "src", "icons.js");
const body = `// Généré par \`tools/extract-icons.mjs\` — glyphes FontAwesome Free 6
// (SIL Open Font License 1.1), extraits du template source 2097_pop.
// \`d\` = chemin du glyphe (repère y montant, unités de police) ; \`box\` = viewBox
// compensé [x, -maxY, w, h]. Rendu : <path d={d} transform="scale(1,-1)" />,
// aucun attr/asset supplémentaire : ni police, ni requête.
export const ICONS = ${JSON.stringify(icons, null, 2)};
`;
await writeFile(out, body, "utf8");
console.log(`✓ ${Object.keys(icons).length} glyphes → src/icons.js`);
