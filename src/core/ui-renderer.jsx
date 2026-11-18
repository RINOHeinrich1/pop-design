import React from "react";
import { Registry } from "./registry.js";

/**
 * Registre de composants/rendus par type de nœud UI.
 * Chaque entrée est une fonction React (renderer) : (props, node, ctx) => JSX.
 */
export class ComponentRegistry {
  constructor(defaults = []) {
    this.registry = new Registry("ui-components", defaults);
  }
  register(type, renderer) { this.registry.register(type, renderer); return this; }
  get(type) { return this.registry.get(type); }
  has(type) { return this.registry.has(type); }
  resolve(type, fallback = "container") { return this.registry.resolve(type, fallback); }
}

export const componentRegistry = new ComponentRegistry();

/** Rendu générique d'un nœud (objet) via le registre — aucun JSX brut imposé au modèle. */
export function renderNode(node, ctx = {}, registry = componentRegistry) {
  if (node == null || node === false) return null;
  if (typeof node === "string" || typeof node === "number") return node;
  if (Array.isArray(node)) return node.map((child, i) => <React.Fragment key={i}>{renderNode(child, ctx, registry)}</React.Fragment>);
  if (React.isValidElement(node)) return node;

  const type = node.type ?? "container";
  const Renderer = registry.resolve(type, "unknown");
  const children = Array.isArray(node.children)
    ? node.children.map((child, i) => {
        const key = child && typeof child === "object" ? (child.key ?? child.id ?? i) : i;
        const rendered = renderNode(child, ctx, registry);
        return React.isValidElement(rendered) ? React.cloneElement(rendered, { key: rendered.key ?? key }) : <React.Fragment key={key}>{rendered}</React.Fragment>;
      })
    : null;

  if (typeof Renderer === "function") {
    return Renderer({ ...(node.props || {}), node, ctx, children, key: node.key ?? node.id });
  }

  // Fallback générique: conteneur/élément neutre
  const { as: Tag = "div", text, content, ...rest } = node.props || {};
  return <Tag {...rest} key={node.key ?? node.id}>{text ?? content}{children}</Tag>;
}

export function GenericRenderer({ node, ctx, registry = componentRegistry }) {
  return <>{renderNode(node, ctx, registry)}</>;
}

/** Enregistrement de composants de base (génériques). */
export function registerBaseComponents(registry = componentRegistry) {
  registry.register("container", ({ as: Tag = "div", children, className, style, ...rest }) => <Tag className={className} style={style} {...filterDomProps(rest)}>{children}</Tag>);
  registry.register("box", ({ as: Tag = "div", children, className, style, ...rest }) => <Tag className={className} style={style} {...filterDomProps(rest)}>{children}</Tag>);
  registry.register("text", ({ text, content, as: Tag = "span", className, children, ...rest }) => <Tag className={className} {...filterDomProps(rest)}>{text ?? content}{children}</Tag>);
  registry.register("slot", ({ children }) => <>{children}</>);
  registry.register("fragment", ({ children }) => <>{children}</>);
  registry.register("unknown", ({ as: Tag = "div", children, className, text, content, ...rest }) => <Tag className={className} {...filterDomProps(rest)}>{text ?? content}{children}</Tag>);
  return registry;
}

function filterDomProps(props = {}) {
  const out = {};
  for (const [k, v] of Object.entries(props)) {
    if (k === "node" || k === "ctx" || k === "children" || k === "key") continue;
    out[k] = v;
  }
  return out;
}

registerBaseComponents(componentRegistry);
