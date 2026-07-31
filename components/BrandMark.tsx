import Image from "next/image";
import logo from "../public/sikant-logo.png";

// Originales Sikant-Med-Logo (public/sikant-logo.png). Hoehe ~32px, Breite wird
// aus dem Original-Seitenverhaeltnis berechnet – das Logo wird nicht verzerrt.
const LOGO_HEIGHT = 32;
const LOGO_WIDTH = Math.round((LOGO_HEIGHT * logo.width) / logo.height);

export function BrandMark() {
  return (
    <span className="brand-mark" data-testid="brand-mark">
      <Image
        src={logo}
        alt="Sikant Med"
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        priority
        // Original unveraendert ausliefern: keine Neukodierung, exaktes
        // Seitenverhaeltnis (195x78 = 2.5 = 80x32), keine Verzerrung. Zudem offline
        // vorab im Cache (public-Datei).
        unoptimized
        className="brand-logo"
      />
    </span>
  );
}
