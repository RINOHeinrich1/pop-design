import { Icon } from "../Icon.jsx";

/**
 * Suggestions de départ : boutons qui envoient immédiatement une question.
 * Masquées dès que le visiteur a écrit (sauf `suggestions_toujours`).
 */
export function Suggestions({ suggestions, onSelect, label, disabled = false }) {
  if (!Array.isArray(suggestions) || suggestions.length === 0) return null;
  return (
    <div className="suggestions" aria-label={label}>
      <span className="suggestions__label">{label}</span>
      <div className="suggestions__list">
        {suggestions.map((suggestion) => (
          <button
            type="button"
            className="suggestion"
            key={suggestion}
            onClick={() => onSelect(suggestion)}
            disabled={disabled}
          >
            <Icon name="chevronRight" size={12} />
            <span>{suggestion}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
