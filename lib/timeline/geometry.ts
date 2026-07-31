import { BAND_ORDER, LAYOUT, VITAL_CONFIG } from "./config";
import type { VitalKind } from "../../types/vitals";

export interface BandLayout {
  kind: VitalKind;
  top: number;
  height: number;
  bottom: number;
  innerTop: number; // oberer Rand der Datenflaeche (unter dem Bandtitel)
  innerBottom: number; // unterer Rand der Datenflaeche
}

export interface TimelineLayout {
  width: number;
  height: number;
  plotLeft: number;
  plotRight: number;
  plotWidth: number;
  bands: BandLayout[];
  bandByKind: Record<VitalKind, BandLayout>;
  plotTop: number;
  plotBottom: number; // unterer Rand des letzten Bandes (Basis der Zeitachse)
  axisY: number;
}

// Berechnet das gesamte SVG-Layout aus der gemessenen Containerbreite.
export function computeTimelineLayout(width: number): TimelineLayout {
  const plotLeft = LAYOUT.marginLeft;
  const plotRight = Math.max(plotLeft + 10, width - LAYOUT.marginRight);
  const plotWidth = plotRight - plotLeft;

  let y = LAYOUT.marginTop;
  const bands: BandLayout[] = [];
  for (const kind of BAND_ORDER) {
    const height = VITAL_CONFIG[kind].height;
    const top = y;
    const bottom = top + height;
    bands.push({
      kind,
      top,
      height,
      bottom,
      innerTop: top + LAYOUT.bandTitleSpace,
      innerBottom: bottom - LAYOUT.bandPaddingBottom,
    });
    y = bottom + LAYOUT.bandGap;
  }

  const plotBottom = y - LAYOUT.bandGap;
  const height = plotBottom + LAYOUT.axisHeight;
  const bandByKind = Object.fromEntries(bands.map((b) => [b.kind, b])) as Record<
    VitalKind,
    BandLayout
  >;

  return {
    width,
    height,
    plotLeft,
    plotRight,
    plotWidth,
    bands,
    bandByKind,
    plotTop: LAYOUT.marginTop,
    plotBottom,
    axisY: plotBottom,
  };
}

// Ermittelt das Band, in dessen vertikalem Bereich sich eine SVG-Y-Koordinate befindet.
export function bandAtY(layout: TimelineLayout, svgY: number): BandLayout | null {
  for (const band of layout.bands) {
    if (svgY >= band.top && svgY <= band.bottom) return band;
  }
  return null;
}
