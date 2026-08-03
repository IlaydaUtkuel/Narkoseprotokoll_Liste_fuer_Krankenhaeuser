import { MIN_NIBP_GAP } from "./config";
import { clampValue, roundToPrecision } from "./measurementUtils";

/**
 * Reine Logik fuer das richtungs- und wertunabhaengige Ziehen der drei
 * NiBP-Griffe. Beim Ziehen eines Griffs duerfen die beiden anderen Werte
 * niemals neu berechnet, geraten oder gerundet werden. Diese Funktionen halten
 * ausserdem die klinische Reihenfolge systolic > mean > diastolic ein.
 */

export type NibpPart = "systolic" | "mean" | "diastolic";

export interface NibpTriple {
  systolic: number | null;
  mean: number;
  diastolic: number | null;
}

// Systolisch liegt oberhalb des Mittels: [mean + Abstand, Skalenmaximum].
export function clampSystolic(raw: number, mean: number, scaleMin: number, scaleMax: number): number {
  const lower = Math.max(scaleMin, Math.min(scaleMax, mean + MIN_NIBP_GAP));
  return roundToPrecision(clampValue(raw, lower, scaleMax), 0);
}

// Diastolisch liegt unterhalb des Mittels: [Skalenminimum, mean - Abstand].
export function clampDiastolic(raw: number, mean: number, scaleMin: number, scaleMax: number): number {
  const upper = Math.min(scaleMax, Math.max(scaleMin, mean - MIN_NIBP_GAP));
  return roundToPrecision(clampValue(raw, scaleMin, upper), 0);
}

// Das Mittel bleibt zwischen Diastolisch und Systolisch (sofern gesetzt), damit
// die Reihenfolge erhalten bleibt.
export function clampMean(
  raw: number,
  systolic: number | null,
  diastolic: number | null,
  scaleMin: number,
  scaleMax: number,
): number {
  const lower = diastolic === null ? scaleMin : Math.min(scaleMax, diastolic + MIN_NIBP_GAP);
  const upper = systolic === null ? scaleMax : Math.max(scaleMin, systolic - MIN_NIBP_GAP);
  const low = Math.min(lower, upper);
  const high = Math.max(lower, upper);
  return roundToPrecision(clampValue(raw, low, high), 0);
}

/**
 * Wendet eine Drag-Vorschau auf genau einen Griff an. Ausgangspunkt ist immer
 * der beim Drag-Start gesicherte Snapshot; die beiden nicht gezogenen Werte
 * werden unveraendert aus dem Snapshot uebernommen.
 */
export function applyNibpDrag(
  snapshot: NibpTriple,
  part: NibpPart,
  rawValue: number,
  scaleMin: number,
  scaleMax: number,
): NibpTriple {
  if (part === "systolic") {
    return { ...snapshot, systolic: clampSystolic(rawValue, snapshot.mean, scaleMin, scaleMax) };
  }
  if (part === "diastolic") {
    return { ...snapshot, diastolic: clampDiastolic(rawValue, snapshot.mean, scaleMin, scaleMax) };
  }
  return {
    ...snapshot,
    mean: clampMean(rawValue, snapshot.systolic, snapshot.diastolic, scaleMin, scaleMax),
  };
}

/**
 * Waehlt den Griff, dessen Y-Position dem Pointer am naechsten liegt. Die
 * Grenzen liegen genau auf den Mittelpunkten zwischen benachbarten Griffen –
 * dadurch ueberlappen sich die Trefferzonen nicht und der naechste Griff
 * gewinnt eindeutig (auch bei dicht beieinander liegenden Werten).
 */
export function nearestNibpHandle(
  pointerY: number,
  ys: { systolic: number; mean: number; diastolic: number },
): NibpPart {
  const dSys = Math.abs(pointerY - ys.systolic);
  const dMean = Math.abs(pointerY - ys.mean);
  const dDia = Math.abs(pointerY - ys.diastolic);
  if (dSys <= dMean && dSys <= dDia) return "systolic";
  if (dDia <= dMean && dDia <= dSys) return "diastolic";
  return "mean";
}

/**
 * Berechnet fuer einen Griff den nicht ueberlappenden Trefferradius: hoechstens
 * der halbe Abstand zum naechsten benachbarten Griff. So kann die grosse
 * Touch-Trefferflaeche nie einen Nachbargriff verdecken.
 */
export function nonOverlappingRadius(
  center: number,
  neighbors: number[],
  desired: number,
  minimum: number,
): number {
  let limit = desired;
  for (const neighbor of neighbors) {
    const half = Math.abs(center - neighbor) / 2;
    if (half < limit) limit = half;
  }
  return Math.max(minimum, limit);
}
