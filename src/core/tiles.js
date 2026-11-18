// Système de tuiles/panneaux générique (OOP, registre de stratégies).
// Les types, alias, icônes et stratégies de construction de panneaux sont
// pilotés par des registres configurables plutôt que des tables statiques.

import { BUNDLED, imageUrl } from "./assets.js";
import { PanelModel, TileModel, uniqueElements } from "./element.js";
import { Registry } from "./registry.js";
import { ICONS } from "../icons.js";
import { DEFAULTS, parseJsonParam, textParam } from "./params.js";

export const MAX_TILES = 8;
export const FALLBACK_ICON = "comments";

/** Stratégie de construction de panneau par type de tuile. */
class PanelStrategy {
  constructor(kind, builder) {
    this.kind = kind;
    this.builder = builder;
  }
  build(params, tile) {
    return this.builder(params, tile);
  }
}

export class TileSystem {
  constructor(config = {}) {
    this.maxTiles = config.maxTiles ?? MAX_TILES;
    this.fallbackIcon = config.fallbackIcon ?? FALLBACK_ICON;
    this.kindAliases = new Registry("tile-kind-aliases", [
      ["welcome", "welcome"], ["bienvenue", "welcome"], ["accueil", "welcome"],
      ["team", "team"], ["equipe", "team"],
      ["gallery", "gallery"], ["galerie", "gallery"], ["realisations", "gallery"], ["r\u00e9alisations", "gallery"], ["work", "gallery"],
      ["contact", "contact"],
      ["text", "text"], ["texte", "text"], ["custom", "text"],
    ]);
    this.iconSet = new Registry("icons", Object.keys(ICONS).map((k) => [k, true]));
    this.panelStrategies = new Registry("panel-strategies");
    this.registerDefaultStrategies();
  }

  registerDefaultStrategies() {
    const strats = [
      new PanelStrategy("welcome", (params, tile) => new PanelModel({
        id: tile.id, kind: "welcome",
        title: tile.title === tile.label ? textParam(params, "titre_welcome") : tile.title,
        text: tile.text === "" ? textParam(params, "texte_welcome") : tile.text,
        images: [
          imageUrl(tile.image, imageUrl(params?.image_welcome_1, BUNDLED.welcome1)),
          imageUrl(params?.image_welcome_2, BUNDLED.welcome2),
        ],
        icon: tile.icon || "home",
        tileId: tile.id, element: tile,
      })),
      new PanelStrategy("team", (params, tile) => new PanelModel({
        id: tile.id, kind: "team",
        title: tile.title === tile.label ? textParam(params, "titre_equipe") : tile.title,
        text: tile.text === "" ? textParam(params, "texte_equipe") : tile.text,
        images: [imageUrl(tile.image, imageUrl(params?.image_equipe, BUNDLED.team))],
        icon: tile.icon || "users",
        tileId: tile.id, element: tile,
      })),
      new PanelStrategy("gallery", (params, tile) => new PanelModel({
        id: tile.id, kind: "gallery",
        title: tile.title === tile.label ? textParam(params, "titre_realisations") : tile.title,
        text: tile.text,
        images: tile.image === "" ? [] : [imageUrl(tile.image, "")].filter(Boolean),
        icon: tile.icon || "handshake",
        tileId: tile.id, element: tile,
      })),
      new PanelStrategy("contact", (params, tile) => new PanelModel({
        id: tile.id, kind: "contact",
        title: tile.title === tile.label ? textParam(params, "titre_contact") : tile.title,
        text: tile.text === "" ? textParam(params, "texte_contact") : tile.text,
        images: tile.image === "" ? [] : [imageUrl(tile.image, "")].filter(Boolean),
        icon: tile.icon || "comments",
        tileId: tile.id, element: tile,
      })),
      new PanelStrategy("text", (params, tile) => new PanelModel({
        id: tile.id, kind: "text",
        title: tile.title, text: tile.text,
        images: tile.image === "" ? [] : [imageUrl(tile.image, "")].filter(Boolean),
        icon: tile.icon || "file",
        tileId: tile.id, element: tile,
      })),
    ];
    for (const s of strats) this.panelStrategies.register(s.kind, s);
  }

  canonicalKind(value) {
    const key = String(value ?? "").trim().toLowerCase();
    return this.kindAliases.get(key, "text");
  }

  canonicalIcon(value) {
    const key = String(value ?? "").trim();
    return this.iconSet.has(key) ? key : this.fallbackIcon;
  }

  defaultSpecs() {
    const parsed = parseJsonParam({ tuiles_json: DEFAULTS.tuiles_json }, "tuiles_json", []);
    return Array.isArray(parsed) ? parsed : [];
  }

  createTile(entry) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return null;
    const kind = this.canonicalKind(entry.type ?? entry.kind);
    return new TileModel({
      ...entry,
      type: kind,
      icone: this.canonicalIcon(entry.icone ?? entry.icon),
      libelle: entry.libelle ?? entry.label,
    });
  }

  normalize(params = {}) {
    const raw = parseJsonParam(params, "tuiles_json", []);
    const source = Array.isArray(raw) && raw.length > 0 ? raw : this.defaultSpecs();
    const tiles = [];
    for (const entry of source.slice(0, this.maxTiles)) {
      const tile = this.createTile(entry);
      if (tile && tile.enabled) tiles.push(tile);
    }
    if (tiles.length === 0) {
      return uniqueElements(
        this.defaultSpecs()
          .slice(0, this.maxTiles)
          .map((entry) => this.createTile({ ...entry, type: this.canonicalKind(entry.type), icone: this.canonicalIcon(entry.icone) }))
          .filter(Boolean),
      );
    }
    return uniqueElements(tiles);
  }

  createPanel(params, tile) {
    const strat = this.panelStrategies.get(tile.kind, this.panelStrategies.get("text"));
    return strat ? strat.build(params, tile) : new PanelModel({ id: tile.id, kind: "text", title: tile.title, text: tile.text, tileId: tile.id });
  }

  createPanels(params = {}, tiles = []) {
    return tiles.map((tile) => this.createPanel(params, tile));
  }
}

// Instance par défaut + API fonctionnelle compatible
export const tileSystem = new TileSystem();

export function canonicalTileKind(value) {
  return tileSystem.canonicalKind(value);
}
export function canonicalIcon(value) {
  return tileSystem.canonicalIcon(value);
}
export function normalizeTiles(params = {}) {
  return tileSystem.normalize(params);
}
export function createPanels(params = {}, tiles = []) {
  return tileSystem.createPanels(params, tiles);
}
export function findPanel(panels, id) {
  return panels.find((panel) => panel.id === id) ?? null;
}
