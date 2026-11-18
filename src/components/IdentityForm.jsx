import { Icon } from "../Icon.jsx";
import { viewRegistry } from "../core/view-registry.js";

/**
 * Formulaire d'identité générique (schema-driven) : champs issus du registre
 * de schémas, labels/config injectés par le contexte (chat.identity/content).
 */
export function IdentityForm({ content, chat, consent, onSubmit }) {
  const identity = chat?.identity ?? {
    nomLabel: "Nom",
    nomPlaceholder: "Votre nom",
    emailLabel: "Email",
    emailPlaceholder: "vous@exemple.mg",
    submitLabel: "Démarrer la discussion",
    hint: "Vos informations servent uniquement à ouvrir la discussion.",
  };

  const schema = viewRegistry.getFieldSchema("identity");
  const fields = schema.map((f) => {
    if (f.name === "nom") return { ...f, label: identity.nomLabel, placeholder: identity.nomPlaceholder, props: { ...(f.props || {}), autoComplete: "name", placeholder: identity.nomPlaceholder } };
    if (f.name === "email") return { ...f, label: identity.emailLabel, placeholder: identity.emailPlaceholder, props: { ...(f.props || {}), autoComplete: "email", placeholder: identity.emailPlaceholder } };
    return { ...f };
  });

  return (
    <form className="pop-card pop-identity" onSubmit={onSubmit}>
      <h2 className="pop-card__title">{content.identityTitle}</h2>
      {content.identityText ? <p className="pop-identity__intro">{content.identityText}</p> : null}
      {fields.map((field) => (
        <label className="field" key={field.name}>
          <span>{field.label}</span>
          <input
            name={field.name}
            type={field.type || "text"}
            autoComplete={field.props?.autoComplete}
            placeholder={field.placeholder ?? field.props?.placeholder}
            required={Boolean(field.required)}
          />
        </label>
      ))}
      {consent ? (
        <label className="check">
          <input name="consentement" type="checkbox" />
          <span>
            <a href={consent.lien} target="_blank" rel="noopener noreferrer">
              {consent.texte}
            </a>
          </span>
        </label>
      ) : null}
      <button type="submit" className="btn btn--block">
        <Icon name="send" size={16} /> {identity.submitLabel}
      </button>
      {identity.hint ? <p className="hint">{identity.hint}</p> : null}
    </form>
  );
}
