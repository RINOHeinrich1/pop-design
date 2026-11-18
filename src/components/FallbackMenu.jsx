import { Icon } from "../Icon.jsx";

/**
 * Menu de secours heuristique (capacité `fallback`) : l'hôte fournit
 * `state.fallback`, le template le rend lui-même et renvoie les choix via
 * `actions.selectFallback`.
 */
export function FallbackMenu({ fallback, labels, onSelect, onCollection, disabled = false }) {
  if (fallback === null || fallback === undefined) return null;
  const questions = Array.isArray(fallback.questions)
    ? fallback.questions.filter(
        (question) =>
          question !== null &&
          typeof question === "object" &&
          typeof question.id === "string" &&
          typeof question.label === "string",
      )
    : [];
  if (questions.length === 0 && fallback.showCollectionForm !== true) return null;

  return (
    <section className="chat-fallback" aria-live="polite" aria-label={labels.menu_secours}>
      <p className="chat-fallback__intro">{fallback.intro || labels.menu_secours}</p>
      {questions.length > 0 ? (
        <div className="chat-fallback__options">
          {questions.map((question) => (
            <button
              type="button"
              className="chat-fallback__option"
              key={question.id}
              onClick={() => onSelect(question.id)}
              disabled={disabled}
            >
              <Icon name="comments" size={14} />
              <span>{question.label}</span>
            </button>
          ))}
        </div>
      ) : null}
      {fallback.showCollectionForm === true ? (
        <button
          type="button"
          className="btn btn--ghost btn--small chat-fallback__collection"
          onClick={onCollection}
          disabled={disabled}
        >
          <Icon name="file" size={14} /> {labels.formulaire}
        </button>
      ) : null}
    </section>
  );
}
