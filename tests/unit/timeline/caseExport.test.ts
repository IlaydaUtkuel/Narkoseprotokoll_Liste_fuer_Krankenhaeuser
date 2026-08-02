import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildCaseExportSnapshot, caseSnapshotFileName, chooseDirectory, writeSnapshotToDirectory } from "@/lib/timeline/caseExport";
import { loadCase, saveCase } from "@/lib/timeline/casePersistence";
import { CASE_ID, CASE_SCHEMA_VERSION } from "@/lib/timeline/config";
import type { PatientBaseData } from "@/types/patient";
import type { PersistedCase } from "@/types/vitals";

const START = 1_000_000;
const patient: PatientBaseData = { patientName: "Test", birthDate: "01.01.2000", procedure: "OP", operationDate: "01.08.2026", bodyWeightKg: 70, weightUnit: "kg", asaClass: "II", mallampatiClass: "I", allergies: "keine", noKnownAllergies: false, updatedAt: null };
const caseData: PersistedCase = {
  schemaVersion: CASE_SCHEMA_VERSION,
  caseId: CASE_ID,
  caseRevision: 4,
  lastSuccessfullyExportedRevision: null,
  startedAt: START,
  endedAt: START + 10_000,
  measurements: [{ id: "n", kind: "nibp", time: START, systolic: 120, mean: 90, diastolic: 70, createdAt: START, updatedAt: START }],
  medications: [{ id: "m", kind: "medication", administrationType: "bolus", name: "A", startedAt: START, dose: 1, unit: { label: "mg", code: "mg", system: "UCUM", isCustom: false }, concentration: null, endedAt: START + 60_000, ongoing: false, createdAt: START, updatedAt: START }],
  infusions: [{ id: "i", kind: "infusion", name: "I", startedAt: START, amount: 1, unit: { label: "mL", code: "mL", system: "UCUM", isCustom: false }, concentration: null, endedAt: START + 120_000, ongoing: false, createdAt: START, updatedAt: START }],
  events: [{ id: "e", kind: "event", eventType: "incision", comment: "", time: START, createdAt: START, updatedAt: START }],
  lastSavedAt: START + 10_000,
};

describe("Falldatei-Export", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    window.localStorage.clear();
    Reflect.deleteProperty(window, "showDirectoryPicker");
  });

  it("enthaelt den vollstaendigen Snapshot und einen Windows-sicheren Namen", () => {
    const snapshot = buildCaseExportSnapshot(caseData, patient, "2026-08-01T12:34:56.000Z");
    expect(snapshot).toMatchObject({ persistenceSchemaVersion: CASE_SCHEMA_VERSION, basisdaten: patient, startedAt: START, endedAt: START + 10_000, caseId: CASE_ID });
    expect(snapshot.measurements[0]).toMatchObject({ systolic: 120, mean: 90, diastolic: 70 });
    expect(snapshot.medications).toHaveLength(1);
    expect(snapshot.infusions).toHaveLength(1);
    expect(snapshot.events).toHaveLength(1);
    expect(caseSnapshotFileName(snapshot)).not.toMatch(/[<>:"/\\|?*]/);
    expect(snapshot).not.toHaveProperty("criticalThresholds");
    expect(snapshot).not.toHaveProperty("derivedCriticalWarnings");
  });

  it("schreibt und schliesst eine echte Datei im gewaehlten Verzeichnis", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const directory = { name: "Fälle", getFileHandle: vi.fn().mockResolvedValue({ createWritable: vi.fn().mockResolvedValue({ write, close }) }) };
    const receipt = await writeSnapshotToDirectory(buildCaseExportSnapshot(caseData, patient), directory);
    expect(write).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(receipt).toMatchObject({ method: "directory", destinationName: "Fälle" });
  });

  it("laesst den aktiven Fall bei abgebrochener Ordnerauswahl unveraendert", async () => {
    saveCase(caseData);
    Object.defineProperty(window, "showDirectoryPicker", { configurable: true, value: vi.fn().mockRejectedValue(new DOMException("Abgebrochen", "AbortError")) });
    await expect(chooseDirectory()).rejects.toMatchObject({ name: "AbortError" });
    expect(loadCase()).toMatchObject({ status: "ok", data: { caseId: CASE_ID } });
  });
});
