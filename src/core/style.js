// Système de style orienté objet : classes, variantes et tokens comme objets
// paramétrables/composables (esprit gestion_station/shadcn: tokens config,
// variantes structurées, composition de classes), indépendant du moteur CSS.

import { Registry } from "./registry.js";

/** Compose des classes (équivalent cn/clsx) de façon générique. */
export function cx(...parts) {
  const out = [];
  const push = (v) => {
    if (!v) return;
    if (typeof v === "string") { out.push(v); return; }
    if (Array.isArray(v)) { v.forEach(push); return; }
    if (typeof v === "object") {
      for (const [k, on] of Object.entries(v)) if (on) out.push(k);
    }
  };
  parts.forEach(push);
  return out.join(" ").replace(/\s+/g, " ").trim();
}

/** Descripteur de style/variantes d'un composant (objet paramétrable). */
export class StyleDescriptor {
  constructor(config = {}) {
    this.base = config.base ?? "";
    this.variants = config.variants && typeof config.variants === "object" ? { ...config.variants } : {};
    this.compound = Array.isArray(config.compound) ? config.compound : [];
    this.defaults = config.defaults && typeof config.defaults === "object" ? { ...config.defaults } : {};
  }

  resolve(props = {}) {
    const merged = { ...this.defaults, ...props };
    const classes = [this.base];
    for (const [name, map] of Object.entries(this.variants)) {
      const value = merged[name];
      if (value == null) continue;
      const key = value === true ? "true" : value === false ? "false" : String(value);
      if (map && typeof map === "object" && map[key]) classes.push(map[key]);
    }
    for (const rule of this.compound) {
      if (!rule || typeof rule !== "object") continue;
      const { class: cls, className, ...conds } = rule;
      const ok = Object.entries(conds).every(([k, v]) => merged[k] === v);
      if (ok) classes.push(cls ?? className);
    }
    if (merged.className) classes.push(merged.className);
    return cx(classes);
  }
}

/** Registre de styles/variantes par type d'élément (objet, extensible). */
export class StyleRegistry {
  constructor() {
    this.registry = new Registry("styles");
  }
  register(type, descriptor) {
    const d = descriptor instanceof StyleDescriptor ? descriptor : new StyleDescriptor(descriptor);
    this.registry.register(type, d);
    return d;
  }
  get(type) { return this.registry.get(type, null); }
  resolve(type, props = {}, fallback = "") {
    const d = this.get(type);
    return d ? d.resolve(props) : cx(fallback, props.className);
  }
}

export const styleRegistry = new StyleRegistry();

// Styles de base enregistrés comme objets (paramétrables)
styleRegistry.register("card", { base: "pop-card", variants: { variant: { identity: "pop-identity" } } });
styleRegistry.register("button", { base: "btn", variants: { variant: { block: "btn--block", ghost: "btn--ghost", small: "btn--small" } } });
styleRegistry.register("layout", { base: "pop-layout" });
styleRegistry.register("sidebar", { base: "pop-col pop-col--side pop-sidebar" });
styleRegistry.register("main", { base: "pop-col pop-col--main pop-main" });
styleRegistry.register("chat", { base: "pop-card pop-chat" });

export function createStyleDescriptor(config = {}) { return new StyleDescriptor(config); }
