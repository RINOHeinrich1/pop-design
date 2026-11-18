// Système de discussion générique (OOP) : configuration, normalisation,
// entités message/contact, règles et stratégies pilotées par registres.

import { Registry } from "./registry.js";
import { MAX_MESSAGE, boolParam, parseJsonParam, textParam } from "./params.js";

const MAX_SUGGESTIONS = 8;
const MAX_SUGGESTION_LENGTH = 140;

export const CONTACT_TYPES = Object.freeze(["téléphone", "whatsapp", "site web", "autre"]);

const DEFAULT_LABELS = Object.freeze({
  pieces: "Pièces jointes",
  retirer: "Retirer",
  menu_secours: "Menu de secours",
  formulaire: "Être rappelé",
  sources: "Sources",
  suggestions: "Suggestions",
  nouveau_message: "Nouveau message",
  discuter: "Discuter",
  etat: "État du visiteur",
  assistant: "Assistant",
  en_ligne: "En ligne",
  en_train_ecrire: "En train d'écrire…",
  discussion_terminee: "Discussion terminée",
  nom: "Nom",
  nom_placeholder: "Votre nom",
  email: "Email",
  email_placeholder: "vous@exemple.mg",
  demarrer: "Démarrer la discussion",
  identity_hint: "Vos informations servent uniquement à ouvrir la discussion.",
  credit: "Crédit",
});

export class ChatSystem {
  constructor() {
    this.labels = new Registry("chat-labels", Object.entries(DEFAULT_LABELS));
    this.contactRules = [
      { type: "whatsapp", pattern: /whats\s*app/i },
      { type: "téléphone", pattern: /(t[ée]l[ée]?phone|phone|mobile|portable|\btel\b)/i },
      { type: "site web", pattern: /(site|web|url|lien|website)/i },
    ];
  }

  contactTypeFor(field) {
    if (field === null || typeof field !== "object") return "autre";
    if (field.type === "url") return "site web";
    const haystack = [field.name, field.label, field.type]
      .filter((value) => typeof value === "string")
      .join(" ");
    const rule = this.contactRules.find((entry) => entry.pattern.test(haystack));
    return rule === undefined ? "autre" : rule.type;
  }

  buildContact(field, rawValue) {
    const valeur = Array.isArray(rawValue)
      ? rawValue.map((value) => String(value).trim()).filter((value) => value !== "").join(", ")
      : String(rawValue ?? "").trim();
    if (valeur === "") return null;
    const type = this.contactTypeFor(field);
    const label = typeof field?.label === "string" ? field.label.trim() : "";
    return { type, valeur: type === "autre" && label !== "" ? `${label} : ${valeur}` : valeur };
  }

  interpolate(text, ctx = {}) {
    if (typeof text !== "string") return "";
    const brand = ctx.brand?.name ?? "";
    const link = ctx.link?.label ?? "";
    const year = String(new Date().getFullYear());
    return text.replace(/\{marque\}/gi, brand).replace(/\{lien\}/gi, link).replace(/\{annee\}/gi, year);
  }

  parseSuggestions(value) {
    const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\r?\n|\s*[|;]\s*/) : [];
    const seen = new Set();
    const out = [];
    for (const entry of source) {
      const text = String(entry ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_SUGGESTION_LENGTH);
      if (text === "" || seen.has(text)) continue;
      seen.add(text);
      out.push(text);
      if (out.length >= MAX_SUGGESTIONS) break;
    }
    return out;
  }

  normalizeConfig(params = {}) {
    const parsed = parseJsonParam(params, "chat_json", {});
    const overrides = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    const suggestionsSource = Object.prototype.hasOwnProperty.call(overrides, "suggestions") ? overrides.suggestions : textParam(params, "suggestions");
    const labels = {
      ...this.labels.toObject(),
      ...(overrides.libelles && typeof overrides.libelles === "object" && !Array.isArray(overrides.libelles)
        ? Object.fromEntries(Object.entries(overrides.libelles).filter(([, v]) => typeof v === "string" && v.trim() !== ""))
        : {}),
    };
    const readBoolean = (source, key, fallback) => {
      const v = source?.[key];
      if (typeof v === "boolean") return v;
      if (v === "1" || v === "true") return true;
      if (v === "0" || v === "false") return false;
      return fallback;
    };
    const readString = (source, key, fallback) => {
      const v = source?.[key];
      return typeof v === "string" && v.trim() !== "" ? v.trim() : fallback;
    };
    const readMaxLength = (source) => {
      const v = Number(source?.maxLength);
      if (!Number.isFinite(v)) return MAX_MESSAGE;
      return Math.max(1, Math.min(MAX_MESSAGE, Math.floor(v)));
    };
    const maxLength = readMaxLength(overrides);
    const suggestions = this.parseSuggestions(suggestionsSource).filter((entry) => entry.length <= maxLength);
    const identityOverrides = overrides.identite && typeof overrides.identite === "object" && !Array.isArray(overrides.identite) ? overrides.identite : {};
    return {
      markdown: readBoolean(overrides, "markdown", true),
      avatars: readBoolean(overrides, "avatars", true),
      horodatage: readBoolean(overrides, "horodatage", false),
      accueil: readString(overrides, "accueil", textParam(params, "texte_bienvenue")),
      placeholder: readString(overrides, "placeholder", textParam(params, "placeholder_message")),
      placeholderContact: textParam(params, "placeholder_contact"),
      suggestions,
      afficherSuggestions: readBoolean(overrides, "afficher_suggestions", true),
      suggestionsToujours: readBoolean(overrides, "suggestions_toujours", false),
      maxLength,
      entreeEnvoyer: boolParam(params, "entree_envoyer"),
      labelEnvoyer: textParam(params, "label_envoyer"),
      labelTerminer: textParam(params, "label_terminer"),
      messageVide: textParam(params, "message_vide"),
      labels,
      identity: {
        nomLabel: readString(identityOverrides, "nom_label", labels.nom),
        nomPlaceholder: readString(identityOverrides, "nom_placeholder", labels.nom_placeholder),
        emailLabel: readString(identityOverrides, "email_label", labels.email),
        emailPlaceholder: readString(identityOverrides, "email_placeholder", labels.email_placeholder),
        submitLabel: readString(identityOverrides, "submit_label", labels.demarrer),
        hint: readString(identityOverrides, "hint", labels.identity_hint),
      },
    };
  }

  isMedia(media) {
    return media && typeof media === "object" && typeof media.url === "string" && media.url.trim() !== "" && (media.type === "photo" || media.type === "lien");
  }
  isAttachment(a) {
    return a && typeof a === "object" && typeof a.id === "string" && typeof a.originalName === "string";
  }

  normalizeMessages(messages) {
    if (!Array.isArray(messages)) return [];
    return messages
      .filter((message) => message !== null && typeof message === "object")
      .map((message, index) => ({
        ...message,
        id: typeof message.id === "string" && message.id !== "" ? message.id : `message-${index}`,
        role: message.role === "user" ? "user" : "assistant",
        content: typeof message.content === "string" ? message.content : "",
        medias: Array.isArray(message.medias) ? message.medias.filter((m) => this.isMedia(m)) : [],
        attachments: Array.isArray(message.attachments) ? message.attachments.filter((a) => this.isAttachment(a)) : [],
      }));
  }

  hasUserMessage(messages) { return messages.some((message) => message.role === "user"); }
  shouldShowSuggestions(chat, messages) {
    if (!chat.afficherSuggestions || chat.suggestions.length === 0) return false;
    return chat.suggestionsToujours || !this.hasUserMessage(messages);
  }
  formatTime(value, locale = "fr") {
    if (typeof value !== "string" || value.trim() === "") return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    try { return new Intl.DateTimeFormat(locale || "fr", { hour: "2-digit", minute: "2-digit" }).format(date); } catch { return ""; }
  }
  formatBytes(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value < 0) return "";
    if (value < 1024) return `${value} o`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} Ko`;
    return `${(value / (1024 * 1024)).toFixed(1)} Mo`;
  }
  userStateLabel(state) {
    switch (state?.label) { case "content": return "Content"; case "triste": return "Triste"; default: return "Neutre"; }
  }
  userStateIcon(state) {
    switch (state?.label) { case "content": return "smile"; case "triste": return "frown"; default: return "meh"; }
  }
}

export const chatSystem = new ChatSystem();

export function contactTypeFor(field) { return chatSystem.contactTypeFor(field); }
export function buildContact(field, rawValue) { return chatSystem.buildContact(field, rawValue); }
export function interpolate(text, ctx = {}) { return chatSystem.interpolate(text, ctx); }
export function parseSuggestions(value) { return chatSystem.parseSuggestions(value); }
export function normalizeChatConfig(params = {}) { return chatSystem.normalizeConfig(params); }
export function normalizeMessages(messages) { return chatSystem.normalizeMessages(messages); }
export function hasUserMessage(messages) { return chatSystem.hasUserMessage(messages); }
export function shouldShowSuggestions(chat, messages) { return chatSystem.shouldShowSuggestions(chat, messages); }
export function formatTime(value, locale = "fr") { return chatSystem.formatTime(value, locale); }
export function formatBytes(bytes) { return chatSystem.formatBytes(bytes); }
export function userStateLabel(state) { return chatSystem.userStateLabel(state); }
export function userStateIcon(state) { return chatSystem.userStateIcon(state); }

export { MAX_MESSAGE, MAX_SUGGESTIONS };
