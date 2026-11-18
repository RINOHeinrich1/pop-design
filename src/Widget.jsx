import { useEffect, useMemo, useRef, useState } from "react";
import { useTemplate } from "@onirtech/template-sdk/react";
import { Chat } from "./components/Chat.jsx";
import { IdentityForm } from "./components/IdentityForm.jsx";
import { Icon } from "./Icon.jsx";
import { Avatar } from "./components/Avatar.jsx";
import { MAX_MESSAGE, normalizeMessages } from "./core/chat.js";
import { createUiModel } from "./core/ui.js";

export function Widget() {
  const { ctx, phase, messages, params, capabilities, actions } = useTemplate();
  const model = useMemo(() => createUiModel(ctx, params, capabilities), [ctx, params, capabilities]);
  const normalizedMessages = useMemo(() => normalizeMessages(messages), [messages]);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const panelRef = useRef(null);
  const menuRef = useRef(null);

  const typing = Boolean(ctx.state?.typing);
  const finished = ctx.state?.status === "finalisee";
  const locked = typing || finished;
  const modelFields = Array.isArray(ctx.resources?.modelForm) ? ctx.resources.modelForm : [];
  const pendingAttachments = Array.isArray(ctx.state?.pendingAttachments) ? ctx.state.pendingAttachments : [];
  const fallback = ctx.state?.fallback ?? null;

  useEffect(() => {
    if (open) {
      actions.openWidget?.({ width: 420, height: 680 });
      const focusComposer = () => panelRef.current?.querySelector("textarea, input")?.focus();
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(focusComposer);
      else focusComposer();
    } else {
      actions.closeWidget?.();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Menu d'options : fermeture au clic extérieur et à Échap. Échap ferme
  // d'abord le menu, puis le widget au second appui.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!menuOpen) return;
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      if (!path.includes(menuRef.current)) setMenuOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (menuOpen) {
        setMenuOpen(false);
        return;
      }
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, menuOpen]);

  const sendMessage = (text, attachmentIds = []) => {
    const value = String(text ?? "").trim();
    if (locked) return false;
    if (value.length > MAX_MESSAGE) return false;
    const ids = Array.isArray(attachmentIds) ? attachmentIds.filter((id) => typeof id === "string" && id !== "") : [];
    if (value === "" && ids.length === 0) return false;
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

  const finish = () => {
    setMenuOpen(false);
    if (!finished) actions.finish();
  };

  const closeWidget = () => {
    setMenuOpen(false);
    setOpen(false);
  };

  const brand = model.content.brandName || model.content.title || "Assistant";
  const avatarUrl = model.content.avatarAssistant || model.content.logo || null;
  const status = finished
    ? model.chat.labels.discussion_terminee
    : typing
      ? model.chat.labels.en_train_ecrire
      : model.chat.labels.en_ligne;
  const backgroundVisible = model.content.elements?.background?.visible !== false;
  const backgroundImage = `url(${JSON.stringify(model.content.background)})`;

  if (!open) {
    return (
      <div className="pop pop-widget pop-widget--closed" style={model.design.vars}>
        <button
          type="button"
          className="widget-launcher"
          aria-label={`Discuter avec ${brand}`}
          aria-haspopup="dialog"
          aria-expanded="false"
          title={`Discuter avec ${brand}`}
          onClick={() => setOpen(true)}
        >
          <Avatar url={avatarUrl} label={brand} icon={avatarUrl ? undefined : "comments"} size={32} className="avatar--assistant" />
          <span className="widget-launcher__dot" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`pop pop-widget pop-widget--open ${model.design.className}`}
      style={model.design.vars}
      data-phase={phase}
      data-ambiance={model.design.ambiance}
      ref={panelRef}
    >
      <section className="widget-panel" role="dialog" aria-label={brand}>
        {backgroundVisible ? (
          <div className="widget-bg" style={{ backgroundImage }} aria-hidden="true" />
        ) : null}

        <header className="widget-head">
          <span className="widget-head__avatar-wrap">
            <Avatar url={avatarUrl} label={brand} icon={avatarUrl ? undefined : "comments"} size={40} className="avatar--assistant" />
            <i className={`widget-head__online ${finished ? "is-offline" : ""}`} aria-hidden="true" />
          </span>
          <div className="widget-head__id">
            <strong className="widget-head__name">{brand}</strong>
            <span className={`widget-head__status ${typing ? "is-typing" : ""} ${finished ? "is-finished" : ""}`}>
              {status}
            </span>
          </div>

          <div className="widget-head__actions" ref={menuRef}>
            {phase === "chat" ? (
              <button
                type="button"
                className="widget-action"
                onClick={() => setMenuOpen((value) => !value)}
                aria-label="Options de la discussion"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                title="Options"
              >
                <Icon name="ellipsis" size={18} />
              </button>
            ) : null}
            {menuOpen && phase === "chat" ? (
              <div className="widget-menu" role="menu" aria-label="Options de la discussion">
                <button
                  type="button"
                  role="menuitem"
                  className="widget-menu__item"
                  onClick={finish}
                  disabled={finished}
                >
                  <Icon name="checkCircle" size={15} />
                  <span>{finished ? model.chat.labels.discussion_terminee : model.chat.labelTerminer}</span>
                </button>
                <button type="button" role="menuitem" className="widget-menu__item" onClick={closeWidget}>
                  <Icon name="close" size={15} />
                  <span>Fermer</span>
                </button>
              </div>
            ) : null}
            <button type="button" className="widget-close" aria-label="Fermer" onClick={closeWidget}>
              <Icon name="close" size={18} />
            </button>
          </div>
        </header>

        <div className="widget-body">
          {phase === "identity" ? (
            <IdentityForm content={model.content} chat={model.chat} consent={ctx.consent} onSubmit={submitIdentity} />
          ) : (
            <Chat
              variant="widget"
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
        </div>
      </section>
    </div>
  );
}
