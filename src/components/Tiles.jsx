import { GenericList, renderTileItem } from "./GenericList.jsx";

/**
 * Liste de tuiles générique (schema/descriptor-driven) : rendu délégué au
 * renderer de liste d'items, piloté par les modèles de tuile.
 */
export function Tiles({ tiles, onOpen, galleryCount = 0 }) {
  return (
    <GenericList
      items={tiles}
      className="tiles"
      role="list"
      ariaLabel="Rubriques"
      renderItem={(tile, index, key) => renderTileItem(tile, index, key, { onOpen, galleryCount })}
    />
  );
}

