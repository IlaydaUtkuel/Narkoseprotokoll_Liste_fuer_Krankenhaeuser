import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadCase, parseCase, saveCase } from "@/lib/timeline/casePersistence";
import { CASE_ID, CASE_SCHEMA_VERSION, CASE_STORAGE_KEY } from "@/lib/timeline/config";
import type { PersistedCase } from "@/types/vitals";

const START = new Date(2026, 6, 31, 19, 0, 0).getTime();

const sample: PersistedCase = {
  schemaVersion: CASE_SCHEMA_VERSION,
  caseId: CASE_ID,
  startedAt: START,
  endedAt: null,
  measurements: [
    { id: "a", kind: "spo2", time: START + 60000, value: 95, createdAt: START, updatedAt: START },
    {
      id: "b",
      kind: "nibp",
      time: START + 120000,
      systolic: 120,
      mean: 90,
      diastolic: 70,
      createdAt: START,
      updatedAt: START,
    },
  ],
  medications: [],
  infusions: [],
  events: [],
  lastSavedAt: START + 130000,
};

describe("casePersistence", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it("speichert und laedt einen Fall verlustfrei", () => {
    saveCase(sample);
    const result = loadCase();
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.startedAt).toBe(START);
      expect(result.data.measurements).toHaveLength(2);
      expect(result.data).toEqual(sample);
    }
  });

  it("meldet 'empty', wenn nichts gespeichert ist", () => {
    expect(loadCase().status).toBe("empty");
  });

  it("stuerzt bei beschaedigtem JSON nicht ab, sondern meldet 'corrupt'", () => {
    window.localStorage.setItem(CASE_STORAGE_KEY, "{ kaputt");
    expect(() => loadCase()).not.toThrow();
    expect(loadCase().status).toBe("corrupt");
  });

  it("lehnt eine fremde schemaVersion ab (corrupt, kein stiller Verlust)", () => {
    window.localStorage.setItem(
      CASE_STORAGE_KEY,
      JSON.stringify({ ...sample, schemaVersion: 999 }),
    );
    expect(loadCase().status).toBe("corrupt");
  });

  it("migriert schemaVersion 1 ohne Verlust von Start und Messungen", () => {
    const legacy = {
      schemaVersion: 1,
      caseId: CASE_ID,
      startedAt: START,
      measurements: sample.measurements,
      lastSavedAt: START,
    };
    const migrated = parseCase(legacy);
    expect(migrated).toMatchObject({
      schemaVersion: CASE_SCHEMA_VERSION,
      startedAt: START,
      endedAt: null,
      medications: [],
      infusions: [],
      events: [],
    });
    expect(migrated?.measurements).toEqual(sample.measurements);
  });

  it("migriert schemaVersion 2 und erhält vollständige NiBP-Werte", () => {
    const migrated = parseCase({ ...sample, schemaVersion: 2 });
    expect(migrated).toMatchObject({
      schemaVersion: CASE_SCHEMA_VERSION,
      measurements: [{ kind: "spo2" }, { kind: "nibp", systolic: 120, mean: 90, diastolic: 70 }],
    });
  });

  it("lädt in schemaVersion 3 einen Mittelwert mit noch offenen Griffen", () => {
    const partial = parseCase({
      ...sample,
      measurements: [{
        id: "partial",
        kind: "nibp",
        time: START,
        systolic: null,
        mean: 88,
        diastolic: null,
        createdAt: START,
        updatedAt: START,
      }],
    });
    expect(partial?.measurements[0]).toMatchObject({ systolic: null, mean: 88, diastolic: null });
  });

  it("migriert Alt-Therapien mit Uhrzeit über Mitternacht und freien Einheiten", () => {
    const caseStart = new Date(2026, 7, 1, 23, 30, 0).getTime();
    const migrated = parseCase({
      schemaVersion: 3,
      caseId: CASE_ID,
      startedAt: caseStart,
      endedAt: null,
      measurements: [],
      medications: [{
        id: "legacy-med", kind: "medication", administrationType: "continuous", name: "Alt",
        startTime: "23:45", dose: 1, unit: "Spezial", durationMinutes: null, endTime: "00:32", ongoing: false,
      }],
      infusions: [], events: [], lastSavedAt: caseStart,
    });
    expect(migrated?.medications[0]).toMatchObject({
      unit: { label: "Spezial", system: "custom", isCustom: true },
      ongoing: false,
    });
    expect(new Date(migrated!.medications[0].endedAt!).getDate()).toBe(2);
    expect(migrated!.medications[0].endedAt! - migrated!.medications[0].startedAt).toBe(47 * 60_000);
  });

  it("parseCase lehnt unvollstaendige Messungen ab", () => {
    expect(
      parseCase({ schemaVersion: CASE_SCHEMA_VERSION, measurements: [{ id: "x", kind: "spo2", time: START }] }),
    ).toBeNull();
    expect(
      parseCase({
        schemaVersion: CASE_SCHEMA_VERSION,
        measurements: [{ id: "x", kind: "nibp", time: START, systolic: 120 }],
      }),
    ).toBeNull();
  });
});
