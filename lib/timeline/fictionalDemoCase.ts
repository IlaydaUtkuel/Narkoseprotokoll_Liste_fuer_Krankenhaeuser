import { localTodayDeDate } from "../date-utils";
import type { PatientBaseData } from "../../types/patient";
import type { Measurement, PersistedCase, TherapyUnit, TimelineEvent } from "../../types/vitals";
import { CASE_SCHEMA_VERSION } from "./config";

export const FICTIONAL_DEMO_CASE_PREFIX = "fiktiver-demo-fall-";

const unit = (code: string): TherapyUnit => ({ label: code, code, system: "UCUM", isCustom: false });

function vitalSet(time: number, index: number): Measurement[] {
  const base = { createdAt: time, updatedAt: time };
  return [
    { id: `demo-spo2-${index}`, kind: "spo2", time, value: index === 2 ? 88 : 97, ...base },
    { id: `demo-heart-${index}`, kind: "heartRate", time, value: index === 2 ? 152 : 76 + index, ...base },
    { id: `demo-nibp-${index}`, kind: "nibp", time, systolic: 124 + index * 2, mean: 88 + index, diastolic: 70 + index, ...base },
    { id: `demo-temp-${index}`, kind: "temperature", time, value: 36.5 + index * 0.2, ...base },
  ];
}

function demoEvent(id: string, eventType: TimelineEvent["eventType"], time: number, comment = ""): TimelineEvent {
  return { id, kind: "event", eventType, comment, time, createdAt: time, updatedAt: time };
}

export function createFictionalDemoCase(now = Date.now()): { patient: PatientBaseData; caseData: PersistedCase } {
  const endedAt = Math.floor((now - 5 * 60_000) / 1_000) * 1_000;
  const startedAt = endedAt - 20 * 60_000;
  const patient: PatientBaseData = {
    patientName: "DEMO – Fiktive Person",
    birthDate: "15.06.1980",
    procedure: "Fiktive Demonstrationsoperation",
    operationDate: localTodayDeDate(new Date(now)),
    bodyWeightKg: 72,
    weightUnit: "kg",
    asaClass: "II",
    mallampatiClass: "I",
    allergies: "Keine Allergien bekannt",
    noKnownAllergies: true,
    updatedAt: new Date(now).toISOString(),
  };
  const measurements = [
    ...vitalSet(startedAt + 5 * 60_000, 1),
    ...vitalSet(startedAt + 10 * 60_000, 2),
    ...vitalSet(startedAt + 15 * 60_000, 3).filter((measurement) => measurement.kind !== "temperature"),
  ];
  const caseData: PersistedCase = {
    schemaVersion: CASE_SCHEMA_VERSION,
    caseId: `${FICTIONAL_DEMO_CASE_PREFIX}${new Date(now).toISOString().replace(/\D/g, "").slice(0, 14)}`,
    caseRevision: 1,
    lastSuccessfullyExportedRevision: null,
    startedAt,
    endedAt,
    measurements,
    medications: [
      {
        id: "demo-med-bolus",
        kind: "medication",
        administrationType: "bolus",
        name: "Demo-Bolus",
        startedAt: startedAt + 3 * 60_000,
        dose: 1,
        unit: unit("mg"),
        concentration: null,
        endedAt: null,
        ongoing: false,
        createdAt: startedAt + 3 * 60_000,
        updatedAt: startedAt + 3 * 60_000,
      },
      {
        id: "demo-med-continuous",
        kind: "medication",
        administrationType: "continuous",
        name: "Demo-Perfusor (offen)",
        startedAt: startedAt + 6 * 60_000,
        dose: 2,
        unit: unit("mg/h"),
        concentration: null,
        endedAt: null,
        ongoing: true,
        createdAt: startedAt + 6 * 60_000,
        updatedAt: startedAt + 6 * 60_000,
      },
    ],
    infusions: [
      {
        id: "demo-infusion",
        kind: "infusion",
        name: "Demo-Infusion",
        startedAt: startedAt + 2 * 60_000,
        amount: 250,
        unit: unit("mL"),
        concentration: null,
        endedAt: startedAt + 18 * 60_000,
        ongoing: false,
        createdAt: startedAt + 2 * 60_000,
        updatedAt: startedAt + 18 * 60_000,
      },
    ],
    events: [
      demoEvent("demo-event-start", "anesthesiaStart", startedAt + 60_000),
      demoEvent("demo-event-incision", "incision", startedAt + 4 * 60_000),
      demoEvent("demo-event-extra", "extra", startedAt + 9 * 60_000, "Fiktiver unerwarteter Ablauf – nur zur Demonstration."),
      demoEvent("demo-event-suture", "suture", startedAt + 16 * 60_000),
    ],
    lastSavedAt: now,
  };
  return { patient, caseData };
}

export function isFictionalDemoCase(caseId: string): boolean {
  return caseId.startsWith(FICTIONAL_DEMO_CASE_PREFIX);
}
