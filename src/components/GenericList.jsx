import { Icon } from "../Icon.jsx";

/**
 * Liste générique pilotée par descripteurs (items + rendu par item), inspirée
 * de gestion_station GenericList. Le rendu d'item est injectable (strategy).
 */
export function GenericList({
  items = [],
  renderItem,
  getKey,
  className = "",
  role = "list",
  ariaLabel,
  empty = null,
}) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return empty;
  return (
    <div className={className} role={role} aria-label={ariaLabel}>
      {list.map((item, index) => {
        const key = getKey ? getKey(item, index) : item?.id ?? index;
        return renderItem ? renderItem(item, index, key) : null;
      })}
    </div>
  );
}

/** Rendu générique d'une tuile (vue pilotée par descripteur) */
export function renderTileItem(tile, index, key, { onOpen, galleryCount = 0 } = {}) {
  const badge = tile.kind === "gallery" && galleryCount > 0 ? galleryCount : null;
  const view = tile.view ?? tile;
  const label = view.label ?? tile.label ?? tile.libelle ?? tile.title;
  const description = view.description ?? tile.description;
  const icon = view.icon ?? tile.icon ?? "file";
  const accent = view.accent ?? tile.accent;
  return (
    <div className="tile-item" role="listitem" key={key}>
      <button
        type="button"
        className="tile"
        onClick={() => onOpen(tile.id)}
        aria-haspopup="dialog"
        style={accent ? { "--tile-accent": accent } : undefined}
      >
        <span className="tile__icon-wrap">
          <Icon name={icon} size={44} className="tile__icon" />
          {badge !== null ? <span className="tile__badge">{badge}</span> : null}
        </span>
        <span className="tile__label">{label}</span>
        {description ? <span className="tile__hint">{description}</span> : null}
      </button>
    </div>
  );
}
