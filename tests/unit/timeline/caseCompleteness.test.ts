import { describe, expect, it } from "vitest";
import { createEmptyPatientData } from "@/lib/constants";
import { evaluateCaseCompleteness } from "@/lib/timeline/caseCompleteness";
import { CASE_SCHEMA_VERSION } from "@/lib/timeline/config";
import type { Measurement, PersistedCase } from "@/types/vitals";

const START = new Date(2026, 7, 2, 13, 2, 17).getTime();
const END = START + 10 * 60_000;
const base = { createdAt: START, updatedAt: START };

function measurementsAt(time: number): Measurement[] {
  return [
    { id: `s-${time}`, kind: "spo2", time, value: 98, ...base },
    { id: `h-${time}`, kind: "heartRate", time, value: 70, ...base },
    { id: `t-${time}`, kind: "temperature", time, value: 36.7, ...base },
    { id: `n-${time}`, kind: "nibp", time, systolic: 120, mean: 90, diastolic: 70, ...base },
  ];
}

function completeCase(): PersistedCase {
  return {
    schemaVersion: CASE_SCHEMA_VERSION,
    caseId: "vollstaendig",
    caseRevision: 1,
    lastSuccessfullyExportedRevision: null,
    startedAt: START,
    endedAt: END,
    measurements: [...measurementsAt(START + 5 * 60_000), ...measurementsAt(END)],
    medications: [],
    infusions: [],
    events: [],
    lastSavedAt: END,
  };
}

describe("Vollständigkeitsprüfung", () => {
  it("meldet einen formal vollständigen Fall ohne Warnung", () => {
    const patient = { ...createEmptyPatientData(), birthDate: "01.01.1980", operationDate: "02.08.2026" };
    const result = evaluateCaseCompleteness(completeCase(), patient, undefined, END);
    expect(result.hasWarnings).toBe(false);
    expect(result.checks.every((check) => check.status === "complete")).toBe(true);
  });

  it("weist transparent auf vollständig fehlende Basisdaten hin, ohne neue Pflichtfelder zu erfinden", () => {
    const result = evaluateCaseCompleteness(completeCase(), null, undefined, END);
    expect(result.issues).toContainEqual(expect.objectContaining({ id: "basisdaten-fehlen", status: "information" }));
  });

  it("meldet ungültige vorhandene Basisdaten", () => {
    const patient = { ...createEmptyPatientData(), birthDate: "01.13.1980" };
    expect(evaluateCaseCompleteness(completeCase(), patient, undefined, END).issues).toContainEqual(
      expect.objectContaining({ id: "basisdaten-ungueltig", status: "warning" }),
    );
  });

  it("findet eine offene Infusion", () => {
    const caseData = completeCase();
    caseData.infusions = [{ id: "i", kind: "infusion", name: "Demo", startedAt: START, amount: 1, unit: { label: "ml", code: "mL", system: "UCUM", isCustom: false }, concentration: null, endedAt: null, ongoing: true, ...base }];
    expect(evaluateCaseCompleteness(caseData, createEmptyPatientData(), undefined, END).issues).toContainEqual(
      expect.objectContaining({ id: "therapien-offen" }),
    );
  });

  it("findet eine nicht beendete kontinuierliche Medikamentengabe", () => {
    const caseData = completeCase();
    caseData.medications = [{ id: "m", kind: "medication", administrationType: "continuous", name: "Demo", startedAt: START, dose: 1, unit: { label: "mg/h", code: "mg/h", system: "UCUM", isCustom: false }, concentration: null, endedAt: null, ongoing: false, ...base }];
    expect(evaluateCaseCompleteness(caseData, createEmptyPatientData(), undefined, END).issues).toContainEqual(
      expect.objectContaining({ id: "therapien-offen" }),
    );
  });

  it("übernimmt fehlende Vitalwert-Kontrollpunkte aus der bestehenden Ableitung", () => {
    const caseData = completeCase();
    caseData.measurements = [];
    expect(evaluateCaseCompleteness(caseData, createEmptyPatientData(), undefined, END).issues).toContainEqual(
      expect.objectContaining({ id: "vitals-checkpoints-offen" }),
    );
  });

  it("prüft nur ausdrücklich konfigurierte Pflicht-Ereignisse", () => {
    const emptyConfig = evaluateCaseCompleteness(completeCase(), createEmptyPatientData(), { requiredEventTypes: [] }, END);
    expect(emptyConfig.issues.some((issue) => issue.category === "events")).toBe(false);
    const configured = evaluateCaseCompleteness(completeCase(), createEmptyPatientData(), { requiredEventTypes: ["incision"] }, END);
    expect(configured.issues).toContainEqual(expect.objectContaining({ id: "events-konfiguriert-fehlen" }));
  });

  it("liefert bei Reload-identischen Daten dasselbe Ergebnis und verändert den Fall nicht", () => {
    const caseData = completeCase();
    caseData.infusions = [{ id: "i", kind: "infusion", name: "Demo", startedAt: START, amount: 1, unit: { label: "ml", code: "mL", system: "UCUM", isCustom: false }, concentration: null, endedAt: null, ongoing: true, ...base }];
    const before = JSON.stringify(caseData);
    const first = evaluateCaseCompleteness(caseData, createEmptyPatientData(), undefined, END);
    const second = evaluateCaseCompleteness(JSON.parse(before) as PersistedCase, createEmptyPatientData(), undefined, END);
    expect(second).toEqual(first);
    expect(JSON.stringify(caseData)).toBe(before);
  });
});
