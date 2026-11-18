#!/usr/bin/env node
// Contrôle navigateur du template sur le harness MOCK : élément monté dans le
// Shadow DOM, identité → chat, suggestions, galerie, pièces jointes, Markdown,
// mise à jour live des paramètres, finish, menu de secours et aucune requête
// sortante. Le 404 favicon.ico du harness est sans impact.
//
// Usage : node harness/host.mjs --dir .   (terminal 1, déjà lancé par npm run dev)
//         node tools/browser-check.mjs    (terminal 2)
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const executablePath = CHROME_CANDIDATES.find((path) => existsSync(path));
if (!executablePath) {
  console.error("Aucun Chrome/Edge trouvé (variable CHROME_PATH).");
  process.exit(2);
}

const BASE_URL = process.env.HARNESS_URL ?? "http://localhost:4500/";
const ELEMENT = "onirtech-template-pop-design";
const failures = [];
const notes = [];

const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 960 });

const pageErrors = [];
const notFound = [];
const externalRequests = new Set();
page.on("pageerror", (error) => pageErrors.push(String(error.message ?? error)));
page.on("response", (response) => {
  if (response.status() === 404) notFound.push(response.url());
});
page.on("request", (request) => {
  try {
    const url = new URL(request.url());
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    if (["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)) return;
    externalRequests.add(request.url());
  } catch {
    // URL non analysable : ignorée (data:, blob:, etc.).
  }
});
page.on("console", (message) => {
  const text = message.text();
  const url = message.location()?.url ?? "";
  const isFavicon = url.includes("favicon") || text.includes("favicon");
  if (message.type() === "error" && !isFavicon) pageErrors.push(`console: ${text} (${url})`);
});

const step = async (label, fn) => {
  try {
    const result = await fn();
    if (result === false) failures.push(label);
    else if (typeof result === "string") notes.push(`${label} — ${result}`);
    else notes.push(label);
  } catch (error) {
    failures.push(`${label} (${error.message})`);
  }
};

const inShadow = (fn, ...args) => page.evaluate(fn, ...args);
const shadowText = () =>
  inShadow((element) => document.querySelector(element)?.shadowRoot?.textContent ?? "", ELEMENT);
const count = (selector) =>
  inShadow(
    (element, sel) =>
      document.querySelector(element)?.shadowRoot?.querySelectorAll(sel).length ?? 0,
    ELEMENT,
    selector,
  );
const exists = async (selector) => (await count(selector)) > 0;
const click = (selector, index = 0) =>
  inShadow(
    (element, sel, i) => {
      document.querySelector(element)?.shadowRoot?.querySelectorAll(sel)?.[i]?.click();
    },
    ELEMENT,
    selector,
    index,
  );
const clickButton = (label) =>
  inShadow(
    (element, value) => {
      const root = document.querySelector(element)?.shadowRoot;
      [...(root?.querySelectorAll("button") ?? [])]
        .find((button) => button.textContent.includes(value))
        ?.click();
    },
    ELEMENT,
    label,
  );
const waitForSelector = (selector, timeout = 5000) =>
  page.waitForFunction(
    (element, sel) => Boolean(document.querySelector(element)?.shadowRoot?.querySelector(sel)),
    { timeout },
    ELEMENT,
    selector,
  );
const waitForText = (value, timeout = 8000) =>
  page.waitForFunction(
    (element, needle) =>
      (document.querySelector(element)?.shadowRoot?.textContent ?? "").includes(needle),
    { timeout },
    ELEMENT,
    value,
  );
const send = (message) =>
  inShadow(
    (element, value) => {
      const root = document.querySelector(element)?.shadowRoot;
      const form = root?.querySelector("form.pop-composer");
      const textarea = form?.querySelector("textarea");
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(textarea, value);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      form.querySelector('button[type="submit"]').click();
    },
    ELEMENT,
    message,
  );

await page.goto(BASE_URL, { waitUntil: "networkidle0" });

await step("élément monté dans un Shadow DOM ouvert", async () => {
  const state = await inShadow((element) => {
    const el = document.querySelector(element);
    return { exists: Boolean(el), shadow: Boolean(el?.shadowRoot) };
  }, ELEMENT);
  if (!state.exists || !state.shadow) return false;
});

await step("phase identity : formulaire d'identité affiché", async () =>
  exists("form.pop-identity"),
);

await step("identité → chat (le hôte bascule la phase)", async () => {
  await inShadow((element) => {
    const root = document.querySelector(element).shadowRoot;
    const form = root.querySelector("form.pop-identity");
    const set = (selector, value) => {
      const input = form.querySelector(selector);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    set('[name="nom"]', "Ada Lovelace");
    set('[name="email"]', "ada@exemple.mg");
    form.querySelector('[name="consentement"]').checked = true;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  }, ELEMENT);
  await waitForSelector(".pop-chat");
  const text = await shadowText();
  if (!text.includes("Bonjour Ada Lovelace")) return false;
  return "message d'accueil reçu";
});

await step("4 tuiles du design Pop présentes", async () => {
  const total = await count(".tile");
  return total === 4 ? "Bienvenue / Équipe / Réalisations / Contact" : false;
});

await step("suggestions de départ visibles avant le premier message", async () => {
  const total = await count(".suggestion");
  return total === 4 ? "4 suggestions" : false;
});

await step("pop-up d'une tuile ouvre puis se ferme", async () => {
  await click(".tile", 2);
  await waitForSelector(".pop-panel");
  const gallery = await count(".gallery__thumb");
  if (gallery === 0) return false;
  await click(".pop-panel__close");
  const closed = !(await exists(".pop-panel"));
  return closed ? `${gallery} photos + fermeture OK` : false;
});

await step("pièce jointe chargée puis affichée en attente", async () => {
  if (!(await exists(".composer__file-input"))) return false;
  await inShadow((element) => {
    const input = document
      .querySelector(element)
      .shadowRoot.querySelector(".composer__file-input");
    const transfer = new DataTransfer();
    transfer.items.add(new File(["bonjour"], "note.txt", { type: "text/plain" }));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, ELEMENT);
  await waitForSelector(".composer__chip");
  const text = await shadowText();
  return text.includes("note.txt") ? "note.txt en attente" : false;
});

await step("envoi avec pièce jointe → typing → réponse", async () => {
  await send("Voici mon dossier.");
  const typingCaught = await exists(".msg--typing");
  await waitForSelector(".msg__attachment");
  await waitForText("(mock) Merci, noté");
  const text = await shadowText();
  if (!text.includes("note.txt")) return false;
  return typingCaught ? "typing observable + pièce jointe dans le fil" : "pièce jointe dans le fil";
});

await step("réponse Markdown rendue (gras, liste, code, citation, lien)", async () => {
  const [strong, items, code, quote, links] = await inShadow(
    (element) => {
      const root = document.querySelector(element).shadowRoot;
      return [
        root.querySelectorAll(".msg .md strong").length,
        root.querySelectorAll(".msg .md-list li").length,
        root.querySelectorAll(".msg .md-pre code").length,
        root.querySelectorAll(".msg .md-quote").length,
        root.querySelectorAll('.msg .md a[href^="https://"]').length,
      ];
    },
    ELEMENT,
  );
  if (strong === 0 || items === 0 || code === 0 || quote === 0 || links === 0) return false;
  return "Markdown complet";
});

await step("suggestions masquées après le premier message", async () => {
  const total = await count(".suggestion");
  return total === 0 ? "masquées" : false;
});

await step("paramètres live : titre, design et tuiles personnalisées", async () => {
  await inShadow((element) => {
    const mock = window.__mock;
    mock.ctx.params.titre = "Titre injecté";
    mock.ctx.params.design_json = JSON.stringify({
      accent: "#ff0055",
      rayon: 9,
      espacement: 14,
    });
    mock.ctx.params.tuiles_json = JSON.stringify([
      {
        id: "faq",
        type: "text",
        icone: "book",
        libelle: "FAQ",
        titre: "Questions fréquentes",
        texte: "**Réponse** claire",
      },
    ]);
    mock.render();
  }, ELEMENT);

  await page.waitForFunction(
    (element) =>
      document.querySelector(element)?.shadowRoot?.querySelector("h1")?.textContent ===
      "Titre injecté",
    { timeout: 5000 },
    ELEMENT,
  );

  const state = await inShadow((element) => {
    const root = document.querySelector(element).shadowRoot;
    const pop = root.querySelector(".pop");
    return {
      accent: pop.style.getPropertyValue("--pop-accent"),
      radius: pop.style.getPropertyValue("--pop-radius"),
      tiles: root.querySelectorAll(".tile").length,
      label: root.querySelector(".tile")?.textContent ?? "",
    };
  }, ELEMENT);

  if (state.accent !== "#ff0055" || state.radius !== "9px") return false;
  if (state.tiles !== 1 || !state.label.includes("FAQ")) return false;

  await click(".tile", 0);
  await waitForSelector(".pop-panel");
  const panel = await inShadow((element) => {
    const root = document.querySelector(element).shadowRoot;
    return {
      title: root.querySelector(".pop-panel .pop-card__title")?.textContent ?? "",
      strong: root.querySelector(".pop-panel strong")?.textContent ?? "",
    };
  }, ELEMENT);
  await click(".pop-panel__close");
  if (panel.title !== "Questions fréquentes" || panel.strong !== "Réponse") return false;
  return "titre + tokens CSS + tuile/panneau";
});

const shot = join(tmpdir(), "opencode", "pop-design-harness.png");
mkdirSync(join(tmpdir(), "opencode"), { recursive: true });
await page.screenshot({ path: shot });

await step("finish → discussion finalisée (bouton et saisie verrouillés)", async () => {
  await clickButton("Terminer");
  await waitForText("Discussion terminée");
  const locked = await inShadow((element) => {
    const root = document.querySelector(element).shadowRoot;
    const finish = [...root.querySelectorAll("button")].find((button) =>
      button.textContent.includes("Terminer"),
    );
    return finish.disabled && root.querySelector("form.pop-composer textarea").disabled;
  }, ELEMENT);
  return locked ? "terminé puis verrouillé" : false;
});

const fallbackUrl = new URL(BASE_URL);
fallbackUrl.searchParams.set("phase", "chat");
fallbackUrl.searchParams.set("fallback", "1");

await step("menu de secours : choix d'une question", async () => {
  await page.goto(fallbackUrl.href, { waitUntil: "networkidle0" });
  await waitForSelector(".chat-fallback__option");
  const options = await count(".chat-fallback__option");
  if (options === 0) return false;
  await click(".chat-fallback__option", 0);
  await waitForText("Réponse de secours (mock)");
  const text = await shadowText();
  if (!text.includes("Quels sont vos services ?")) return false;
  return `${options} questions, réponse heuristique affichée`;
});

await step("menu de secours : formulaire de collecte", async () => {
  await page.goto(fallbackUrl.href, { waitUntil: "networkidle0" });
  await waitForSelector(".chat-fallback__collection");
  await click(".chat-fallback__collection");
  await waitForText("formulaire de collecte");
  return "action openCollectionForm transmise";
});

const realNotFound = notFound.filter((url) => !url.includes("favicon"));
if (notFound.length && realNotFound.length === 0) {
  notes.push(`404 ignoré (sans impact) : ${notFound.join(", ")}`);
}
if (pageErrors.length) failures.push(`erreurs page : ${pageErrors.join(" | ")}`);
if (realNotFound.length) failures.push(`ressources 404 : ${realNotFound.join(" | ")}`);
if (externalRequests.size) {
  failures.push(`requêtes externes inattendues : ${[...externalRequests].join(" | ")}`);
}
await browser.close();

for (const note of notes) console.log(`✓ ${note}`);
if (failures.length) {
  for (const failure of failures) console.error(`✗ ${failure}`);
  console.error(`Capture : ${shot}`);
  process.exit(1);
}
console.log(`✓ Tous les contrôles navigateur passent. Capture : ${shot}`);
