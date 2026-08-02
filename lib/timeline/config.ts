import type { VitalKind } from "../../types/vitals";

export interface BandConfig {
  kind: VitalKind;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  precision: number; // Nachkommastellen fuer Anzeige/Rundung
  height: number; // Bandhoehe in px
  yTickStep: number; // Schrittweite der Y-Achsen-Ticks
}

// Zentrale Konfiguration je Vitalparameter (Anzeige-Bereiche, keine medizinische
// Empfehlung – nur Darstellungsbereich der Demo).
export const VITAL_CONFIG: Record<VitalKind, BandConfig> = {
  spo2: { kind: "spo2", label: "SpO₂", unit: "%", min: 70, max: 100, step: 1, precision: 0, height: 160, yTickStep: 10 },
  heartRate: { kind: "heartRate", label: "Herzfrequenz", unit: "/min", min: 30, max: 200, step: 1, precision: 0, height: 150, yTickStep: 40 },
  nibp: { kind: "nibp", label: "Nichtinvasiver Blutdruck", unit: "mmHg", min: 30, max: 220, step: 1, precision: 0, height: 170, yTickStep: 40 },
  temperature: { kind: "temperature", label: "Temperatur", unit: "°C", min: 34, max: 41, step: 0.1, precision: 1, height: 150, yTickStep: 1 },
};

// Reihenfolge der Baender von oben nach unten.
export const BAND_ORDER: VitalKind[] = ["spo2", "heartRate", "nibp", "temperature"];

// Semantische Farbtokens (Quelle der Wahrheit sind die CSS-Variablen in globals.css;
// hier gespiegelt fuer die Nutzung in SVG-Attributen).
export const VITAL_COLOR_VAR: Record<VitalKind, string> = {
  spo2: "var(--vital-spo2)",
  heartRate: "var(--vital-heart-rate)",
  nibp: "var(--vital-nibp)",
  temperature: "var(--vital-temperature)",
};

// Leicht anpassbare Sabitler.
export const FUTURE_WINDOW_MS = 30 * 60 * 1000; // 30 Minuten Vorschau nach rechts
export const TICK_INTERVAL_MS = 5 * 60 * 1000; // 5-Minuten-Raster
export const MINOR_TICK_INTERVAL_MS = 60 * 1000; // 1-Minuten-Raster
export const NEAR_DUPLICATE_MS = 30 * 1000; // Toleranz: gleicher Punkt statt Duplikat
export const NOW_SNAP_PX = 6; // Nahe der Jetzt-Linie -> Zeit = jetzt

export const HIT_RADIUS_PX = {
  mouse: 12,
  pen: 16,
  touch: 18,
} as const;

// Layout-Konstanten des gemeinsamen SVG.
export const LAYOUT = {
  marginLeft: 176,
  marginRight: 32,
  marginTop: 16,
  axisHeight: 52,
  bandGap: 10,
  bandTitleSpace: 12,
  bandPaddingBottom: 12,
  therapyLaneHeight: 96,
  eventLaneHeight: 110,
  therapyLaneGap: 6,
  therapyGapAfter: 14,
};

// Persistenz.
export const CASE_STORAGE_KEY = "sikant-anesthesia-demo-case:v1";
export const CASE_SCHEMA_VERSION = 6;
export const CASE_ID = "demo-case-001";

export function createCaseId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `op-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
