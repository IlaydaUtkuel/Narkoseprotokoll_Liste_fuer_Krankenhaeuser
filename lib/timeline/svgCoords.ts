/**
 * Wandelt Client-Koordinaten (aus PointerEvent) in das lokale SVG-Nutzer-Koordinatensystem.
 * Verwendet bevorzugt getScreenCTM().inverse(), damit Safari-Zoom, Seiten-Scroll und
 * responsive SVG-Skalierung die Umrechnung nicht verfälschen. Fällt auf
 * getBoundingClientRect zurück (z. B. in jsdom, wo getScreenCTM fehlt).
 */
export interface SvgPoint {
  x: number;
  y: number;
}

interface CtmCapableSvg extends SVGSVGElement {
  getScreenCTM(): DOMMatrix | null;
  createSVGPoint(): DOMPoint;
}

export function clientToSvgPoint(svg: SVGSVGElement | null, clientX: number, clientY: number): SvgPoint {
  if (svg && typeof (svg as CtmCapableSvg).getScreenCTM === "function" && typeof (svg as CtmCapableSvg).createSVGPoint === "function") {
    try {
      const ctm = (svg as CtmCapableSvg).getScreenCTM();
      if (ctm) {
        const point = (svg as CtmCapableSvg).createSVGPoint();
        point.x = clientX;
        point.y = clientY;
        const local = point.matrixTransform(ctm.inverse());
        if (Number.isFinite(local.x) && Number.isFinite(local.y)) return { x: local.x, y: local.y };
      }
    } catch {
      /* fällt auf Bounding-Rect zurück */
    }
  }
  const rect = svg?.getBoundingClientRect();
  return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
}
