// Contrôle visuel EN TEXTE des glyphes : rend chaque icône (viewBox compensé +
// `scale(1,-1)`) en art ASCII dans une page, Chrome headless --dump-dom le
// renvoie. Sert à vérifier orientation et cadrage sans ouvrir d'image.
// Usage : node tools/icons-ascii.mjs  (nécessite Chrome installé)
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ICONS } from "../src/icons.js";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const dir = join(tmpdir(), "opencode");
mkdirSync(dir, { recursive: true });
const page = join(dir, "icons-ascii.html");

const script = `
const ctx2 = document.createElement("canvas").getContext("2d");
const ICONS = ${JSON.stringify(ICONS)};
const COLS = 60;
let out = "";
for (const [name, icon] of Object.entries(ICONS)) {
  const [vx, vy, vw, vh] = icon.box;
  const path = new Path2D(icon.d);
  const cellW = vw / COLS;
  const rows = Math.max(8, Math.round(vh / (cellW * 2.1)));
  out += name + " [" + icon.box.join(",") + "]\\n";
  for (let j = 0; j < rows; j++) {
    let line = "";
    for (let i = 0; i < COLS; i++) {
      const x = vx + (i + 0.5) * cellW;
      const y = vy + ((j + 0.5) / rows) * vh;
      line += ctx2.isPointInPath(path, x, -y) ? "#" : ".";
    }
    out += line + "\\n";
  }
  out += "\\n";
}
document.getElementById("out").textContent = out;
`;
writeFileSync(
  page,
  `<!doctype html><meta charset="utf-8"><body><pre id="out"></pre><script>${script}</script>`,
  "utf8",
);

const dom = execFileSync(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--virtual-time-budget=2000",
    "--dump-dom",
    `file:///${page.replace(/\\/g, "/")}`,
  ],
  { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
);
const match = /<pre id="out">([\s\S]*?)<\/pre>/.exec(dom);
if (!match) {
  console.error("aucune sortie");
  process.exit(1);
}
console.log(
  match[1]
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">"),
);
