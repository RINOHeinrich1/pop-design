// Moteur d'interface générique (POO avancée) : chaque élément d'interface est
// un objet (nœud) paramétrable, parcourable et sérialisable. Les vues sont
// des graphes d'objets construits puis rendus via un registre de composants.

import { Registry } from "./registry.js";

let __uid = 0;
function uid(prefix = "n") { __uid += 1; return `${prefix}-${__uid}`; }

/** Nœud UI abstrait (élément générique). */
export class UiNode {
  constructor(type, props = {}, children = []) {
    this.id = props.id ?? uid(type || "node");
    this.type = String(type || "node");
    this.key = props.key ?? this.id;
    this.props = props && typeof props === "object" ? { ...props } : {};
    this.children = [];
    this.meta = {};
    this.setChildren(children);
  }

  setProp(name, value) { this.props[name] = value; return this; }
  setProps(patch = {}) { this.props = { ...this.props, ...patch }; return this; }
  setMeta(key, value) { this.meta[key] = value; return this; }

  add(child) {
    if (child == null) return this;
    if (Array.isArray(child)) { child.forEach((c) => this.add(c)); return this; }
    this.children.push(child);
    return this;
  }

  setChildren(children = []) {
    this.children = [];
    this.add(children);
    return this;
  }

  /** Parcours générique (pré-ordre). */
  traverse(fn, depth = 0, parent = null) {
    fn(this, depth, parent);
    for (const child of this.children) {
      if (child && typeof child.traverse === "function") child.traverse(fn, depth + 1, this);
      else fn(child, depth + 1, this);
    }
    return this;
  }

  find(predicate) {
    let found = null;
    this.traverse((node) => { if (!found && predicate(node)) found = node; });
    return found;
  }

  findById(id) { return this.find((n) => n && n.id === id); }

  map(fn) {
    const mapped = fn(this);
    if (mapped && typeof mapped === "object" && Array.isArray(this.children)) {
      mapped.children = this.children.map((c) => (c && typeof c.map === "function" ? c.map(fn) : c));
    }
    return mapped;
  }

  clone() {
    const Ctor = this.constructor;
    const copy = new Ctor(this.type, { ...this.props }, []);
    copy.id = this.id;
    copy.key = this.key;
    copy.meta = { ...this.meta };
    copy.children = this.children.map((c) => (c && typeof c.clone === "function" ? c.clone() : c));
    return copy;
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      key: this.key,
      props: { ...this.props },
      meta: { ...this.meta },
      children: this.children.map((c) => (c && typeof c.toJSON === "function" ? c.toJSON() : c)),
    };
  }
}

export class ContainerNode extends UiNode {
  constructor(type = "container", props = {}, children = []) { super(type, props, children); }
}
export class LeafNode extends UiNode {
  constructor(type = "leaf", props = {}) { super(type, props, []); }
  add() { return this; }
}
export class TextNode extends LeafNode {
  constructor(text = "", props = {}) { super("text", { ...props, text }); this.text = String(text ?? ""); }
  toJSON() { return { ...super.toJSON(), text: this.text }; }
}
export class SlotNode extends UiNode {
  constructor(name, props = {}, children = []) { super("slot", { ...props, name }, children); this.name = name; }
}

/** Fabrique/registre de nœuds UI (générique, extensible). */
export class UiNodeFactory {
  constructor() {
    this.registry = new Registry("ui-nodes", [
      ["container", (type, props, children) => new ContainerNode(type, props, children)],
      ["leaf", (type, props) => new LeafNode(type, props)],
      ["text", (_t, props) => new TextNode(props?.text ?? props?.content ?? "", props)],
      ["slot", (_t, props, children) => new SlotNode(props?.name ?? "default", props, children)],
    ]);
  }

  register(type, builder) { this.registry.register(type, builder); return this; }

  create(type, props = {}, children = []) {
    const builder = this.registry.get(type) ?? this.registry.get("container");
    return builder(type, props, children);
  }

  node(type, props = {}, children = []) { return this.create(type, props, children); }
  container(props = {}, children = []) { return new ContainerNode(props.type ?? "container", props, children); }
  leaf(type, props = {}) { return new LeafNode(type, props); }
  text(text, props = {}) { return new TextNode(text, props); }
  slot(name, props = {}, children = []) { return new SlotNode(name, props, children); }
}

export const uiNodeFactory = new UiNodeFactory();

/** Aides fonctionnelles (DSL objet) */
export function n(type, props = {}, children = []) { return uiNodeFactory.create(type, props, children); }
export function box(props = {}, children = []) { return uiNodeFactory.container(props, children); }
export function leaf(type, props = {}) { return uiNodeFactory.leaf(type, props); }
export function textNode(text, props = {}) { return uiNodeFactory.text(text, props); }
export function when(condition, node) { return condition ? node : null; }
export function list(items, mapFn) { return (Array.isArray(items) ? items : []).map(mapFn).filter(Boolean); }

export function createUiNode(type, props = {}, children = []) { return uiNodeFactory.create(type, props, children); }
