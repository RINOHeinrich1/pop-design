import { Icon } from "../Icon.jsx";
import { Markdown } from "../core/Markdown.jsx";
import { formatBytes, formatTime, userStateIcon, userStateLabel } from "../core/chat.js";
import { Avatar } from "./Avatar.jsx";

function MediaList({ medias, actions }) {
  if (!Array.isArray(medias) || medias.length === 0) return null;
  return (
    <div className="msg__medias">
      {medias.map((media, index) =>
        media.type === "photo" ? (
          <button
            type="button"
            className="msg__media"
            key={`${media.url}-${index}`}
            onClick={() => actions.openMedia(media.url)}
            aria-label={`Agrandir : ${media.libelle || "photo"}`}
          >
            <img src={media.url} alt={media.libelle || ""} loading="lazy" />
          </button>
        ) : (
          <button
            type="button"
            className="msg__link"
            key={`${media.url}-${index}`}
            onClick={() => actions.openMedia(media.url)}
          >
            <Icon name="link" size={14} /> {media.libelle || media.url}
          </button>
        ),
      )}
    </div>
  );
}

function AttachmentList({ attachments, actions, labels }) {
  if (!Array.isArray(attachments) || attachments.length === 0) return null;
  return (
    <ul className="msg__attachments" aria-label={labels.pieces}>
      {attachments.map((attachment) => (
        <li key={attachment.id}>
          <button
            type="button"
            className="msg__attachment"
            onClick={() => attachment.url && actions.openMedia(attachment.url)}
            title={attachment.fieldLabel || attachment.fieldName}
          >
            <Icon name="file" size={15} />
            <span className="msg__attachment-name">{attachment.originalName}</span>
            {attachment.sizeBytes ? (
              <span className="msg__attachment-size">{formatBytes(attachment.sizeBytes)}</span>
            ) : null}
            {attachment.url ? <Icon name="download" size={13} /> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

function KnowledgeList({ knowledge, labels }) {
  if (!Array.isArray(knowledge) || knowledge.length === 0) return null;
  return (
    <ul className="msg__knowledge" aria-label={labels.sources}>
      {knowledge.map((entry, index) => (
        <li className="knowledge-chip" key={`${entry.ref}-${index}`} title={entry.ref}>
          <Icon name="book" size={13} />
          <span>{entry.titre || entry.ref}</span>
        </li>
      ))}
    </ul>
  );
}

function UserState({ state, labels, locale }) {
  if (state === undefined || state === null) return null;
  const confidence = Number(state.confidence);
  const percent = Number.isFinite(confidence) && confidence > 0 ? Math.round(confidence * 100) : null;
  return (
    <span
      className={`msg__state msg__state--${state.label ?? "neutral"}`}
      title={`${labels.etat}${percent === null ? "" : ` · ${percent} %`}`}
    >
      <Icon name={userStateIcon(state)} size={13} />
      {userStateLabel(state)}
    </span>
  );
}

/**
 * Un message du fil : avatar, auteur, Markdown, médias, pièces jointes,
 * sources de connaissance et état du visiteur.
 */
export function Message({ message, chat, content, actions, locale }) {
  const isUser = message.role === "user";
  const author = isUser
    ? "Vous"
    : message.authorName || content.brandName || "Assistant";
  const avatarUrl = isUser ? content.avatarUser : content.avatarAssistant || content.logo;
  const avatarIcon = isUser ? "user" : "comments";
  const time = chat.horodatage ? formatTime(message.at, locale) : "";

  return (
    <div className={`msg-row msg-row--${isUser ? "user" : "assistant"}`} data-message-id={message.id}>
      {chat.avatars ? (
        <Avatar
          url={avatarUrl}
          label={author}
          icon={avatarUrl ? undefined : avatarIcon}
          size={30}
          className={`avatar--${isUser ? "user" : "assistant"}`}
        />
      ) : null}
      <div className="msg-stack">
        <div className="msg__meta">
          <span className="msg__author">{author}</span>
          {time ? <span className="msg__time">{time}</span> : null}
        </div>
        <article className={`msg msg--${isUser ? "user" : "assistant"}`}>
          {message.content ? (
            <Markdown text={message.content} enabled={chat.markdown} />
          ) : null}
          <MediaList medias={message.medias} actions={actions} />
          <AttachmentList attachments={message.attachments} actions={actions} labels={chat.labels} />
          <KnowledgeList knowledge={message.knowledge} labels={chat.labels} />
          <UserState state={message.userState} labels={chat.labels} locale={locale} />
        </article>
      </div>
    </div>
  );
}
