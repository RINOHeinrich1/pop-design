import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon.jsx";
import { shouldShowSuggestions } from "../core/chat.js";
import { Avatar } from "./Avatar.jsx";
import { Composer } from "./Composer.jsx";
import { FallbackMenu } from "./FallbackMenu.jsx";
import { Message } from "./Message.jsx";
import { Suggestions } from "./Suggestions.jsx";

// Amorces proposées dans le widget lorsqu'aucune suggestion n'est configurée.
// Elles restent désactivables via `afficher_suggestions` ou remplaçables par
// la liste `suggestions` du manifeste.
const WIDGET_STARTERS = Object.freeze([
  "Découvrir les services",
  "Demander un devis",
  "Parler à un conseiller",
]);

function TypingRow({ content, chat }) {
  return (
    <div className="msg-row msg-row--assistant msg-row--typing">
      {chat.avatars ? (
        <Avatar
          url={content.avatarAssistant || content.logo}
          label={content.brandName || chat.labels.assistant}
          icon={content.avatarAssistant || content.logo ? undefined : "comments"}
          size={30}
          className="avatar--assistant"
        />
      ) : null}
      <p className="msg msg--typing" aria-label="L'assistant est en train d'écrire">
        <span />
        <span />
        <span />
      </p>
    </div>
  );
}

/** Fil de discussion complet : en-tête, messages, suggestions, secours, saisie. */
export function Chat({
  model,
  messages,
  typing,
  finished,
  fallback,
  pendingAttachments,
  modelFields,
  onSend,
  onFinish,
  actions,
  variant = "page",
}) {
  const { chat, content } = model;
  const isWidget = variant === "widget";
  const messagesRef = useRef(null);
  const [atBottom, setAtBottom] = useState(true);
  const locked = typing || finished;
  const suggestionsVisible = shouldShowSuggestions(chat, messages);
  const widgetQuickReplies = !isWidget
    ? []
    : chat.suggestions.length > 0
      ? chat.suggestions
      : chat.afficherSuggestions
        ? WIDGET_STARTERS
        : [];
  const fileField =
    (Array.isArray(modelFields) ? modelFields : []).find(
      (field) => field !== null && typeof field === "object" && field.type === "file",
    ) ?? null;

  const scrollToBottom = (smooth = true) => {
    const element = messagesRef.current;
    if (element === null) return;
    try {
      element.scrollTo({
        top: element.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    } catch {
      element.scrollTop = element.scrollHeight;
    }
  };

  useEffect(() => {
    if (atBottom) scrollToBottom(true);
  }, [messages.length, typing, atBottom, fallback]);

  const handleSend = (text, attachmentIds = []) => {
    const ok = onSend(text, attachmentIds);
    if (ok) {
      setAtBottom(true);
      scrollToBottom(true);
    }
    return ok;
  };

  const handleSuggestion = (text) => {
    handleSend(text, []);
  };

  return (
    <section className={isWidget ? "pop-chat widget-chat" : "pop-card pop-chat"} aria-label="Discussion">
      {!isWidget ? (
        <div className="pop-chat__top">
          <div className="pop-chat__identity">
            <Avatar
              url={content.avatarAssistant || content.logo}
              label={content.brandName || chat.labels.assistant}
              icon={content.avatarAssistant || content.logo ? undefined : "comments"}
              size={38}
              className="avatar--assistant"
            />
            <div className="pop-chat__who">
              <p className="pop-chat__name">{content.brandName || chat.labels.assistant}</p>
              <p className={`pop-chat__presence ${typing ? "is-typing" : ""}`}>
                {finished ? chat.labels.discussion_terminee : typing ? chat.labels.en_train_ecrire : chat.labels.en_ligne}
              </p>
            </div>
          </div>
          <div className="pop-chat__tools">
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={onFinish}
              disabled={finished}
            >
              <Icon name="checkCircle" size={14} />
              <span>{chat.labelTerminer}</span>
            </button>
            {finished ? <span className="pop-status">{chat.labels.discussion_terminee}</span> : null}
          </div>
        </div>
      ) : null}

      <div
        className="pop-chat__messages"
        ref={messagesRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        onScroll={(event) => {
          const element = event.currentTarget;
          const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
          setAtBottom(distance < 64);
        }}
      >
        {messages.length === 0 && !typing ? (
          isWidget ? (
            <div className="chat-empty widget-welcome">
              <span className="widget-welcome__avatar">
                <Avatar
                  url={content.avatarAssistant || content.logo}
                  label={content.brandName || chat.labels.assistant}
                  icon={content.avatarAssistant || content.logo ? undefined : "comments"}
                  size={54}
                  className="avatar--assistant"
                />
                <i className="widget-welcome__online" aria-hidden="true" />
              </span>
              <p className="chat-empty__title">Bonjour 👋</p>
              <p className="chat-empty__text">
                {chat.accueil || chat.messageVide || "Je suis votre assistant. Comment puis-je vous aider ?"}
              </p>
              {widgetQuickReplies.length > 0 ? (
                <Suggestions
                  suggestions={widgetQuickReplies}
                  onSelect={handleSuggestion}
                  label={chat.labels.suggestions}
                  disabled={locked}
                />
              ) : null}
            </div>
          ) : (
            <div className="chat-empty">
              <span className="chat-empty__icon" aria-hidden="true">
                <Icon name="comments" size={30} />
              </span>
              {(chat.accueil || chat.messageVide) ? (
                <p className="chat-empty__text">{chat.accueil || chat.messageVide}</p>
              ) : null}
              {suggestionsVisible ? (
                <Suggestions
                  suggestions={chat.suggestions}
                  onSelect={handleSuggestion}
                  label={chat.labels.suggestions}
                  disabled={locked}
                />
              ) : chat.messageVide ? (
                <p className="pop-empty">{chat.messageVide}</p>
              ) : null}
            </div>
          )
        ) : (
          <>
            {messages.map((message) => (
              <Message
                key={message.id}
                message={message}
                chat={chat}
                content={content}
                actions={actions}
                locale={content.locale}
              />
            ))}
            {typing ? <TypingRow content={content} chat={chat} /> : null}
            {suggestionsVisible ? (
              <div className="pop-chat__suggestions">
                <Suggestions
                  suggestions={chat.suggestions}
                  onSelect={handleSuggestion}
                  label={chat.labels.suggestions}
                  disabled={locked}
                />
              </div>
            ) : null}
          </>
        )}

        {/* Le menu de secours fait partie du fil : il défile avec les messages
            pour que la zone de saisie reste toujours visible et atteignable. */}
        {fallback ? (
          <FallbackMenu
            fallback={fallback}
            labels={chat.labels}
            onSelect={actions.selectFallback}
            onCollection={actions.openCollectionForm}
            disabled={locked}
          />
        ) : null}
      </div>

      {!atBottom && messages.length > 0 ? (
        <button type="button" className="chat-jump" onClick={() => scrollToBottom(true)}>
          <Icon name="arrowDown" size={14} /> {chat.labels.nouveau_message}
        </button>
      ) : null}

      <Composer
        chat={chat}
        actions={actions}
        locked={locked}
        finished={finished}
        onSend={handleSend}
        pendingAttachments={Array.isArray(pendingAttachments) ? pendingAttachments : []}
        fileField={fileField}
        hasAttachments={model.has("attachments")}
      />
    </section>
  );
}

