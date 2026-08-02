import { BAND_ORDER, VITAL_CONFIG } from "./config";
import type { Measurement, VitalKind } from "../../types/vitals";

export interface VitalScaleDomain {
  min: number;
  max: number;
  ticks: number[];
}

function niceStep(rawStep: number): number {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(rawStep));
  const fraction = rawStep / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

function decimalsFor(step: number): number {
  return Math.max(0, Math.min(6, -Math.floor(Math.log10(step))));
}

export function scaleDomainForValues(kind: VitalKind, values: number[]): VitalScaleDomain {
  if (kind === "spo2") {
    return { min: 0, max: 100, ticks: [0, 20, 40, 60, 80, 100] };
  }
  const finite = values.filter(Number.isFinite);
  const fallback = VITAL_CONFIG[kind];
  if (finite.length === 0) {
    const ticks: number[] = [];
    for (let value = fallback.min; value <= fallback.max + 1e-9; value += fallback.yTickStep) {
      ticks.push(Number(value.toFixed(6)));
    }
    return { min: fallback.min, max: fallback.max, ticks };
  }

  const dataMin = Math.min(...finite);
  const dataMax = Math.max(...finite);
  const dataRange = dataMax - dataMin;
  const fallbackPadding = Math.max((fallback.max - fallback.min) * 0.08, 0.1);
  const padding = dataRange > 0
    ? Math.max(dataRange * 0.1, 10 ** -fallback.precision)
    : Math.max(Math.abs(dataMin) * 0.1, fallbackPadding);
  const paddedMin = dataMin - padding;
  const paddedMax = dataMax + padding;
  const step = niceStep((paddedMax - paddedMin) / 4);
  const min = Math.floor(paddedMin / step) * step;
  const max = Math.ceil(paddedMax / step) * step;
  const precision = decimalsFor(step);
  const ticks: number[] = [];
  for (let value = min; value <= max + step / 2; value += step) {
    ticks.push(Number(value.toFixed(precision)));
  }
  return { min, max: max === min ? min + step : max, ticks };
}

export function computeVitalScaleDomains(
  measurements: Measurement[],
  visibleStart: number,
  visibleEnd: number,
): Record<VitalKind, VitalScaleDomain> {
  const values: Record<VitalKind, number[]> = {
    spo2: [],
    heartRate: [],
    nibp: [],
    temperature: [],
  };
  for (const measurement of measurements) {
    if (measurement.time < visibleStart || measurement.time > visibleEnd) continue;
    if (measurement.kind === "nibp") {
      values.nibp.push(measurement.mean);
      if (measurement.systolic !== null) values.nibp.push(measurement.systolic);
      if (measurement.diastolic !== null) values.nibp.push(measurement.diastolic);
    } else {
      values[measurement.kind].push(measurement.value);
    }
  }
  return Object.fromEntries(
    BAND_ORDER.map((kind) => [kind, scaleDomainForValues(kind, values[kind])]),
  ) as Record<VitalKind, VitalScaleDomain>;
}

export function formatAxisTick(kind: VitalKind, value: number): string {
  const precision = kind === "temperature" || !Number.isInteger(value) ? Math.min(2, Math.max(1, decimalsFor(Math.abs(value) || 1))) : 0;
  return value.toFixed(precision).replace(".", ",");
}
