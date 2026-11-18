// Tests de rendu du template monté dans son web-component : identité, chat,
// Markdown, pièces jointes, secours, tuiles/panneaux, design et pied de page.

import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockContext, mountTemplate } from "@onirtech/template-sdk/testing";
import "../src/index.js";

const ELEMENT = "onirtech-template-pop-design";
const TILES_JSON = JSON.stringify([
  { id: "welcome", type: "welcome", icone: "home", libelle: "Bienvenue", description: "Présentation" },
  { id: "equipe", type: "team", icone: "users", libelle: "Notre équipe", description: "Qui nous sommes" },
  { id: "realisations", type: "gallery", icone: "handshake", libelle: "Nos réalisations", description: "Galerie" },
  { id: "contact", type: "contact", icone: "comments", libelle: "Contact", description: "Écrire" },
]);

// React 19 : les mises à jour de test doivent être enveloppées dans `act`.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** Monte le vrai élément et tient la liste des démontages. */
const mounts = [];
const mount = (ctx) => {
  let out;
  act(() => {
    out = mountTemplate(ELEMENT, ctx);
  });
  mounts.push(out);
  return out;
};

const root = (el) => el.shadowRoot;
const text = (el) => root(el).textContent;
const tiles = (el) => [...root(el).querySelectorAll(".tile")];
const buttons = (el) => [...root(el).querySelectorAll("button")];
const buttonByText = (el, value) =>
  buttons(el).find((button) => button.textContent.includes(value));

/** Écrit la valeur d'un champ contrôlé React via le setter natif du prototype. */
const setNativeValue = (element, value) => {
  const proto =
    element instanceof window.HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(element, value);
  element.dispatchEvent(new window.Event("input", { bubbles: true }));
};

const typeInto = (element, value) => {
  act(() => setNativeValue(element, value));
};

const submit = (form) => {
  act(() => {
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  });
};

const click = (element) => {
  act(() => {
    element.click();
  });
};

const press = (target, key, init = {}) => {
  act(() => {
    target.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    );
  });
};

const chatCtx = (overrides = {}) => {
  const { state, ...rest } = overrides;
  return createMockContext({
    ...rest,
    state: {
      phase: "chat",
      messages: [
        { id: "m1", role: "assistant", content: "Bonjour, comment puis-je vous aider ?" },
        { id: "m2", role: "user", content: "Je cherche un devis." },
      ],
      ...state,
    },
  });
};

describe("identité et en-tête", () => {
  it("affiche le titre et le sous-titre interpolés", () => {
    const { el } = mount(
      createMockContext({
        params: {
          titre: "Album souvenirs",
          sous_titre: "Bienvenue chez {marque} — rubrique {lien}.",
        },
      }),
    );

    expect(root(el).querySelector("h1").textContent).toBe("Album souvenirs");
    expect(root(el).querySelector(".pop-subtitle").textContent).toBe(
      "Bienvenue chez ONIRTECH — rubrique Lien standard.",
    );
    expect(root(el).querySelector(".pop-underline")).toBeTruthy();
  });

  it("replie sur le titre par défaut quand le paramètre est absent", () => {
    const { el } = mount(createMockContext());
    // Sans paramètre backend fourni, aucun titre de démonstration n'est injecté.
    expect(root(el).querySelector("h1")?.textContent ?? "").toBe("");
  });

  it("soumet l'identité avec les champs modelForm et le consentement", () => {
    const submitIdentity = vi.fn();
    const { el } = mount(
      createMockContext({
        actions: { submitIdentity },
        resources: {
          modelForm: [
            { name: "sujet", label: "Sujet", type: "text", required: true },
            { name: "piece_jointe", label: "Pièce jointe", type: "file" },
          ],
        },
      }),
    );

    const form = root(el).querySelector("form.pop-identity");
    expect(form).toBeTruthy();
    typeInto(form.querySelector('[name="nom"]'), "Ada Lovelace");
    typeInto(form.querySelector('[name="email"]'), "ada@exemple.mg");
    act(() => {
      form.querySelector('[name="consentement"]').checked = true;
    });
    submit(form);

    expect(submitIdentity).toHaveBeenCalledWith({
      nom: "Ada Lovelace",
      email: "ada@exemple.mg",
      consentement: true,
    });
  });

  it("n'envoie pas l'identité sans nom ni email", () => {
    const submitIdentity = vi.fn();
    const { el } = mount(createMockContext({ actions: { submitIdentity } }));

    submit(root(el).querySelector("form.pop-identity"));
    expect(submitIdentity).not.toHaveBeenCalled();
  });

  it("masque le consentement quand le hôte ne le fournit pas", () => {
    const submitIdentity = vi.fn();
    const { el } = mount(
      createMockContext({ consent: null, actions: { submitIdentity } }),
    );

    const form = root(el).querySelector("form.pop-identity");
    expect(form.querySelector('[name="consentement"]')).toBeNull();

    typeInto(form.querySelector('[name="nom"]'), "Ada");
    typeInto(form.querySelector('[name="email"]'), "ada@exemple.mg");
    submit(form);

    expect(submitIdentity).toHaveBeenCalledWith({
      nom: "Ada",
      email: "ada@exemple.mg",
    });
  });
});

describe("chat", () => {
  it("passe du formulaire au chat à la mise à jour du contexte", () => {
    const { el, update } = mount(createMockContext());

    act(() => update(chatCtx()));
    expect(root(el).querySelector(".pop-chat")).toBeTruthy();
    expect(text(el)).toContain("Bonjour, comment puis-je vous aider ?");
  });

  it("affiche le fil de discussion (rôles + contenu)", () => {
    const { el } = mount(chatCtx());

    expect(root(el).querySelectorAll(".msg")).toHaveLength(2);
    expect(root(el).querySelector(".msg--assistant").textContent).toContain("Bonjour");
    expect(root(el).querySelector(".msg--user").textContent).toContain("devis");
  });

  it("envoie un message depuis le composer textarea", () => {
    const sendMessage = vi.fn();
    const { el } = mount(chatCtx({ actions: { sendMessage } }));

    const form = root(el).querySelector("form.pop-composer");
    const textarea = form.querySelector("textarea");
    expect(textarea).toBeTruthy();
    typeInto(textarea, "Quels sont vos délais ?");
    submit(form);

    expect(sendMessage).toHaveBeenCalledWith("Quels sont vos délais ?");
    expect(form.querySelector("textarea").value).toBe("");
  });

  it("Entrée envoie le message par défaut", () => {
    const sendMessage = vi.fn();
    const { el } = mount(chatCtx({ actions: { sendMessage } }));
    const textarea = root(el).querySelector("form.pop-composer textarea");

    typeInto(textarea, "Bonjour");
    press(textarea, "Enter");

    expect(sendMessage).toHaveBeenCalledWith("Bonjour");
    expect(textarea.value).toBe("");
  });

  it("Maj+Entrée n'envoie pas le message", () => {
    const sendMessage = vi.fn();
    const { el } = mount(chatCtx({ actions: { sendMessage } }));
    const textarea = root(el).querySelector("form.pop-composer textarea");

    typeInto(textarea, "Première ligne");
    press(textarea, "Enter", { shiftKey: true });

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("Ctrl+Entrée envoie quand Entrée est désactivée", () => {
    const sendMessage = vi.fn();
    const { el } = mount(
      chatCtx({
        actions: { sendMessage },
        params: { entree_envoyer: false },
      }),
    );
    const textarea = root(el).querySelector("form.pop-composer textarea");

    typeInto(textarea, "Bonjour");
    press(textarea, "Enter");
    expect(sendMessage).not.toHaveBeenCalled();

    press(textarea, "Enter", { ctrlKey: true });
    expect(sendMessage).toHaveBeenCalledWith("Bonjour");
  });

  it("bloque le composer pendant le typing et affiche l'indicateur", () => {
    const { el } = mount(chatCtx({ state: { typing: true } }));

    expect(root(el).querySelector(".msg--typing")).toBeTruthy();
    expect(root(el).querySelector("form.pop-composer textarea").disabled).toBe(true);
    expect(root(el).querySelector('form.pop-composer button[type="submit"]').disabled).toBe(true);
    expect(root(el).querySelector(".pop").getAttribute("aria-busy")).toBe("true");
  });

  it("n'envoie rien pendant le typing", () => {
    const sendMessage = vi.fn();
    const { el } = mount(
      chatCtx({ actions: { sendMessage }, state: { typing: true } }),
    );

    const form = root(el).querySelector("form.pop-composer");
    typeInto(form.querySelector("textarea"), "Test");
    submit(form);

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("termine la discussion puis verrouille la saisie", () => {
    const finish = vi.fn();
    const { el, update } = mount(chatCtx({ actions: { finish } }));

    click(buttonByText(el, "Terminer"));
    expect(finish).toHaveBeenCalledTimes(1);

    act(() => {
      update(chatCtx({ state: { status: "finalisee" } }));
    });

    const after = buttonByText(el, "Terminer");
    expect(after.disabled).toBe(true);
    expect(text(el)).toContain("Discussion terminée");
    const textarea = root(el).querySelector("form.pop-composer textarea");
    expect(textarea.disabled).toBe(true);
    expect(textarea.getAttribute("placeholder")).toBe("Discussion terminée");
  });
});

describe("accueil, suggestions et secours", () => {
  it("affiche l'accueil et les suggestions quand le fil est vide", () => {
    const { el } = mount(
      chatCtx({
        state: { messages: [] },
        params: {
          texte_bienvenue: "Bonjour {marque}, bienvenue.",
          suggestions: "Q1\nQ2\nQ3\nQ4",
        },
      }),
    );

    expect(root(el).querySelector(".chat-empty")).toBeTruthy();
    expect(root(el).querySelector(".chat-empty__text").textContent).toContain(
      "Bonjour ONIRTECH, bienvenue.",
    );
    expect(root(el).querySelectorAll(".suggestion")).toHaveLength(4);
  });

  it("une suggestion envoie immédiatement son texte", () => {
    const sendMessage = vi.fn();
    const { el } = mount(
      chatCtx({
        actions: { sendMessage },
        state: { messages: [] },
        params: { suggestions: "Une question\nUne autre question" },
      }),
    );

    click(root(el).querySelector(".suggestion"));
    expect(sendMessage).toHaveBeenCalledWith("Une question");
  });

  it("masque les suggestions après le premier message du visiteur", () => {
    const { el } = mount(chatCtx());
    expect(root(el).querySelector(".suggestion")).toBeNull();
  });

  it("rend le menu de secours et renvoie le choix à l'hôte", () => {
    const selectFallback = vi.fn();
    const openCollectionForm = vi.fn();
    const { el } = mount(
      chatCtx({
        actions: { selectFallback, openCollectionForm },
        state: {
          fallback: {
            intro: "Choisissez une question :",
            questions: [
              { id: "q1", label: "Question une" },
              { id: "q2", label: "Question deux" },
            ],
            showCollectionForm: true,
          },
        },
      }),
    );

    const fallback = root(el).querySelector(".chat-fallback");
    expect(fallback).toBeTruthy();
    expect(fallback.textContent).toContain("Choisissez une question");

    click(buttonByText(el, "Question une"));
    expect(selectFallback).toHaveBeenCalledWith("q1");

    click(buttonByText(el, "Être rappelé"));
    expect(openCollectionForm).toHaveBeenCalledTimes(1);
  });

  it("ignore un menu de secours sans question ni formulaire", () => {
    const { el } = mount(
      chatCtx({ state: { fallback: { intro: "Rien", questions: [] } } }),
    );
    expect(root(el).querySelector(".chat-fallback")).toBeNull();
  });
});

describe("Markdown, connaissance et état", () => {
  it("rend le Markdown sans injecter de HTML", () => {
    const content =
      "**Gras** [doc](https://example.com/doc)\n\n- un\n- deux\n\n<script>alert(1)</script>";
    const { el } = mount(
      chatCtx({
        state: {
          messages: [{ id: "m1", role: "assistant", content }],
        },
      }),
    );

    const bubble = root(el).querySelector(".msg--assistant");
    expect(bubble.querySelector("strong").textContent).toBe("Gras");
    expect(bubble.querySelectorAll(".md-list li")).toHaveLength(2);
    expect(bubble.querySelector("script")).toBeNull();

    const anchors = [...bubble.querySelectorAll("a")];
    expect(anchors).toHaveLength(1);
    expect(anchors[0].getAttribute("href")).toBe("https://example.com/doc");
    expect(anchors[0].getAttribute("rel")).toContain("noopener");
    expect(bubble.textContent).toContain("<script>alert(1)</script>");
  });

  it("respecte chat_json.markdown = false", () => {
    const { el } = mount(
      chatCtx({
        params: { chat_json: '{"markdown":false,"avatars":false}' },
        state: {
          messages: [{ id: "m1", role: "assistant", content: "**Gras**" }],
        },
      }),
    );

    const bubble = root(el).querySelector(".msg--assistant");
    expect(bubble.querySelector("strong")).toBeNull();
    expect(bubble.querySelector(".md--plain")).toBeTruthy();
    expect(bubble.textContent).toContain("**Gras**");
    expect(root(el).querySelector(".msg-row--assistant .avatar")).toBeNull();
  });

  it("affiche les sources de connaissance et l'état du visiteur", () => {
    const { el } = mount(
      chatCtx({
        state: {
          messages: [
            {
              id: "a1",
              role: "assistant",
              content: "Voici la réponse.",
              knowledge: [{ ref: "doc-1", titre: "Guide utilisateur" }],
            },
            {
              id: "u1",
              role: "user",
              content: "Merci, super !",
              userState: { label: "content", confidence: 0.82 },
            },
          ],
        },
      }),
    );

    const chip = root(el).querySelector(".knowledge-chip");
    expect(chip.textContent).toContain("Guide utilisateur");

    const state = root(el).querySelector(".msg__state");
    expect(state.textContent).toContain("Content");
    expect(state.getAttribute("title")).toContain("82 %");
  });
});

describe("pièces jointes", () => {
  it("charge une pièce jointe via attachFile", async () => {
    const attachFile = vi.fn(() => Promise.resolve());
    const { el } = mount(
      chatCtx({
        actions: { attachFile },
        resources: {
          modelForm: [
            {
              name: "piece_jointe",
              label: "Pièce jointe",
              type: "file",
              accept: ["image/*"],
              maxFiles: 2,
              maxBytes: 5 * 1024 * 1024,
            },
          ],
        },
      }),
    );

    const input = root(el).querySelector(".composer__file-input");
    expect(input).toBeTruthy();
    const file = new window.File(["bonjour"], "note.txt", { type: "text/plain" });
    Object.defineProperty(input, "files", { configurable: true, value: [file] });

    await act(async () => {
      input.dispatchEvent(new window.Event("change", { bubbles: true }));
    });

    expect(attachFile).toHaveBeenCalledTimes(1);
    expect(attachFile.mock.calls[0][0]).toBe("piece_jointe");
    expect(attachFile.mock.calls[0][1]).toBe(file);
  });

  it("affiche et retire les pièces jointes en attente", () => {
    const removeAttachment = vi.fn(() => Promise.resolve());
    const { el } = mount(
      chatCtx({
        actions: { removeAttachment },
        state: {
          pendingAttachments: [
            {
              id: "att-1",
              fieldName: "piece_jointe",
              originalName: "cv.pdf",
              sizeBytes: 2048,
            },
          ],
        },
        resources: { modelForm: [{ name: "piece_jointe", type: "file" }] },
      }),
    );

    const chip = root(el).querySelector(".composer__chip");
    expect(chip).toBeTruthy();
    expect(chip.textContent).toContain("cv.pdf");
    expect(chip.textContent).toContain("2.0 Ko");

    click(chip.querySelector(".composer__chip-remove"));
    expect(removeAttachment).toHaveBeenCalledWith("att-1");
  });

  it("masque la pièce jointe sans la capacité attachments", () => {
    const { el } = mount(
      chatCtx({
        capabilities: ["messages", "modelForm", "media", "theme"],
        resources: { modelForm: [{ name: "piece_jointe", type: "file" }] },
      }),
    );

    expect(root(el).querySelector(".composer__file-input")).toBeNull();
    expect(root(el).querySelector(".composer__icon-btn")).toBeNull();
  });
});

describe("tuiles et panneaux", () => {
  it("ouvre le pop-up Bienvenue puis le referme", () => {
    const { el } = mount(
      chatCtx({
        params: {
          tuiles_json: TILES_JSON,
          titre_welcome: "Bienvenue",
          texte_welcome: "Texte de test **pop-up**",
        },
      }),
    );

    expect(tiles(el)[0].textContent).toContain("Bienvenue");
    click(tiles(el)[0]);

    const panel = root(el).querySelector(".pop-panel");
    expect(panel).toBeTruthy();
    expect(panel.textContent).toContain("Texte de test");
    expect(panel.querySelector("strong").textContent).toBe("pop-up");

    click(root(el).querySelector(".pop-panel__close"));
    expect(root(el).querySelector(".pop-panel")).toBeNull();
  });

  it("ferme le panneau avec Échap", () => {
    const { el } = mount(chatCtx({ params: { tuiles_json: TILES_JSON, titre_welcome: "Bienvenue" } }));

    click(tiles(el)[0]);
    expect(root(el).querySelector(".pop-panel")).toBeTruthy();
    press(window, "Escape");
    expect(root(el).querySelector(".pop-panel")).toBeNull();
  });

  it("ouvre le panneau Équipe avec son portrait", () => {
    const { el } = mount(
      chatCtx({
        params: { tuiles_json: TILES_JSON, titre_equipe: "Notre équipe", texte_equipe: "Notre **équipe**." },
      }),
    );

    click(tiles(el)[1]);
    const panel = root(el).querySelector(".pop-panel--team");
    expect(panel).toBeTruthy();
    expect(panel.textContent).toContain("Notre");
    expect(panel.querySelector("strong").textContent).toBe("équipe");
    expect(panel.querySelector(".panel-img")).toBeTruthy();
  });

  it("alimente la galerie avec les médias du lien et ouvre via openMedia", () => {
    const openMedia = vi.fn();
    const { el } = mount(
      chatCtx({
        actions: { openMedia },
        params: { tuiles_json: TILES_JSON, titre_realisations: "Nos réalisations" },
        resources: {
          media: {
            photos: [
              { id: "p1", libelle: "Façade", url: "https://cdn.example/faade.jpg" },
            ],
            liens: [
              { id: "l1", libelle: "Documentation", url: "https://example.com/doc" },
            ],
          },
        },
      }),
    );

    click(tiles(el)[2]);
    const thumb = root(el).querySelector(".gallery__thumb");
    expect(thumb).toBeTruthy();
    click(thumb);
    expect(openMedia).toHaveBeenCalledWith("https://cdn.example/faade.jpg");

    const link = root(el).querySelector(".link-btn");
    expect(link.textContent).toContain("Documentation");
    click(link);
    expect(openMedia).toHaveBeenCalledWith("https://example.com/doc");
  });

  it("demande la capacité media quand la galerie est vide", () => {
    const request = vi.fn(() => Promise.resolve());
    const { el } = mount(
      chatCtx({
        actions: { request },
        params: { tuiles_json: TILES_JSON, titre_realisations: "Nos réalisations" },
        resources: { media: { photos: [], liens: [] } },
      }),
    );

    click(tiles(el)[2]);
    const button = [...root(el).querySelectorAll(".pop-panel button")].find((entry) =>
      entry.textContent.includes("Charger la galerie"),
    );
    expect(button).toBeTruthy();
    click(button);
    expect(request).toHaveBeenCalledWith("media");
  });

  it("envoie le formulaire du panneau Contact dans la discussion", () => {
    const sendMessage = vi.fn();
    const { el } = mount(
      chatCtx({
        actions: { sendMessage },
        params: { tuiles_json: TILES_JSON, titre_contact: "Contact", texte_contact: "Écrivez-nous." },
      }),
    );

    click(tiles(el)[3]);
    const form = root(el).querySelector(".panel-form");
    expect(form).toBeTruthy();
    typeInto(form.querySelector("textarea"), "Bonjour, un devis ?");
    submit(form);

    expect(sendMessage).toHaveBeenCalledWith("Bonjour, un devis ?");
    expect(root(el).querySelector(".pop-panel")).toBeNull();
  });

  it("personnalise les tuiles et les panneaux via tuiles_json", () => {
    const { el } = mount(
      chatCtx({
        params: {
          tuiles_json: JSON.stringify([
            { id: "accueil", type: "welcome", icone: "home", libelle: "Accueil" },
            {
              id: "faq",
              type: "text",
              icone: "book",
              libelle: "FAQ",
              titre: "Questions fréquentes",
              texte: "**Réponse** claire",
            },
          ]),
        },
      }),
    );

    expect(tiles(el)).toHaveLength(2);
    expect(tiles(el)[0].textContent).toContain("Accueil");
    expect(tiles(el)[1].textContent).toContain("FAQ");

    click(tiles(el)[1]);
    const panel = root(el).querySelector(".pop-panel");
    expect(panel.textContent).toContain("Questions fréquentes");
    expect(panel.querySelector("strong").textContent).toBe("Réponse");
  });
});

describe("design et images", () => {
  it("applique design_json aux variables CSS", () => {
    const { el } = mount(
      createMockContext({
        params: {
          design_json: JSON.stringify({
            accent: "#ff0055",
            rayon: 12,
            espacement: "18",
            police: "monospace",
          }),
        },
      }),
    );

    const pop = root(el).querySelector(".pop");
    expect(pop.style.getPropertyValue("--pop-accent")).toBe("#ff0055");
    expect(pop.style.getPropertyValue("--pop-radius")).toBe("12px");
    expect(pop.style.getPropertyValue("--pop-gap")).toBe("18px");
    expect(pop.style.getPropertyValue("--pop-font")).toBe("monospace");
  });

  it("ignore les surcharges design_json dangereuses", () => {
    const { el } = mount(
      createMockContext({
        params: {
          design_json:
            '{"accent":"red;background:url(x)","police":"x;}","--pop-shadow":"0;}"}',
        },
      }),
    );

    const pop = root(el).querySelector(".pop");
    expect(pop.style.getPropertyValue("--pop-accent")).toBe("#006599");
    expect(pop.style.getPropertyValue("--pop-font")).toContain("Open Sans");
    expect(pop.style.getPropertyValue("--pop-shadow")).not.toContain(";");
  });

  it("utilise la couleur d'accent du paramètre, puis celle du thème hôte", () => {
    const param = mount(
      createMockContext({ params: { couleur_accent: "#112233" } }),
    );
    expect(
      root(param.el).querySelector(".pop").style.getPropertyValue("--pop-accent"),
    ).toBe("#112233");

    const theme = mount(createMockContext({ theme: { primary: "#445566" } }));
    expect(
      root(theme.el).querySelector(".pop").style.getPropertyValue("--pop-accent"),
    ).toBe("#445566");
  });

  it("applique image_fond et refuse une URL d'image non sûre", () => {
    const { el } = mount(
      createMockContext({
        params: {
          image_fond: "https://cdn.example/fond.jpg",
          image_soulignement: "javascript:alert(1)",
          logo_url: "https://cdn.example/logo.png",
        },
      }),
    );

    expect(root(el).querySelector(".pop-bg").style.backgroundImage).toContain(
      "cdn.example/fond.jpg",
    );
    expect(root(el).querySelector(".pop-logo").getAttribute("src")).toBe(
      "https://cdn.example/logo.png",
    );
    expect(
      root(el).querySelector(".pop-underline").getAttribute("src"),
    ).not.toContain("javascript");
  });

  it("affiche les avatars fournis par paramètres", () => {
    const { el } = mount(
      chatCtx({
        params: {
          avatar_assistant_url: "https://cdn.example/bot.png",
          avatar_utilisateur_url: "https://cdn.example/me.png",
        },
      }),
    );

    expect(
      root(el).querySelector(".pop-chat__identity .avatar img").getAttribute("src"),
    ).toBe("https://cdn.example/bot.png");
    expect(
      root(el).querySelector(".msg-row--user .avatar img").getAttribute("src"),
    ).toBe("https://cdn.example/me.png");
  });
});

describe("pied de page", () => {
  it("affiche le crédit et l'année interpolée", () => {
    const { el } = mount(
      createMockContext({
        params: {
          afficher_credit: true,
          texte_footer: "© {annee} {marque}",
          lien_footer: "https://example.com/credit",
        },
      }),
    );
    const anchor = root(el).querySelector(".pop-footer a");
    expect(anchor).toBeTruthy();
    expect(anchor.textContent).toContain("Crédit");
    expect(anchor.getAttribute("href")).toBe("https://example.com/credit");
    expect(text(el)).toContain(String(new Date().getFullYear()));
  });

  it("masque le crédit quand afficher_credit est désactivé", () => {
    const { el } = mount(
      createMockContext({
        params: { afficher_credit: false, texte_footer: "© {annee} {marque}" },
      }),
    );

    expect(root(el).querySelector(".pop-footer a")).toBeNull();
    expect(text(el)).toContain(`© ${new Date().getFullYear()} ONIRTECH`);
  });
});

// Démontage à la fin de chaque test (évite les racines React résiduelles).
afterEach(() => {
  for (const entry of mounts.splice(0)) {
    act(() => entry.unmount?.());
  }
});
