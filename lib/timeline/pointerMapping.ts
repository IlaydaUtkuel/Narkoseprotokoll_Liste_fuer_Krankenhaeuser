import { NOW_SNAP_PX, VITAL_CONFIG } from "./config";
import { bandAtY, type TimelineLayout } from "./geometry";
import { timeToX, xToTime, type XScale, type YScale } from "./scales";
import { clampValue, roundToPrecision } from "./measurementUtils";
import type { VitalKind } from "../../types/vitals";

export interface PointerMapInput {
  clientX: number;
  clientY: number;
  rect: { left: number; top: number };
  layout: TimelineLayout;
  xScale: XScale;
  yScales: Record<VitalKind, YScale>;
  startedAt: number;
  now: number;
}

export type PointerMapResult =
  | { ok: true; kind: VitalKind; time: number; value: number | null; svgX: number; svgY: number }
  | { ok: false; reason: "outside" | "future" | "beforeStart" };

/**
 * Wandelt eine Pointer-Position in Zeit, Band und (bei skalaren Baendern) Wert um.
 * Zukunft und Bereich vor der Startzeit werden als Fehler zurueckgegeben – niemals
 * still auf einen falschen Zeitpunkt geclampt.
 */
export function mapPointerToTimeline(input: PointerMapInput): PointerMapResult {
  const { clientX, clientY, rect, layout, xScale, yScales, startedAt, now } = input;
  const svgX = clientX - rect.left;
  const svgY = clientY - rect.top;

  if (svgX < layout.plotLeft || svgX > layout.plotRight) return { ok: false, reason: "outside" };
  const band = bandAtY(layout, svgY);
  if (!band) return { ok: false, reason: "outside" };

  let time = xToTime(xScale, svgX);
  if (Math.abs(svgX - timeToX(xScale, now)) <= NOW_SNAP_PX) time = now;

  if (time > now) return { ok: false, reason: "future" };
  if (time < startedAt) return { ok: false, reason: "beforeStart" };

  if (band.kind === "nibp") {
    return { ok: true, kind: "nibp", time, value: null, svgX, svgY };
  }

  const c = VITAL_CONFIG[band.kind];
  const raw = yScales[band.kind].invert(svgY);
  const value = roundToPrecision(clampValue(raw, c.min, c.max), c.precision);
  return { ok: true, kind: band.kind, time, value, svgX, svgY };
}
