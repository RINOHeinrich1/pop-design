// Contrats/interfaces génériques (logique inspirée gestion_station :
// abstractions + implémentations spécialisées + registres/fabriques).

/**
 * Contrat d'une entité/vue sérialisable pilotée par configuration.
 * Toute entité métier/UI (tuile, panneau, message, champ, etc.) expose ce contrat.
 */
export class IModel {
  get id() { throw new Error("Not implemented"); }
  get kind() { throw new Error("Not implemented"); }
  toJSON() { throw new Error("Not implemented"); }
}

/**
 * Contrat d'un descripteur de champ/formulaire (générique, comme GenericForm).
 */
export class IFieldDescriptor {
  constructor(def = {}) {
    this.name = String(def.name ?? "");
    this.label = String(def.label ?? def.name ?? "");
    this.type = String(def.type ?? "text");
    this.required = Boolean(def.required);
    this.options = Array.isArray(def.options) ? def.options : [];
    this.props = def.props && typeof def.props === "object" ? { ...def.props } : {};
  }
}

/**
 * Contrat d'un descripteur de colonne/liste (générique, comme GenericList).
 */
export class IColumnDescriptor {
  constructor(def = {}) {
    this.key = String(def.key ?? def.name ?? "");
    this.label = String(def.label ?? def.key ?? def.name ?? "");
    this.sortable = Boolean(def.sortable);
    this.visible = def.visible !== false;
    this.render = typeof def.render === "function" ? def.render : null;
  }
}

/**
 * Contrat d'un renderer/stratégie de vue pour un type/kind donné.
 */
export class IViewRenderer {
  constructor(kind) {
    this.kind = kind;
  }
  /** @returns {any} données de vue / props normalisées pour le composant générique */
  buildView(model, context = {}) {
    throw new Error("Not implemented");
  }
}

/**
 * Contrat d'un service/opération générique sur entité (CRUD/transition).
 */
export class IEntityService {
  async create(data, ctx) { throw new Error("Not implemented"); }
  async update(id, data, ctx) { throw new Error("Not implemented"); }
  async remove(id, ctx) { throw new Error("Not implemented"); }
  async findById(id, ctx) { throw new Error("Not implemented"); }
  async search(query, ctx) { throw new Error("Not implemented"); }
}

/**
 * Contrat d'un composant d'interface piloté par schéma (schema-driven UI).
 * Implémentations concrètes: listes, formulaires, détails, panneaux, tuiles...
 */
export class IGenericComponent {
  constructor(config = {}) {
    this.config = config;
  }
  getSchema() { return this.config.schema ?? null; }
  getActions() { return this.config.actions ?? {}; }
}
