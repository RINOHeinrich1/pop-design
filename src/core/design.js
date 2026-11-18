// Système de design générique (OOP) : presets, tokens et résolveurs de thème.
// Les palettes/typographies/densités/arrondis sont des configurations
// enregistrables (registre), pas des tables statiques figées.

import { Registry } from "./registry.js";
import { DEFAULTS, isCustomized, paramValue, parseJsonParam } from "./params.js";

function luminance(color) {
  if (typeof color !== "string") return null;
  let hex = color.trim();
  if (/^#[0-9a-f]{3}$/i.test(hex)) hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const channels = [1, 3, 5].map((index) => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastInk(color) {
  const value = luminance(color);
  if (value === null) return "#ffffff";
  return value > 0.46 ? "#10151c" : "#ffffff";
}

const LENGTH_KEYS = new Set(["rayon", "rayon_bulle", "espacement", "largeur", "tuile", "opacite_image", "ligne"]);
const DESIGN_KEYS = {
  accent: "--pop-accent", surface: "--pop-surface", surface_alt: "--pop-surface-2", surface_soft: "--pop-surface-3",
  texte: "--pop-text", texte_attenue: "--pop-muted", bordure: "--pop-border", overlay: "--pop-overlay",
  entree: "--pop-input-bg", entree_focus: "--pop-input-bg-focus", rayon: "--pop-radius", rayon_bulle: "--pop-bubble-radius",
  espacement: "--pop-gap", police: "--pop-font", police_titre: "--pop-font-heading", police_code: "--pop-font-mono",
  largeur: "--pop-max-width", tuile: "--pop-tile-size", ombre: "--pop-shadow", opacite_image: "--pop-image-opacity",
  alignement_entete: "--pop-header-align", hauteur_fil: "--pop-chat-max", ligne: "--pop-line-height",
};

function safeCssValue(value, key) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return LENGTH_KEYS.has(key) && !["opacite_image", "ligne"].includes(key) ? `${value}px` : String(value);
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.length > 180) return null;
  if (/[;{}<>\n\r]/.test(trimmed)) return null;
  if (key === "opacite_image" || key === "ligne") {
    const number = Number(trimmed);
    return Number.isFinite(number) ? trimmed : null;
  }
  if (LENGTH_KEYS.has(key) && /^-?\d+(?:\.\d+)?$/.test(trimmed)) return `${trimmed}px`;
  return trimmed;
}

export class DesignSystem {
  constructor() {
    this.ambiances = new Registry("ambiances", [
      ["pop", { accent: "#006599", surface: "#2c2a35", surfaceAlt: "#353541", surfaceSoft: "#232129", text: "#ffffff", muted: "#cbc9d1", border: "rgba(255, 255, 255, 0.34)", overlay: "rgba(8, 7, 12, 0.62)", input: "#353541", inputFocus: "#4d4c59", pageOverlay: "linear-gradient(180deg, rgba(0, 0, 0, 0.28) 0%, rgba(0, 0, 0, 0.5) 62%, rgba(0, 0, 0, 0.64) 100%)", shadow: "0 24px 60px rgba(0, 0, 0, 0.34)" }],
      ["nuit", { accent: "#38bdf8", surface: "#111827", surfaceAlt: "#1f2937", surfaceSoft: "#0b1220", text: "#f8fafc", muted: "#a5b4c8", border: "rgba(148, 163, 184, 0.34)", overlay: "rgba(2, 6, 23, 0.82)", input: "#1f2937", inputFocus: "#334155", pageOverlay: "linear-gradient(180deg, rgba(2, 6, 23, 0.76) 0%, rgba(2, 6, 23, 0.88) 60%, rgba(2, 6, 23, 0.94) 100%)", shadow: "0 28px 70px rgba(0, 0, 0, 0.52)" }],
      ["clair", { accent: "#0f766e", surface: "#ffffff", surfaceAlt: "#f1f5f9", surfaceSoft: "#e2e8f0", text: "#0f172a", muted: "#526072", border: "rgba(15, 23, 42, 0.18)", overlay: "rgba(15, 23, 42, 0.46)", input: "#f1f5f9", inputFocus: "#e2e8f0", pageOverlay: "linear-gradient(180deg, rgba(248, 250, 252, 0.86) 0%, rgba(241, 245, 249, 0.9) 55%, rgba(226, 232, 240, 0.94) 100%)", shadow: "0 22px 50px rgba(15, 23, 42, 0.16)" }],
      ["sable", { accent: "#c2703d", surface: "#3b2f2a", surfaceAlt: "#4a3b34", surfaceSoft: "#2e2521", text: "#fff7ed", muted: "#d8c7ba", border: "rgba(255, 237, 213, 0.3)", overlay: "rgba(28, 22, 19, 0.7)", input: "#4a3b34", inputFocus: "#5c4a40", pageOverlay: "linear-gradient(180deg, rgba(45, 32, 24, 0.48) 0%, rgba(28, 20, 16, 0.72) 60%, rgba(22, 16, 13, 0.8) 100%)", shadow: "0 24px 60px rgba(17, 10, 6, 0.4)" }],
      ["ocean", { accent: "#0891b2", surface: "#0f2d3a", surfaceAlt: "#154052", surfaceSoft: "#0a2430", text: "#ecfeff", muted: "#a8d5e2", border: "rgba(165, 243, 252, 0.28)", overlay: "rgba(3, 17, 24, 0.74)", input: "#154052", inputFocus: "#1d5268", pageOverlay: "linear-gradient(180deg, rgba(4, 30, 42, 0.58) 0%, rgba(2, 18, 26, 0.82) 60%, rgba(2, 14, 21, 0.9) 100%)", shadow: "0 26px 64px rgba(0, 12, 18, 0.48)" }],
    ]);
    this.typographies = new Registry("typographies", [
      ["pop", { font: '"Open Sans", "Segoe UI", Helvetica, Arial, sans-serif', heading: '"Open Sans", "Segoe UI", Helvetica, Arial, sans-serif', mono: '"Cascadia Code", Consolas, "Courier New", monospace' }],
      ["editorial", { font: 'Georgia, "Times New Roman", "Times", serif', heading: '"Iowan Old Style", "Palatino Linotype", Georgia, serif', mono: '"Cascadia Code", Consolas, "Courier New", monospace' }],
      ["technique", { font: '"IBM Plex Mono", "Cascadia Code", Consolas, "Courier New", monospace', heading: '"IBM Plex Mono", "Cascadia Code", Consolas, "Courier New", monospace', mono: '"Cascadia Code", Consolas, "Courier New", monospace' }],
    ]);
    this.densites = new Registry("densites", [
      ["compact", { gap: 11, pad: 18, tile: 140, chatMin: 210, chatMax: "42vh", line: 1.62 }],
      ["confort", { gap: 16, pad: 24, tile: 165, chatMin: 260, chatMax: "50vh", line: 1.72 }],
      ["large", { gap: 22, pad: 30, tile: 186, chatMin: 300, chatMax: "56vh", line: 1.8 }],
    ]);
    this.arrondis = new Registry("arrondis", [
      ["droit", { radius: 0, bubble: 6 }],
      ["doux", { radius: 12, bubble: 14 }],
      ["arrondi", { radius: 20, bubble: 18 }],
    ]);
  }

  normalizeChoice(value, registry, fallback) {
    return typeof value === "string" && registry.has(value) ? value : fallback;
  }

  build(params = {}, theme = {}) {
    const ambiance = this.normalizeChoice(paramValue(params, "ambiance"), this.ambiances, "pop");
    const densite = this.normalizeChoice(paramValue(params, "densite"), this.densites, "confort");
    const typographie = this.normalizeChoice(paramValue(params, "typographie"), this.typographies, "pop");
    const arrondi = this.normalizeChoice(paramValue(params, "arrondi"), this.arrondis, "arrondi");

    const palette = this.ambiances.get(ambiance);
    const type = this.typographies.get(typographie);
    const density = this.densites.get(densite);
    const radius = this.arrondis.get(arrondi);

    const themePrimary = typeof theme?.primary === "string" && theme.primary.trim() !== "" ? theme.primary.trim() : palette.accent;
    const accent = isCustomized(params, "couleur_accent") ? paramValue(params, "couleur_accent") : themePrimary;
    const surface = isCustomized(params, "couleur_principale") ? paramValue(params, "couleur_principale") : palette.surface;
    const text = isCustomized(params, "couleur_texte") ? paramValue(params, "couleur_texte") : palette.text;

    const tokens = {
      accent, accentInk: contrastInk(accent), surface, surfaceAlt: palette.surfaceAlt, surfaceSoft: palette.surfaceSoft,
      text, muted: palette.muted, border: palette.border, overlay: palette.overlay, input: palette.input, inputFocus: palette.inputFocus,
      pageOverlay: palette.pageOverlay, shadow: palette.shadow, radius: `${radius.radius}px`, bubbleRadius: `${radius.bubble}px`,
      gap: `${density.gap}px`, pad: `${density.pad}px`, tile: `${density.tile}px`, chatMin: `${density.chatMin}px`,
      chatMax: density.chatMax, lineHeight: String(density.line), font: type.font, fontHeading: type.heading, fontMono: type.mono,
      maxWidth: "1060px", imageOpacity: "1", headerAlign: "right",
    };

    const vars = {
      "--pop-accent": tokens.accent, "--pop-accent-ink": tokens.accentInk, "--pop-surface": tokens.surface,
      "--pop-surface-2": tokens.surfaceAlt, "--pop-surface-3": tokens.surfaceSoft, "--pop-text": tokens.text,
      "--pop-muted": tokens.muted, "--pop-border": tokens.border, "--pop-overlay": tokens.overlay,
      "--pop-input-bg": tokens.input, "--pop-input-bg-focus": tokens.inputFocus, "--pop-page-overlay": tokens.pageOverlay,
      "--pop-shadow": tokens.shadow, "--pop-radius": tokens.radius, "--pop-bubble-radius": tokens.bubbleRadius,
      "--pop-gap": tokens.gap, "--pop-pad": tokens.pad, "--pop-tile-size": tokens.tile, "--pop-chat-min": tokens.chatMin,
      "--pop-chat-max": tokens.chatMax, "--pop-line-height": tokens.lineHeight, "--pop-font": tokens.font,
      "--pop-font-heading": tokens.fontHeading, "--pop-font-mono": tokens.fontMono, "--pop-max-width": tokens.maxWidth,
      "--pop-image-opacity": tokens.imageOpacity, "--pop-header-align": tokens.headerAlign,
      "--pop-sidebar-width": "280px", "--pop-content-max": "820px",
    };

    const overrides = parseJsonParam(params, "design_json", {});
    for (const [rawKey, rawValue] of Object.entries(overrides)) {
      const key = rawKey.startsWith("--pop-") ? rawKey.slice(6) : rawKey;
      const cssVar = DESIGN_KEYS[key] ?? (rawKey.startsWith("--pop-") ? rawKey : null);
      if (cssVar === null) continue;
      const value = safeCssValue(rawValue, key);
      if (value === null) continue;
      vars[cssVar] = value;
      tokens[key] = value;
    }

    return {
      ambiance, densite, typographie, arrondi, tokens, vars,
      className: `pop--${ambiance} pop--${densite} pop--${typographie} pop--${arrondi}`,
    };
  }

  get presets() {
    return {
      ambiances: this.ambiances.keys(),
      densites: this.densites.keys(),
      typographies: this.typographies.keys(),
      arrondis: this.arrondis.keys(),
      defaults: DEFAULTS,
    };
  }
}

export const designSystem = new DesignSystem();

export function buildDesign(params = {}, theme = {}) {
  return designSystem.build(params, theme);
}

export const DESIGN_PRESETS = Object.freeze(designSystem.presets);
