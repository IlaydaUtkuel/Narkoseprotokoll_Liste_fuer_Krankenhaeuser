// Dezente, vorlaeufige Wortmarke "sikant Med" mit kleinem neutralen Plus-Symbol.
// Kein offizielles Firmenlogo (im public-Ordner ist keines vorhanden).
export function BrandMark() {
  return (
    <span className="brand-mark" data-testid="brand-mark" aria-label="sikant Med">
      <span className="brand-mark__plus" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="100%" height="100%" focusable="false" aria-hidden="true">
          <rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="#1f7a63" />
          <path
            d="M12 6.75v10.5M6.75 12h10.5"
            stroke="#ffffff"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="brand-mark__text">sikant Med</span>
    </span>
  );
}
