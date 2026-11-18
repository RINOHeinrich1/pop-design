import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon.jsx";
import { formatBytes } from "../core/chat.js";

/**
 * Zone de saisie : textarea auto-extensible, Entrée configurable, pièces
 * jointes (capacité `attachments`) et compteur de caractères.
 */
export function Composer({
  chat,
  actions,
  locked,
  finished,
  onSend,
  pendingAttachments = [],
  fileField = null,
  hasAttachments = false,
}) {
  const [draft, setDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef(null);
  const fileRef = useRef(null);

  const maxLength = chat.maxLength;
  const remaining = maxLength - draft.length;
  const showCounter = draft.length >= Math.max(0, maxLength - 200);
  const canAttach = hasAttachments && fileField !== null;
  const attachmentCount = pendingAttachments.length;
  const sendDisabled =
    locked ||
    uploading ||
    draft.length > maxLength ||
    (draft.trim() === "" && attachmentCount === 0);

  useEffect(() => {
    const element = textareaRef.current;
    if (element === null) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 168)}px`;
  }, [draft]);

  const submit = () => {
    if (locked || uploading) return;
    const text = draft.trim();
    const ids = pendingAttachments.map((attachment) => attachment.id).filter(Boolean);
    if (text === "" && ids.length === 0) return;
    if (text.length > maxLength) return;
    if (onSend(text, ids)) {
      setDraft("");
      setError("");
    }
  };

  const onKeyDown = (event) => {
    if (event.key !== "Enter" || event.nativeEvent?.isComposing) return;
    const wantsSend = chat.entreeEnvoyer
      ? !event.shiftKey
      : event.ctrlKey || event.metaKey;
    if (!wantsSend) return;
    event.preventDefault();
    submit();
  };

  const onFiles = async (event) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0 || !canAttach || locked) return;
    const fileName = fileField?.name ?? "piece_jointe";
    const maxFiles = Math.max(1, Number(fileField?.maxFiles) || 5);
    const slots = Math.max(0, maxFiles - attachmentCount);
    const maxBytes = Number(fileField?.maxBytes);
    const accepted = files
      .filter((file) => !Number.isFinite(maxBytes) || maxBytes <= 0 || file.size <= maxBytes)
      .slice(0, slots);
    if (accepted.length === 0) {
      setError(
        files.length > slots
          ? `${maxFiles} fichier(s) maximum.`
          : `Fichier trop volumineux${Number.isFinite(maxBytes) && maxBytes > 0 ? ` (${formatBytes(maxBytes)} max)` : ""}.`,
      );
      return;
    }
    setUploading(true);
    setError("");
    try {
      for (const file of accepted) {
        await actions.attachFile(fileName, file);
      }
    } catch {
      setError("Le fichier n'a pas pu être envoyé. Réessayez.");
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (attachment) => {
    setError("");
    void actions.removeAttachment(attachment.id);
  };

  return (
    <form
      className="pop-composer"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {attachmentCount > 0 ? (
        <div className="composer__pending" aria-label={chat.labels.pieces}>
          {pendingAttachments.map((attachment) => (
            <span className="composer__chip" key={attachment.id}>
              <Icon name="file" size={13} />
              <span className="composer__chip-name">{attachment.originalName}</span>
              {attachment.sizeBytes ? (
                <span className="composer__chip-size">{formatBytes(attachment.sizeBytes)}</span>
              ) : null}
              <button
                type="button"
                className="composer__chip-remove"
                onClick={() => removeAttachment(attachment)}
                aria-label={`${chat.labels.retirer} ${attachment.originalName}`}
                disabled={locked}
              >
                <Icon name="close" size={11} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="composer__row">
        {canAttach ? (
          <>
            <input
              ref={fileRef}
              type="file"
              className="composer__file-input"
              accept={Array.isArray(fileField?.accept) && fileField.accept.length > 0 ? fileField.accept.join(",") : undefined}
              multiple
              onChange={onFiles}
              disabled={locked || uploading}
              tabIndex={-1}
            />
            <button
              type="button"
              className="composer__icon-btn"
              onClick={() => fileRef.current?.click()}
              disabled={locked || uploading}
              aria-label={chat.labels.pieces}
              title={chat.labels.pieces}
            >
              <Icon name={uploading ? "spinner" : "paperclip"} size={18} className={uploading ? "is-spinning" : undefined} />
            </button>
          </>
        ) : null}

        <textarea
          ref={textareaRef}
          name="message"
          className="composer__input"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            if (error !== "") setError("");
          }}
          onKeyDown={onKeyDown}
          rows={1}
          maxLength={maxLength}
          placeholder={finished ? "Discussion terminée" : chat.placeholder || "Posez votre question…"}
          aria-label="Message"
          aria-describedby={showCounter ? "composer-counter" : undefined}
          disabled={locked}
        />

        <button
          type="submit"
          className="btn composer__send"
          disabled={sendDisabled}
          aria-label={chat.labelEnvoyer}
        >
          <Icon name="send" size={16} />
          <span className="composer__send-label">{chat.labelEnvoyer}</span>
        </button>
      </div>

      <div className="composer__footer">
        <span className="composer__help">
          {chat.entreeEnvoyer ? "Entrée pour envoyer · Maj+Entrée pour une ligne" : "Ctrl+Entrée pour envoyer"}
        </span>
        {showCounter ? (
          <span
            id="composer-counter"
            className={`composer__count ${remaining < 0 ? "composer__count--over" : ""}`}
            aria-live="polite"
          >
            {draft.length}/{maxLength}
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="composer__error" role="alert">
          <Icon name="exclamationCircle" size={14} /> {error}
        </p>
      ) : null}
    </form>
  );
}
