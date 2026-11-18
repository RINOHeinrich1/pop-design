/** Pied de page : texte et crédit paramétrables. */
export function Footer({ content, chat }) {
  const creditLabel = chat?.labels?.credit ?? "Crédit";
  return (
    <footer className="pop-footer">
      <p className="pop-footer__text">
        {content.footerText ? <span>{content.footerText} </span> : null}
        {content.showCredit && content.footerLink ? (
          <a href={content.footerLink} target="_blank" rel="noopener noreferrer">
            {creditLabel}
          </a>
        ) : null}
      </p>
    </footer>
  );
}
