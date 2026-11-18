import { Registry } from "./registry.js";
import { IFieldDescriptor, IColumnDescriptor } from "./contracts.js";

/**
 * Registre de stratégies de rendu/vue par type (kind) — équivalent du
 * dispatch générique (AdminGen/Generic* configurés par entité) côté interface.
 */
export class ViewRegistry {
  constructor() {
    this.renderers = new Registry("view-renderers");
    this.fieldSchemas = new Registry("field-schemas");
    this.listSchemas = new Registry("list-schemas");
  }

  registerRenderer(kind, renderer) {
    this.renderers.register(kind, renderer);
    return this;
  }

  getRenderer(kind, fallbackKind = "text") {
    return this.renderers.resolve(kind, fallbackKind) ?? this.renderers.get("default");
  }

  registerFieldSchema(name, fields = []) {
    this.fieldSchemas.register(name, fields.map((f) => new IFieldDescriptor(f)));
    return this;
  }

  getFieldSchema(name) {
    return this.fieldSchemas.get(name, []);
  }

  registerListSchema(name, columns = []) {
    this.listSchemas.register(name, columns.map((c) => new IColumnDescriptor(c)));
    return this;
  }

  getListSchema(name) {
    return this.listSchemas.get(name, []);
  }

  /**
   * Produit un descripteur de vue générique pour un modèle (entité UI).
   * Le composant concret consomme ce descripteur au lieu de logique codée en dur.
   */
  buildView(model, context = {}) {
    if (!model) return null;
    const kind = model.kind ?? model.type ?? "default";
    const renderer = this.getRenderer(kind);
    if (renderer && typeof renderer.buildView === "function") {
      return renderer.buildView(model, context);
    }
    if (typeof renderer === "function") {
      return renderer(model, context);
    }
    return {
      kind,
      id: model.id,
      title: model.title ?? model.label ?? model.id,
      text: model.text ?? "",
      data: typeof model.toJSON === "function" ? model.toJSON() : { ...model },
      meta: {},
    };
  }
}

export const viewRegistry = new ViewRegistry();

// Stratégies de vue génériques par défaut (pilotées par kind)
viewRegistry.registerRenderer("welcome", (model, ctx) => ({
  kind: "welcome",
  id: model.id,
  title: model.title,
  text: model.text,
  images: Array.isArray(model.images) ? model.images : [],
  layout: "split-media",
  meta: { tileId: model.tileId },
}));
viewRegistry.registerRenderer("team", (model, ctx) => ({
  kind: "team",
  id: model.id,
  title: model.title,
  text: model.text,
  images: Array.isArray(model.images) ? model.images : [],
  layout: "split-portrait",
  meta: { tileId: model.tileId },
}));
viewRegistry.registerRenderer("gallery", (model, ctx) => ({
  kind: "gallery",
  id: model.id,
  title: model.title,
  text: model.text,
  images: Array.isArray(model.images) ? model.images : [],
  layout: "gallery",
  meta: { tileId: model.tileId },
}));
viewRegistry.registerRenderer("contact", (model, ctx) => ({
  kind: "contact",
  id: model.id,
  title: model.title,
  text: model.text,
  images: Array.isArray(model.images) ? model.images : [],
  layout: "contact-form",
  meta: { tileId: model.tileId },
}));
viewRegistry.registerRenderer("text", (model, ctx) => ({
  kind: "text",
  id: model.id,
  title: model.title,
  text: model.text,
  images: Array.isArray(model.images) ? model.images : [],
  layout: "text",
  meta: { tileId: model.tileId },
}));
viewRegistry.registerRenderer("default", (model, ctx) => ({
  kind: model?.kind ?? "text",
  id: model?.id,
  title: model?.title ?? model?.label ?? "",
  text: model?.text ?? "",
  images: Array.isArray(model?.images) ? model.images : [],
  layout: "text",
  meta: { tileId: model?.tileId },
}));

// Schémas de champs génériques (ex: identité) — configurables
viewRegistry.registerFieldSchema("identity", [
  { name: "nom", label: "Nom", type: "text", required: true, props: { autoComplete: "name" } },
  { name: "email", label: "Email", type: "email", required: true, props: { autoComplete: "email" } },
]);
viewRegistry.registerFieldSchema("contact-message", [
  { name: "message", label: "Message", type: "textarea", required: true },
]);

export function buildView(model, context = {}) {
  return viewRegistry.buildView(model, context);
}
