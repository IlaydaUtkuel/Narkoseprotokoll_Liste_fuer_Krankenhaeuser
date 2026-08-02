import { VITAL_CONFIG } from "./config";
import type { Measurement, VitalKind } from "../../types/vitals";

let fallbackCounter = 0;

export function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  fallbackCounter += 1;
  return `m-${Date.now()}-${fallbackCounter}`;
}

export function sortByTime<T extends { time: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.time - b.time);
}

export function measurementsOfKind(measurements: Measurement[], kind: VitalKind): Measurement[] {
  return measurements.filter((m) => m.kind === kind);
}

// Naechste Messung desselben Parameters innerhalb der Toleranz (fuer Auswahl statt Duplikat).
export function findNearestSameKind(
  measurements: Measurement[],
  kind: VitalKind,
  time: number,
  tolerance: number = 0,
): Measurement | null {
  let best: Measurement | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const m of measurements) {
    if (m.kind !== kind) continue;
    const dist = Math.abs(m.time - time);
    if (dist <= tolerance && dist < bestDist) {
      best = m;
      bestDist = dist;
    }
  }
  return best;
}

export function normalizeVitalPointerValue(kind: VitalKind, value: number): number {
  if (kind === "spo2") return Math.round(clampValue(value, 0, 100));
  return roundToPrecision(value, VITAL_CONFIG[kind].precision);
}

export function isValidSpo2(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

export function roundToPrecision(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function clampValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
