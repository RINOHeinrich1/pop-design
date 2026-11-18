// Modèle d'interface générique orienté objet (POO avancée) : chaque élément
// de l'interface est un objet paramétrable, composable et parcourable.
// La structure (régions, éléments, vues) est décrite comme un graphe d'objets.

import { Registry } from "./registry.js";
import { UiNode, ContainerNode, LeafNode, uiNodeFactory, n, list, when } from "./ui-node.js";

export class InterfaceElement extends UiNode {
  constructor(type, props = {}, children = []) {
    super(type, props, children);
    this.visible = props.visible !== false;
    this.enabled = props.enabled !== false;
    this.variant = props.variant ?? null;
  }
  show() { this.visible = true; return this; }
  hide() { this.visible = false; return this; }
  enable() { this.enabled = true; return this; }
  disable() { this.enabled = false; return this; }
  configure(patch = {}) { this.setProps(patch); if (patch.visible !== undefined) this.visible = patch.visible; if (patch.enabled !== undefined) this.enabled = patch.enabled; return this; }
  toJSON() { return { ...super.toJSON(), visible: this.visible, enabled: this.enabled, variant: this.variant }; }
}

export class Region extends InterfaceElement {
  constructor(name, props = {}, children = []) {
    super(props.type ?? "region", { ...props, name, region: name }, children);
    this.name = name;
    this.layout = props.layout ?? "stack";
  }
  setLayout(layout) { this.layout = layout; this.setProp("layout", layout); return this; }
}

export class ViewModel extends InterfaceElement {
  constructor(name, props = {}, regions = []) {
    super("view", { ...props, name }, regions);
    this.name = name;
    this.regions = new Map();
    for (const r of regions) this.addRegion(r);
  }
  addRegion(region) {
    if (!region) return this;
    const r = region instanceof Region ? region : new Region(region.name ?? region.id ?? "region", region, region.children ?? []);
    this.regions.set(r.name, r);
    // keep children in sync
    if (!this.children.includes(r)) this.children.push(r);
    return this;
  }
  getRegion(name) { return this.regions.get(name) ?? null; }
  toJSON() { return { ...super.toJSON(), name: this.name, regions: Array.from(this.regions.keys()) }; }
}

export class Layout extends InterfaceElement {
  constructor(kind = "stack", props = {}, children = []) {
    super("layout", { ...props, kind }, children);
    this.kind = kind;
  }
}

/** Constructeur générique d'interface (fabrique paramétrable). */
export class InterfaceBuilder {
  constructor(factory = uiNodeFactory) {
    this.factory = factory;
    this.elementRegistry = new Registry("interface-elements");
  }

  registerElement(name, ctorOrBuilder) { this.elementRegistry.register(name, ctorOrBuilder); return this; }

  element(type, props = {}, children = []) {
    const reg = this.elementRegistry.get(type);
    if (typeof reg === "function") {
      try { const inst = new reg(props, children); if (inst) return inst; } catch { return reg(props, children); }
    }
    return new InterfaceElement(type, props, children);
  }

  region(name, props = {}, children = []) { return new Region(name, props, children); }
  view(name, props = {}, regions = []) { return new ViewModel(name, props, regions); }
  layout(kind, props = {}, children = []) { return new Layout(kind, props, children); }

  /** Construit l'arbre d'interface principal (objet, parcourable, paramétrable). */
  buildAppInterface(model = {}, ctx = {}) {
    const phase = ctx.state?.phase ?? "identity";
    const headerEl = this.element("header", { visible: phase !== "chat" && model.content?.elements?.header?.title !== false, content: model.content });
    const chatEl = this.element("chat", { visible: phase === "chat", model, phase });
    const identityEl = this.element("identity", { visible: phase === "identity", model, consent: ctx.consent });
    const tilesEl = this.element("tiles", { visible: phase === "chat" || phase !== "identity", tiles: model.tiles, phase });
    const footerEl = this.element("footer", { visible: model.content?.elements?.footer?.visible !== false, content: model.content, chat: model.chat });
    const panelEl = this.element("panel-overlay", { visible: false, dynamic: true });

    const main = this.region("main", { layout: "column", flex: 1 }, [headerEl, chatEl, identityEl].filter((e) => e.visible));
    const side = this.region("side", { layout: "column" }, [tilesEl].filter((e) => e.visible));
    const shell = this.layout(phase === "chat" ? "chat-dominant" : "split", { phase, className: `pop ${model.design?.className ?? ""} ${phase === "chat" ? "pop--chat-dominant" : ""}` }, [main, side]);
    const root = this.region("root", { layout: "viewport" }, [shell, footerEl, panelEl]);

    const view = this.view("app", { phase, design: model.design, content: model.content, schemas: model.schemas }, [root]);
    view.setMeta("traversable", true);
    view.setMeta("generic", true);
    return view;
  }
}

export const interfaceBuilder = new InterfaceBuilder();

export function buildAppInterface(model = {}, ctx = {}) {
  return interfaceBuilder.buildAppInterface(model, ctx);
}
