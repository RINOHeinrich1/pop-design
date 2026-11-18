// Tests du widget flottant : lanceur, accueil avec amorces, menu d'options.

import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockContext, mountTemplate } from "@onirtech/template-sdk/testing";
import "../src/widget.js";

const ELEMENT = "onirtech-widget-pop-design";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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
const click = (element) => {
  act(() => {
    element.click();
  });
};

const widgetCtx = (overrides = {}) =>
  createMockContext({
    surface: "widget",
    state: { phase: "chat", messages: [] },
    ...overrides,
  });

afterEach(() => {
  while (mounts.length > 0) {
    const { unmount } = mounts.pop();
    act(() => unmount());
  }
});

describe("widget flottant", () => {
  it("ouvre le panneau et propose les amorces par défaut", () => {
    const { el } = mount(widgetCtx());

    const launcher = root(el).querySelector(".widget-launcher");
    expect(launcher).toBeTruthy();
    click(launcher);

    expect(root(el).querySelector(".widget-panel")).toBeTruthy();
    const welcome = root(el).querySelector(".widget-welcome");
    expect(welcome).toBeTruthy();
    expect(welcome.textContent).toContain("Bonjour");
    expect([...welcome.querySelectorAll(".suggestion")].map((item) => item.textContent)).toEqual([
      "Découvrir les services",
      "Demander un devis",
      "Parler à un conseiller",
    ]);
  });

  it("envoie une amorce au clic", () => {
    const sendMessage = vi.fn();
    const { el } = mount(widgetCtx({ actions: { sendMessage } }));

    click(root(el).querySelector(".widget-launcher"));
    click(root(el).querySelector(".widget-welcome .suggestion"));

    expect(sendMessage).toHaveBeenCalledWith("Découvrir les services");
  });

  it("expose Terminer et Fermer dans le menu d'options", () => {
    const finish = vi.fn();
    const { el } = mount(widgetCtx({ actions: { finish } }));

    click(root(el).querySelector(".widget-launcher"));
    click(root(el).querySelector(".widget-action"));

    const items = [...root(el).querySelectorAll(".widget-menu__item")];
    expect(items.map((item) => item.textContent)).toEqual(["Terminer", "Fermer"]);
    click(items[0]);
    expect(finish).toHaveBeenCalledTimes(1);
  });
});
