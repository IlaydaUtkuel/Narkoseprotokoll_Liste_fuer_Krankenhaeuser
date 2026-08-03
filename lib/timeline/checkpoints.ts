import { BAND_ORDER, TICK_INTERVAL_MS, VITAL_CONFIG } from "./config";
import type { Measurement, NibpMeasurement, VitalKind } from "../../types/vitals";

export interface MissingVital {
  kind: VitalKind;
  label: string;
  detail?: string;
}

export interface VitalCheckpointWarning {
  time: number;
  missing: MissingVital[];
  recordedBandCount: number;
}

export function completedCheckpointTimes(startedAt: number, limit: number): number[] {
  if (!Number.isFinite(startedAt) || !Number.isFinite(limit) || limit < startedAt + TICK_INTERVAL_MS) return [];
  const count = Math.floor((limit - startedAt) / TICK_INTERVAL_MS);
  return Array.from({ length: count }, (_, index) => startedAt + (index + 1) * TICK_INTERVAL_MS);
}

function nibpMissingDetail(entry: NibpMeasurement | undefined): string | undefined {
  if (!entry) return undefined;
  const missing: string[] = [];
  if (entry.systolic === null) missing.push("Systolisch");
  if (!Number.isFinite(entry.mean)) missing.push("Mittel");
  if (entry.diastolic === null) missing.push("Diastolisch");
  return missing.length > 0 ? missing.join(" und ") : undefined;
}

export function deriveCheckpointWarnings(
  startedAt: number | null,
  endedAt: number | null,
  now: number,
  measurements: Measurement[],
): VitalCheckpointWarning[] {
  if (startedAt === null) return [];
  const limit = endedAt === null ? now : endedAt;
  return completedCheckpointTimes(startedAt, limit).flatMap((time) => {
    const exact = measurements.filter((measurement) => measurement.time === time);
    const missing: MissingVital[] = [];
    let recordedBandCount = 0;
    for (const kind of BAND_ORDER) {
      if (kind === "nibp") {
        const entry = exact.find((measurement): measurement is NibpMeasurement => measurement.kind === "nibp");
        const detail = nibpMissingDetail(entry);
        if (!entry || detail) missing.push({ kind, label: VITAL_CONFIG[kind].label, ...(detail ? { detail } : {}) });
        if (entry) recordedBandCount += 1;
      } else if (exact.some((measurement) => measurement.kind === kind && Number.isFinite(measurement.value))) {
        recordedBandCount += 1;
      } else {
        missing.push({ kind, label: VITAL_CONFIG[kind].label });
      }
    }
    return missing.length > 0 ? [{ time, missing, recordedBandCount }] : [];
  });
}

export function checkpointTooltip(warning: VitalCheckpointWarning): string {
  const intro = warning.recordedBandCount === 0
    ? "Hier wurde kein Wert eingetragen."
    : "Hier fehlen noch Vitalwerte.";
  const missing = warning.missing.map((item) => item.detail ? `${item.label} – ${item.detail}` : item.label).join(", ");
  return `${intro} Fehlend: ${missing}`;
}

/**
 * Ordnet einen Pointer auch bei ueberlappenden 44-px-Hitflaechen eindeutig dem
 * geometrisch naechsten Kontrollpunkt zu. Bei exakt gleichem Abstand gewinnt
 * der fruehere Zeitpunkt, damit das Ergebnis von der DOM-Reihenfolge unabhaengig ist.
 */
export function nearestCheckpointTime(
  warnings: VitalCheckpointWarning[],
  projectedX: number[],
  pointerX: number,
  maxDistance = 22,
): number | null {
  let bestTime: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < warnings.length; index += 1) {
    const warning = warnings[index];
    const distance = Math.abs((projectedX[index] ?? Number.POSITIVE_INFINITY) - pointerX);
    if (distance > maxDistance) continue;
    if (distance < bestDistance || (distance === bestDistance && (bestTime === null || warning.time < bestTime))) {
      bestTime = warning.time;
      bestDistance = distance;
    }
  }
  return bestTime;
}
