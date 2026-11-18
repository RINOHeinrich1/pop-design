import { Icon } from "../Icon.jsx";

/**
 * Pastille d'identité : image fournie, sinon icône, sinon initiale.
 * Purement décorative pour les lecteurs d'écran (le nom est rendu à côté).
 */
export function Avatar({ url, label, icon, size = 30, className = "" }) {
  const initial = String(label ?? "").trim().charAt(0).toUpperCase();
  return (
    <span
      className={`avatar ${className}`.trim()}
      style={{ width: `${size}px`, height: `${size}px` }}
      aria-hidden="true"
    >
      {url ? (
        <img src={url} alt="" loading="lazy" />
      ) : icon ? (
        <Icon name={icon} size={Math.round(size * 0.52)} />
      ) : (
        <span className="avatar__initial">{initial === "" ? "?" : initial}</span>
      )}
    </span>
  );
}
