// Datenmodell der Vital-Timeline. Es werden ausschliesslich echte Zeit- und
// Messwerte gespeichert – niemals Pixelkoordinaten.

export type VitalKind = "spo2" | "heartRate" | "nibp" | "temperature";

// Skalare Parameter (ein Zahlenwert je Zeitpunkt).
export type ScalarKind = "spo2" | "heartRate" | "temperature";

interface BaseMeasurement {
  id: string;
  time: number; // Epoch-Millisekunden
  createdAt: number;
  updatedAt: number;
}

export interface ScalarMeasurement extends BaseMeasurement {
  kind: ScalarKind;
  value: number;
}

// NiBP: drei Werte teilen sich denselben Zeitpunkt.
export interface NibpMeasurement extends BaseMeasurement {
  kind: "nibp";
  systolic: number;
  mean: number;
  diastolic: number;
}

export type Measurement = ScalarMeasurement | NibpMeasurement;

export type SaveStatus = "idle" | "saving" | "saved" | "error";

// In localStorage persistierter Fall.
export interface PersistedCase {
  schemaVersion: number;
  caseId: string;
  startedAt: number | null;
  measurements: Measurement[];
  lastSavedAt: number | null;
}

export function isNibp(m: Measurement): m is NibpMeasurement {
  return m.kind === "nibp";
}

export function isScalar(m: Measurement): m is ScalarMeasurement {
  return m.kind !== "nibp";
}
