// Registre générique (pattern jeu : registre de ressources/fabriques).
// Permet d'enregistrer, résoudre et surcharger des définitions sans dépendre
// de tables statiques figées dans le code.

export class Registry {
  constructor(name = "registry", entries = []) {
    this.name = name;
    this._map = new Map();
    for (const [key, value] of entries) this.register(key, value);
  }

  register(key, value) {
    if (key == null) return this;
    this._map.set(String(key), value);
    return this;
  }

  has(key) {
    return this._map.has(String(key));
  }

  get(key, fallback = undefined) {
    const k = String(key);
    return this._map.has(k) ? this._map.get(k) : fallback;
  }

  resolve(key, fallbackKey = null) {
    if (this.has(key)) return this.get(key);
    if (fallbackKey != null && this.has(fallbackKey)) return this.get(fallbackKey);
    return undefined;
  }

  keys() {
    return [...this._map.keys()];
  }

  values() {
    return [...this._map.values()];
  }

  entries() {
    return [...this._map.entries()];
  }

  clone(name = this.name) {
    return new Registry(name, this.entries());
  }

  /** Fusionne/étend depuis un objet ou un autre registre (surcharge). */
  extend(source) {
    const entries =
      source instanceof Registry
        ? source.entries()
        : source && typeof source === "object"
          ? Object.entries(source)
          : [];
    for (const [k, v] of entries) this.register(k, v);
    return this;
  }

  toObject() {
    return Object.fromEntries(this._map.entries());
  }
}

// Registre global des registres (méta-registre), façon moteur de jeu.
export class RegistryHub {
  constructor() {
    this._registries = new Map();
  }

  define(name, entries = []) {
    const reg = entries instanceof Registry ? entries : new Registry(name, entries);
    this._registries.set(name, reg);
    return reg;
  }

  get(name) {
    return this._registries.get(name);
  }

  require(name) {
    const reg = this.get(name);
    if (!reg) throw new Error(`Registry "${name}" not found`);
    return reg;
  }
}

export const registries = new RegistryHub();
