// Résolution d'assets générique (OOP) : registre d'assets embarqués et
// stratégies de résolution/validation d'URL, pilotables par configuration.

import { Registry } from "./registry.js";
import bg from "../assets/pop-bg.jpg";
import underline from "../assets/underline.png";
import welcome1 from "../assets/welcome-1.jpg";
import welcome2 from "../assets/welcome-2.jpg";
import team from "../assets/team.jpg";

export class AssetResolver {
  constructor(config = {}) {
    // Visuels embarqués de la présentation d'origine, surchargés par le backend.
    this.bundled = new Registry("bundled-assets", Object.entries(config.bundled ?? {
      background: bg,
      underline,
      welcome1,
      welcome2,
      team,
    }));
    this.safePattern = config.safePattern ?? /^(https?:\/\/|data:image\/|blob:|\/|\.\/|\.\.\/)/i;
  }

  register(name, value) {
    this.bundled.register(name, value);
    return this;
  }

  getBundled(name, fallback = "") {
    return this.bundled.get(name, fallback);
  }

  imageUrl(value, fallback = "") {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    if (trimmed === "") return fallback;
    if (!this.safePattern.test(trimmed)) return fallback;
    return trimmed;
  }

  resolveLogo(paramsLogo, brandLogo) {
    return this.imageUrl(paramsLogo, this.imageUrl(brandLogo, ""));
  }

  resolveAvatar(value) {
    const url = this.imageUrl(value, "");
    return url === "" ? null : url;
  }
}

export const assetResolver = new AssetResolver();
export const BUNDLED = Object.freeze(assetResolver.bundled.toObject());

export function imageUrl(value, fallback = "") { return assetResolver.imageUrl(value, fallback); }
export function resolveLogo(paramsLogo, brandLogo) { return assetResolver.resolveLogo(paramsLogo, brandLogo); }
export function resolveAvatar(value) { return assetResolver.resolveAvatar(value); }
