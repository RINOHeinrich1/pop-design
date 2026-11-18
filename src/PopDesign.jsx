// Template « 2097 Pop » — composition root.
//
// Le composant ne contient que l'orchestration : il lit le contexte hôte,
// construit le modèle d'interface (`createUiModel`) puis assemble des
// composants indépendants. Aucune requête réseau : toute sortie passe par
// `actions`, toute entrée vient du contexte.

import { useEffect, useMemo, useRef, useState } from "react";
import { useTemplate } from "@onirtech/template-sdk/react";
import { Chat } from "./components/Chat.jsx";
import { Footer } from "./components/Footer.jsx";
import { Header } from "./components/Header.jsx";
import { IdentityForm } from "./components/IdentityForm.jsx";
import { Panel } from "./components/Panel.jsx";
import { Tiles } from "./components/Tiles.jsx";
import { MAX_MESSAGE, normalizeMessages } from "./core/chat.js";
import { createUiModel } from "./core/ui.js";
import { Icon } from "./Icon.jsx";

const EMPTY_MEDIA = { photos: [], liens: [] };

function isMediaResources(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    Array.isArray(value.photos) &&
    Array.isArray(value.liens)
  );
}

export function PopDesign() {
  const { ctx, phase, messages, params, capabilities, actions } = useTemplate();
  const model = useMemo(
    () => createUiModel(ctx, params, capabilities),
    [ctx, params, capabilities],
  );
  const normalizedMessages = useMemo(() => normalizeMessages(messages), [messages]);

  const [panelId, setPanelId] = useState(null);
  const [contactDraft, setContactDraft] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [media, setMedia] = useState(() => ctx.resources?.media ?? EMPTY_MEDIA);
  const panelRef = useRef(null);

  const typing = Boolean(ctx.state?.typing);
  const finished = ctx.state?.status === "finalisee";
  const locked = typing || finished;
  const modelFields = Array.isArray(ctx.resources?.modelForm) ? ctx.resources.modelForm : [];
  const pendingAttachments = Array.isArray(ctx.state?.pendingAttachments)
    ? ctx.state.pendingAttachments
    : [];
  const fallback = ctx.state?.fallback ?? null;
  const panel =
    panelId === null ? null : model.panels.find((entry) => entry.id === panelId) ?? null;

  // Les médias peuvent être chargés après le premier rendu (photothèque).
  useEffect(() => {
    setMedia(ctx.resources?.media ?? EMPTY_MEDIA);
  }, [ctx.resources?.media]);

  // Une tuile retirée par paramètre ne doit pas laisser un panneau orphelin.
  useEffect(() => {
    if (panelId !== null && panel === null) setPanelId(null);
  }, [panelId, panel]);

  // Panneau : fermeture par Échap + focus initial.
  useEffect(() => {
    if (panelId === null) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setPanelId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    panelRef.current?.focus();
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [panelId]);

  const sendMessage = (text, attachmentIds = []) => {
    const value = String(text ?? "").trim();
    if (locked) return false;
    if (value.length > MAX_MESSAGE) return false;
    const ids = Array.isArray(attachmentIds)
      ? attachmentIds.filter((id) => typeof id === "string" && id !== "")
      : [];
    if (value === "" && ids.length === 0) return false;
    // Le second argument n'est transmis que s'il y a réellement une pièce
    // jointe : le harness et certains hôtes n'exposent qu'un seul paramètre.
    if (ids.length > 0) actions.sendMessage(value, ids);
    else actions.sendMessage(value);
    return true;
  };

  const submitIdentity = (event) => {
    event.preventDefault();
    if (phase !== "identity") return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const nom = String(data.get("nom") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    if (nom === "" || email === "") return;

    const identity = { nom, email };
    if (ctx.consent) identity.consentement = data.get("consentement") === "on";
    actions.submitIdentity(identity);
  };

  const openTile = (id) => {
    setContactDraft("");
    setPanelId(id);
    setNavOpen(false);
  };

  const finish = () => {
    if (!finished) actions.finish();
  };

  const requestMedia = async () => {
    try {
      const value = await actions.request("media");
      if (isMediaResources(value)) setMedia(value);
    } catch {
      // La galerie reste sur son état courant ; l'hôte journalise l'erreur.
    }
  };

  const backgroundImage = `url(${JSON.stringify(model.content.background)})`;

  return (
    <div
      className={`pop ${model.design.className} ${phase === "chat" ? "pop--chat-dominant" : "pop--entry"}`}
      style={model.design.vars}
      data-phase={phase}
      data-ambiance={model.design.ambiance}
      aria-busy={typing ? "true" : undefined}
    >
      {model.content.elements?.background?.visible !== false ? (
        <div className="pop-bg" style={{ backgroundImage }} aria-hidden="true" />
      ) : null}

      <Header content={model.content} />
      <div className="pop-mobile-nav">
        <button
          type="button"
          className="pop-mobile-nav__toggle"
          onClick={() => setNavOpen((v) => !v)}
          aria-expanded={navOpen}
          aria-controls="pop-mobile-menu"
        >
          <Icon name={navOpen ? "close" : "home"} size={18} />
          <span>Menu</span>
        </button>
        {navOpen ? (
          <div className="pop-mobile-nav__menu" id="pop-mobile-menu">
            <Tiles
              tiles={model.tiles}
              onOpen={openTile}
              galleryCount={Array.isArray(media.photos) ? media.photos.length : 0}
            />
          </div>
        ) : null}
      </div>
      <div className="pop-layout">
        <aside className="pop-col pop-col--side pop-sidebar" aria-label="Navigation">
          <Tiles
            tiles={model.tiles}
            onOpen={openTile}
            galleryCount={Array.isArray(media.photos) ? media.photos.length : 0}
          />
        </aside>

        <main className="pop-col pop-col--main pop-main">
          {phase === "identity" ? (
            <IdentityForm
              content={model.content}
              chat={model.chat}
              consent={ctx.consent}
              onSubmit={submitIdentity}
            />
          ) : (
            <Chat
              model={model}
              messages={normalizedMessages}
              typing={typing}
              finished={finished}
              fallback={fallback}
              pendingAttachments={pendingAttachments}
              modelFields={modelFields}
              onSend={sendMessage}
              onFinish={finish}
              actions={actions}
            />
          )}
        </main>
      </div>

      {model.content.elements?.footer?.visible !== false ? (
        <Footer content={model.content} chat={model.chat} />
      ) : null}

      {panel ? (
        <Panel
          panel={panel}
          media={media}
          capabilities={capabilities}
          chat={model.chat}
          contactDraft={contactDraft}
          setContactDraft={setContactDraft}
          onSend={sendMessage}
          onClose={() => setPanelId(null)}
          locked={locked}
          onOpenMedia={(url) => {
            if (typeof url === "string" && url !== "") actions.openMedia(url);
          }}
          onRequestMedia={requestMedia}
          panelRef={panelRef}
          content={model.content}
        />
      ) : null}
    </div>
  );
}
