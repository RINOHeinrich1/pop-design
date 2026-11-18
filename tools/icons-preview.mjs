// Outil de contrôle visuel : rend les glyphes extraits dans une page HTML
// (sert à vérifier orientation/bbox via screenshot Chrome headless).
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ICONS } from "../src/icons.js";

const cells = Object.entries(ICONS)
  .map(
    ([name, icon]) =>
      `<figure><svg viewBox="${icon.box.join(" ")}" width="96" height="96" fill="#fff"><path d="${icon.d}"/></svg><figcaption>${name}</figcaption></figure>`,
  )
  .join("");

const html = `<!doctype html><meta charset="utf-8"><style>body{background:#2c2a35;color:#fff;font:14px sans-serif;display:flex;flex-wrap:wrap;gap:16px;margin:20px}figure{margin:0;text-align:center;background:#00659933;padding:12px}figcaption{margin-top:8px}</style>${cells}`;
const out = join(tmpdir(), "opencode", "icons.html");
mkdirSync(join(tmpdir(), "opencode"), { recursive: true });
writeFileSync(out, html, "utf8");
console.log(out);
