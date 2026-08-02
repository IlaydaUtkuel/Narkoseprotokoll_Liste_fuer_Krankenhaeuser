import { parseDeDate } from "../date-utils";
import type { Measurement, NibpMeasurement, ScalarMeasurement, VitalKind } from "../../types/vitals";

export interface CriticalThresholds {
  spo2Lower: number | null;
  mapLower: number | null;
  systolicLower: number | null;
  systolicUpper: number | null;
  diastolicUpper: number | null;
  heartRateLower: number | null;
  heartRateUpper: number | null;
  temperatureLower: number | null;
  temperatureUpper: number | null;
  temperatureRiseDelta: number | null;
  temperatureRiseWindowMinutes: number | null;
}

export type CriticalThresholdSource = "automatic" | "custom";
export type AgeGroup = "minor" | "adult" | "older-adult" | "unknown";

export const EMPTY_CRITICAL_THRESHOLDS: CriticalThresholds = {
  spo2Lower: null,
  mapLower: null,
  systolicLower: null,
  systolicUpper: null,
  diastolicUpper: null,
  heartRateLower: null,
  heartRateUpper: null,
  temperatureLower: null,
  temperatureUpper: null,
  temperatureRiseDelta: null,
  temperatureRiseWindowMinutes: null,
};

export const ADULT_CRITICAL_THRESHOLDS: CriticalThresholds = {
  spo2Lower: 90,
  mapLower: 65,
  systolicLower: 90,
  systolicUpper: 180,
  diastolicUpper: 120,
  heartRateLower: 50,
  heartRateUpper: 150,
  temperatureLower: 36,
  temperatureUpper: 38.5,
  temperatureRiseDelta: 0.5,
  temperatureRiseWindowMinutes: 15,
};

export function calculatePatientAge(birthDate: string, today: Date = new Date()): number | null {
  const parsed = parseDeDate(birthDate);
  if (!parsed) return null;
  const birth = new Date(parsed.year(), parsed.month(), parsed.date());
  const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (birth.getTime() > localToday.getTime()) return null;
  let age = localToday.getFullYear() - birth.getFullYear();
  if (
    localToday.getMonth() < birth.getMonth() ||
    (localToday.getMonth() === birth.getMonth() && localToday.getDate() < birth.getDate())
  ) age -= 1;
  return age;
}

export function ageGroupFor(age: number | null): AgeGroup {
  if (age === null) return "unknown";
  if (age < 18) return "minor";
  if (age < 65) return "adult";
  return "older-adult";
}

export function ageDefaults(age: number | null): CriticalThresholds {
  return age !== null && age >= 18
    ? { ...ADULT_CRITICAL_THRESHOLDS }
    : { ...EMPTY_CRITICAL_THRESHOLDS };
}

export type CriticalValidationErrors = Partial<Record<keyof CriticalThresholds, string>>;

export function validateCriticalThresholds(values: CriticalThresholds): CriticalValidationErrors {
  const errors: CriticalValidationErrors = {};
  for (const [key, value] of Object.entries(values) as [keyof CriticalThresholds, number | null][]) {
    if (value !== null && !Number.isFinite(value)) errors[key] = "Bitte einen endlichen Zahlenwert eingeben.";
  }
  if (values.systolicLower !== null && values.systolicUpper !== null && values.systolicLower >= values.systolicUpper) {
    errors.systolicUpper = "Die systolische Untergrenze muss kleiner als die Obergrenze sein.";
  }
  if (values.heartRateLower !== null && values.heartRateUpper !== null && values.heartRateLower >= values.heartRateUpper) {
    errors.heartRateUpper = "Die Herzfrequenz-Untergrenze muss kleiner als die Obergrenze sein.";
  }
  if (values.temperatureLower !== null && values.temperatureUpper !== null && values.temperatureLower >= values.temperatureUpper) {
    errors.temperatureUpper = "Die Temperatur-Untergrenze muss kleiner als die Obergrenze sein.";
  }
  if (values.temperatureRiseDelta !== null && values.temperatureRiseDelta <= 0) {
    errors.temperatureRiseDelta = "Der Temperaturanstieg muss größer als 0 sein.";
  }
  if (values.temperatureRiseWindowMinutes !== null && values.temperatureRiseWindowMinutes <= 0) {
    errors.temperatureRiseWindowMinutes = "Der Zeitraum muss größer als 0 Minuten sein.";
  }
  return errors;
}

export interface CriticalWarning {
  measurementId: string;
  kind: VitalKind;
  reasons: string[];
  tooltip: string;
}

function scalarWarning(measurement: ScalarMeasurement, reasons: string[], unit: string): CriticalWarning | null {
  if (reasons.length === 0) return null;
  const heading = reasons.length === 1 ? "Kritischer Hinweis:" : "Kritische Hinweise:";
  return {
    measurementId: measurement.id,
    kind: measurement.kind,
    reasons,
    tooltip: `${heading}\n${reasons.map((reason) => `- ${reason}`).join("\n")}\n\nGemessener Wert: ${String(measurement.value).replace(".", ",")} ${unit}`,
  };
}

function nibpWarning(measurement: NibpMeasurement, reasons: string[]): CriticalWarning | null {
  if (reasons.length === 0) return null;
  return {
    measurementId: measurement.id,
    kind: "nibp",
    reasons,
    tooltip: `Kritische Hinweise:\n${reasons.map((reason) => `- ${reason}`).join("\n")}\n\nMesswerte:\nSystolisch: ${measurement.systolic ?? "Nicht angegeben"} mmHg\nMittel: ${measurement.mean} mmHg\nDiastolisch: ${measurement.diastolic ?? "Nicht angegeben"} mmHg`,
  };
}

export function deriveCriticalWarnings(
  measurements: Measurement[],
  thresholds: CriticalThresholds,
): CriticalWarning[] {
  const sortedTemperatures = measurements
    .filter((item): item is ScalarMeasurement => item.kind === "temperature")
    .sort((a, b) => a.time - b.time);
  const warnings: CriticalWarning[] = [];
  for (const measurement of measurements) {
    if (measurement.kind === "spo2") {
      const reasons = thresholds.spo2Lower !== null && measurement.value < thresholds.spo2Lower
        ? [`SpO₂ liegt unter ${thresholds.spo2Lower} %.`]
        : [];
      const warning = scalarWarning(measurement, reasons, "%");
      if (warning) warnings.push(warning);
      continue;
    }
    if (measurement.kind === "heartRate") {
      const reasons: string[] = [];
      if (thresholds.heartRateLower !== null && measurement.value < thresholds.heartRateLower) reasons.push(`Herzfrequenz liegt unter ${thresholds.heartRateLower} /min.`);
      if (thresholds.heartRateUpper !== null && measurement.value >= thresholds.heartRateUpper) reasons.push(`Herzfrequenz liegt bei oder über ${thresholds.heartRateUpper} /min.`);
      const warning = scalarWarning(measurement, reasons, "/min");
      if (warning) warnings.push(warning);
      continue;
    }
    if (measurement.kind === "nibp") {
      const reasons: string[] = [];
      if (thresholds.mapLower !== null && measurement.mean < thresholds.mapLower) reasons.push(`MAP liegt unter ${thresholds.mapLower} mmHg.`);
      if (measurement.systolic !== null && thresholds.systolicLower !== null && measurement.systolic < thresholds.systolicLower) reasons.push(`Systolischer Wert liegt unter ${thresholds.systolicLower} mmHg.`);
      if (measurement.systolic !== null && thresholds.systolicUpper !== null && measurement.systolic > thresholds.systolicUpper) reasons.push(`Systolischer Wert liegt über ${thresholds.systolicUpper} mmHg.`);
      if (measurement.diastolic !== null && thresholds.diastolicUpper !== null && measurement.diastolic > thresholds.diastolicUpper) reasons.push(`Diastolischer Wert liegt über ${thresholds.diastolicUpper} mmHg.`);
      const warning = nibpWarning(measurement, reasons);
      if (warning) warnings.push(warning);
      continue;
    }
    const reasons: string[] = [];
    if (thresholds.temperatureLower !== null && measurement.value < thresholds.temperatureLower) reasons.push(`Temperatur liegt unter ${String(thresholds.temperatureLower).replace(".", ",")} °C.`);
    if (thresholds.temperatureUpper !== null && measurement.value >= thresholds.temperatureUpper) reasons.push(`Temperatur liegt bei oder über ${String(thresholds.temperatureUpper).replace(".", ",")} °C.`);
    if (thresholds.temperatureRiseDelta !== null && thresholds.temperatureRiseWindowMinutes !== null) {
      const windowStart = measurement.time - thresholds.temperatureRiseWindowMinutes * 60_000;
      const baseline = sortedTemperatures.find((item) => item.time >= windowStart && item.time < measurement.time);
      if (baseline && measurement.value - baseline.value > thresholds.temperatureRiseDelta) {
        reasons.push(`Temperatur ist innerhalb von ${thresholds.temperatureRiseWindowMinutes} Minuten um mehr als ${String(thresholds.temperatureRiseDelta).replace(".", ",")} °C gestiegen.`);
      }
    }
    const warning = scalarWarning(measurement, reasons, "°C");
    if (warning) warnings.push(warning);
  }
  return warnings;
}
