#!/usr/bin/env node
// Complète l'intégrité SRI du widget dans `onirtech.template.json`.
// Le plugin `@onirtech/template-sdk/vite` ne signe que l'entrée principale
// (`ui.integrity`) ; `ui.widget.integrity` doit être calculé après le build
// du widget, sinon le dashboard rejette l'import.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const dir = process.cwd();
const manifestPath = join(dir, "onirtech.template.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const widget = manifest.ui?.widget;

if (!widget?.entry) {
  console.log("[widget-integrity] Aucun widget déclaré : rien à faire.");
  process.exit(0);
}

const entry = widget.entry.replace(/^\.\//, "");
const buffer = await readFile(join(dir, entry));
widget.integrity = `sha256-${createHash("sha256").update(buffer).digest("base64")}`;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`✓ Intégrité widget ${entry} : ${widget.integrity}`);
