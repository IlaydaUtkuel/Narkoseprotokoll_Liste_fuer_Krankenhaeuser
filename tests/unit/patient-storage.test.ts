import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPatientData,
  loadPatientData,
  savePatientData,
} from "@/lib/patient-storage";
import { STORAGE_KEY, createEmptyPatientData } from "@/lib/constants";
import type { PatientBaseData } from "@/types/patient";

const validData: PatientBaseData = {
  patientName: "Max Mustermann",
  birthDate: "1980-01-01",
  procedure: "Appendektomie",
  operationDate: "2026-06-15",
  bodyWeightKg: 75,
  asaClass: "II",
  mallampatiClass: "II",
  allergies: "Keine bekannt",
  updatedAt: "2026-06-01T10:00:00.000Z",
};

describe("patient-storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("laedt gueltige gespeicherte Daten korrekt", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(validData));
    const loaded = loadPatientData();
    expect(loaded).toEqual(validData);
  });

  it("gibt null zurueck, wenn nichts gespeichert ist", () => {
    expect(loadPatientData()).toBeNull();
  });

  it("stuerzt bei beschaedigtem JSON nicht ab, sondern gibt null zurueck", () => {
    window.localStorage.setItem(STORAGE_KEY, "{ das ist kein gueltiges JSON");
    expect(() => loadPatientData()).not.toThrow();
    expect(loadPatientData()).toBeNull();
  });

  it("speichert und stellt auch leere Werte korrekt wieder her", () => {
    const empty = createEmptyPatientData();
    savePatientData(empty);
    expect(loadPatientData()).toEqual(empty);
  });

  it("meldet einen Speicherfehler durch Werfen (Fehlerzustand)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    expect(() => savePatientData(validData)).toThrow();
  });

  it("entfernt den gespeicherten Eintrag", () => {
    savePatientData(validData);
    expect(loadPatientData()).not.toBeNull();
    clearPatientData();
    expect(loadPatientData()).toBeNull();
  });
});
