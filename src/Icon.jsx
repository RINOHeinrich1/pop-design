import { ICONS } from "./icons.js";

/**
 * Icône du design d'origine (glyphe FontAwesome extrait, chemin inline).
 * `viewBox` compensé + `scale(1, -1)` : les glyphes viennent d'une police SVG
 * (repère y montant). `width`/`height` carrés = largeur d'unité ém comme FA.
 */
export function Icon({ name, size = 44, className }) {
  const icon = ICONS[name];
  if (!icon) return null;
  return (
    <svg
      className={className}
      viewBox={icon.box.join(" ")}
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d={icon.d} transform="scale(1,-1)" />
    </svg>
  );
}
