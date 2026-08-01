import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  archiveAndCloseCompletedCase,
  CASE_ARCHIVE_STORAGE_KEY,
  loadCaseArchives,
} from "@/lib/timeline/caseArchive";
import { loadPatientData, savePatientData } from "@/lib/patient-storage";
import { loadCase, saveCase } from "@/lib/timeline/casePersistence";
import { CASE_ID, CASE_SCHEMA_VERSION } from "@/lib/timeline/config";
import { buildCaseExportSnapshot } from "@/lib/timeline/caseExport";

const START = new Date(2026, 7, 1, 10, 0, 0).getTime();

describe("caseArchive", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it("archiviert einen beendeten Fall vor dem Leeren der aktiven Daten", () => {
    savePatientData({
      patientName: "Testpatient",
      birthDate: "01.01.2000",
      procedure: "Testeingriff",
      operationDate: "01.08.2026",
      bodyWeightKg: 70,
      weightUnit: "kg",
      asaClass: "II",
      mallampatiClass: "I",
      allergies: "keine",
      updatedAt: new Date(START).toISOString(),
    });
    saveCase({
      schemaVersion: CASE_SCHEMA_VERSION,
      caseId: CASE_ID,
      startedAt: START,
      endedAt: START + 30 * 60_000,
      measurements: [],
      medications: [],
      infusions: [],
      events: [],
      lastSavedAt: START + 30 * 60_000,
    });

    const loaded = loadCase();
    if (loaded.status !== "ok") throw new Error("Testfall fehlt");
    const snapshot = buildCaseExportSnapshot(loaded.data, loadPatientData(), new Date(START + 30 * 60_000).toISOString());
    const archived = archiveAndCloseCompletedCase(snapshot, { method: "directory", fileName: "Narkosefall_test.json", destinationName: "Narkoseprotokolle" });

    expect(archived.fileName).toBe("Narkosefall_test.json");
    expect(archived.saveMethod).toBe("directory");
    expect(archived.patient?.patientName).toBe("Testpatient");
    expect(archived.caseData.endedAt).toBe(START + 30 * 60_000);
    expect(loadCaseArchives()).toHaveLength(1);
    expect(loadCase().status).toBe("empty");
    expect(loadPatientData()).toBeNull();
    expect(window.localStorage.getItem(CASE_ARCHIVE_STORAGE_KEY)).not.toBeNull();
  });

  it("leert einen nicht beendeten Fall bei einem Archivfehler nicht", () => {
    saveCase({
      schemaVersion: CASE_SCHEMA_VERSION,
      caseId: CASE_ID,
      startedAt: START,
      endedAt: null,
      measurements: [],
      medications: [],
      infusions: [],
      events: [],
      lastSavedAt: START,
    });

    const loaded = loadCase();
    if (loaded.status !== "ok") throw new Error("Testfall fehlt");
    const snapshot = buildCaseExportSnapshot(loaded.data, null);
    expect(() => archiveAndCloseCompletedCase(snapshot, { method: "download", fileName: "test.json" })).toThrow(/beendeter Eingriff/);
    expect(loadCase().status).toBe("ok");
    expect(loadCaseArchives()).toHaveLength(0);
  });
});
