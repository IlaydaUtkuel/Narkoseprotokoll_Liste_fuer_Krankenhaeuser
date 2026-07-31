import { area, curveStepAfter, line } from "d3-shape";
import { sortByTime } from "./measurementUtils";
import type { XScale, YScale } from "./scales";

export interface StepPoint {
  time: number;
  value: number;
}

/**
 * Step-After-Punkte: sortierte Messungen plus ein Abschlusspunkt bei "now" mit dem
 * zuletzt gemessenen Wert. Der letzte Wert wird nur bis zur aktuellen Zeit gehalten,
 * niemals in die Zukunft.
 */
export function buildStepPoints(
  measurements: { time: number; value: number }[],
  now: number,
): StepPoint[] {
  const sorted = sortByTime(measurements).map((m) => ({ time: m.time, value: m.value }));
  if (sorted.length === 0) return [];
  const last = sorted[sorted.length - 1];
  const points = sorted.slice();
  if (now > last.time) points.push({ time: now, value: last.value });
  return points;
}

// Step-After-Wert zu einem Zeitpunkt (letzte Messung mit time <= t).
export function spo2ValueAt(points: StepPoint[], t: number): number | null {
  let value: number | null = null;
  for (const p of points) {
    if (p.time <= t) value = p.value;
    else break;
  }
  return value;
}

export function spo2LinePath(points: StepPoint[], xScale: XScale, yScale: YScale): string {
  const generator = line<StepPoint>()
    .curve(curveStepAfter)
    .x((d) => xScale(d.time))
    .y((d) => yScale(d.value));
  return generator(points) ?? "";
}

export function spo2AreaPath(
  points: StepPoint[],
  xScale: XScale,
  yScale: YScale,
  baseY: number,
): string {
  const generator = area<StepPoint>()
    .curve(curveStepAfter)
    .x((d) => xScale(d.time))
    .y0(baseY)
    .y1((d) => yScale(d.value));
  return generator(points) ?? "";
}
