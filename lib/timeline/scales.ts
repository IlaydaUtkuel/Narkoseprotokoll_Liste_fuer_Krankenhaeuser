import { scaleLinear, scaleTime, type ScaleLinear, type ScaleTime } from "d3-scale";
import { FUTURE_WINDOW_MS, VITAL_CONFIG } from "./config";
import type { BandLayout, TimelineLayout } from "./geometry";
import type { VitalKind } from "../../types/vitals";
import type { VitalScaleDomain } from "./dynamicYScale";

export interface TimelineDomain {
  start: number;
  end: number;
}

export type XScale = ScaleTime<number, number>;
export type YScale = ScaleLinear<number, number>;

/**
 * domainStart bleibt fix auf der Startzeit (bzw. now als Vorschau vor dem Start),
 * damit der Startpunkt immer links sichtbar bleibt. domainEnd waechst mit der Zeit
 * (now + futureWindow), wodurch die 5-Minuten-Spalten mit der Zeit schmaler werden.
 */
export function computeDomain(
  startedAt: number | null,
  now: number,
  futureWindow: number = FUTURE_WINDOW_MS,
  endedAt: number | null = null,
): TimelineDomain {
  const start = startedAt ?? now;
  const effectiveNow = endedAt ?? now;
  const end = Math.max(effectiveNow, start) + futureWindow;
  return { start, end };
}

export function buildXScale(domain: TimelineDomain, layout: TimelineLayout): XScale {
  return scaleTime()
    .domain([domain.start, domain.end])
    .range([layout.plotLeft, layout.plotRight]);
}

export function buildYScale(kind: VitalKind, band: BandLayout, domain?: VitalScaleDomain): YScale {
  const c = domain ?? VITAL_CONFIG[kind];
  // Grosse Werte oben, kleine unten (Range invertiert).
  return scaleLinear()
    .domain([c.min, c.max])
    .range([band.innerBottom, band.innerTop])
    .clamp(kind === "spo2");
}

export function buildYScales(
  layout: TimelineLayout,
  domains?: Record<VitalKind, VitalScaleDomain>,
): Record<VitalKind, YScale> {
  const result = {} as Record<VitalKind, YScale>;
  for (const band of layout.bands) {
    result[band.kind] = buildYScale(band.kind, band, domains?.[band.kind]);
  }
  return result;
}

// Echte Zeit -> X-Pixel.
export function timeToX(scale: XScale, time: number): number {
  return scale(time);
}

// X-Pixel -> echte Zeit (Millisekunden).
export function xToTime(scale: XScale, x: number): number {
  return scale.invert(x).getTime();
}
