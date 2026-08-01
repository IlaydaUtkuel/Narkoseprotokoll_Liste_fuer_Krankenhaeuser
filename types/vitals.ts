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
  systolic: number | null;
  mean: number;
  diastolic: number | null;
}

export type Measurement = ScalarMeasurement | NibpMeasurement;

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type MedicationAdministrationType = "bolus" | "continuous";

export interface MedicationEntry {
  id: string;
  kind: "medication";
  administrationType: MedicationAdministrationType;
  name: string;
  startTime: number;
  dose: number;
  unit: string;
  durationMinutes: number | null;
  endTime: number | null;
  ongoing: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface InfusionEntry {
  id: string;
  kind: "infusion";
  name: string;
  startTime: number;
  amount: number;
  unit: string;
  durationMinutes: number | null;
  endTime: number | null;
  ongoing: boolean;
  createdAt: number;
  updatedAt: number;
}

export const TIMELINE_EVENT_TYPES = [
  "anesthesiaStart",
  "incision",
  "suture",
  "emergenceEnd",
  "patientOut",
] as const;

export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];

export interface TimelineEvent {
  id: string;
  kind: "event";
  eventType: TimelineEventType;
  time: number;
  createdAt: number;
  updatedAt: number;
}

// In localStorage persistierter Fall.
export interface PersistedCase {
  schemaVersion: number;
  caseId: string;
  startedAt: number | null;
  endedAt: number | null;
  measurements: Measurement[];
  medications: MedicationEntry[];
  infusions: InfusionEntry[];
  events: TimelineEvent[];
  lastSavedAt: number | null;
}

export function isNibp(m: Measurement): m is NibpMeasurement {
  return m.kind === "nibp";
}

export function isScalar(m: Measurement): m is ScalarMeasurement {
  return m.kind !== "nibp";
}
