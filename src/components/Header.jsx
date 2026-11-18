/**
 * En-tête : éléments visuels configurables via design_json.elements.header.
 */
export function Header({ content }) {
  const show = content.elements?.header ?? { logo: true, kicker: true, title: true, underline: true, subtitle: true };
  return (
    <header className="pop-header">
      {show.logo && content.logo ? <img className="pop-logo" src={content.logo} alt="" /> : null}
      {show.kicker ? (
        <p className="pop-kicker">
          <span className="pop-kicker__dot" aria-hidden="true" />
          {content.linkLabel || content.brandName}
        </p>
      ) : null}
      {show.title ? <h1>{content.title}</h1> : null}
      {show.underline && content.underline ? <img className="pop-underline" src={content.underline} alt="" /> : null}
      {show.subtitle && content.subtitle ? <p className="pop-subtitle">{content.subtitle}</p> : null}
    </header>
  );
}
