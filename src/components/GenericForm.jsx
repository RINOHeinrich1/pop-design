import { Icon } from "../Icon.jsx";
import { cx } from "../core/style.js";

/**
 * Formulaire générique piloté par descripteurs de champs (schema-driven),
 * inspiré de gestion_station GenericForm / IFieldDescriptor.
 * Classes/style résolus comme objets composables (cx/StyleDescriptor).
 */
export function GenericForm({
  title,
  intro,
  fields = [],
  values = {},
  onChange,
  onSubmit,
  submitLabel = "Envoyer",
  submitIcon = "send",
  hint,
  children,
  className = "",
  footer,
}) {
  const renderField = (field) => {
    const name = field.name;
    const label = field.label ?? name;
    const type = field.type ?? "text";
    const value = values[name] ?? "";
    const common = {
      name,
      required: Boolean(field.required),
      placeholder: field.placeholder ?? field.props?.placeholder,
      autoComplete: field.props?.autoComplete,
      disabled: field.disabled,
    };
    if (type === "textarea") {
      return (
        <label className="field" key={name}>
          <span>{label}</span>
          <textarea {...common} value={value} onChange={(e) => onChange?.(name, e.target.value)} rows={field.rows ?? 4} />
        </label>
      );
    }
    if (type === "checkbox") {
      return (
        <label className="check" key={name}>
          <input type="checkbox" name={name} checked={Boolean(value)} onChange={(e) => onChange?.(name, e.target.checked)} disabled={common.disabled} />
          <span>{field.content ?? label}</span>
        </label>
      );
    }
    return (
      <label className="field" key={name}>
        <span>{label}</span>
        <input {...common} type={type} value={value} onChange={(e) => onChange?.(name, e.target.value)} />
      </label>
    );
  };

  return (
    <form className={cx("pop-card", className)} onSubmit={onSubmit}>
      {title ? <h2 className="pop-card__title">{title}</h2> : null}
      {intro ? <p className="pop-identity__intro">{intro}</p> : null}
      {fields.map(renderField)}
      {children}
      <button type="submit" className="btn btn--block">
        {submitIcon ? <Icon name={submitIcon} size={16} /> : null} {submitLabel}
      </button>
      {hint ? <p className="hint">{hint}</p> : null}
      {footer}
    </form>
  );
}
