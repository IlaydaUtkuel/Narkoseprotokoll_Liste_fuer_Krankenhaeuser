import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCaseStore } from "@/store/anesthesiaCaseStore";
import { loadCase } from "@/lib/timeline/casePersistence";
import { CASE_STORAGE_KEY } from "@/lib/timeline/config";

function resetStore() {
  useCaseStore.setState({
    hydrated: false,
    loadError: false,
    caseId: "test-case",
    caseRevision: 0,
    lastSuccessfullyExportedRevision: null,
    startedAt: null,
    endedAt: null,
    measurements: [],
    medications: [],
    infusions: [],
    events: [],
    saveStatus: "idle",
    lastSavedAt: null,
  });
}

describe("anesthesiaCaseStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    resetStore();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("speichert Startzeit und Messung sofort in localStorage", () => {
    useCaseStore.getState().startCase();
    const started = useCaseStore.getState().startedAt;
    expect(started).not.toBeNull();

    const afterStart = loadCase();
    expect(afterStart.status === "ok" && afterStart.data.startedAt === started).toBe(true);

    useCaseStore.getState().addMeasurement({ kind: "spo2", time: started! + 60_000, value: 95 });
    const afterAdd = loadCase();
    expect(afterAdd.status).toBe("ok");
    if (afterAdd.status === "ok") {
      expect(afterAdd.data.measurements).toHaveLength(1);
      expect(afterAdd.data.measurements[0].kind).toBe("spo2");
    }
  });

  it("stellt Daten nach erneuter Hydration wieder her", () => {
    useCaseStore.getState().startCase();
    const started = useCaseStore.getState().startedAt!;
    useCaseStore.getState().addMeasurement({ kind: "heartRate", time: started + 60_000, value: 72 });

    resetStore();
    expect(useCaseStore.getState().measurements).toHaveLength(0);

    useCaseStore.getState().hydrate();
    expect(useCaseStore.getState().startedAt).toBe(started);
    expect(useCaseStore.getState().measurements).toHaveLength(1);
    expect(useCaseStore.getState().loadError).toBe(false);
  });

  it("meldet loadError bei beschaedigten Daten und ueberschreibt sie nicht still", () => {
    window.localStorage.setItem(CASE_STORAGE_KEY, "{ kaputt");
    useCaseStore.getState().hydrate();
    expect(useCaseStore.getState().loadError).toBe(true);
    expect(useCaseStore.getState().measurements).toHaveLength(0);
    // Beschaedigte Daten bleiben unangetastet (kein stiller Ueberschreibvorgang).
    expect(window.localStorage.getItem(CASE_STORAGE_KEY)).toBe("{ kaputt");
  });

  it("entfernt eine Messung", () => {
    useCaseStore.getState().startCase();
    const started = useCaseStore.getState().startedAt!;
    const m = useCaseStore.getState().addMeasurement({ kind: "spo2", time: started + 1000, value: 90 });
    expect(useCaseStore.getState().measurements).toHaveLength(1);
    useCaseStore.getState().removeMeasurement(m.id);
    expect(useCaseStore.getState().measurements).toHaveLength(0);
    const reloaded = loadCase();
    expect(reloaded.status === "ok" && reloaded.data.measurements.length === 0).toBe(true);
  });

  it("erhöht die Revision bei klinischen Änderungen und markiert nur echten Export als aktuell", () => {
    useCaseStore.getState().startCase();
    expect(useCaseStore.getState().caseRevision).toBe(1);
    const time = useCaseStore.getState().startedAt!;
    useCaseStore.getState().addMeasurement({ kind: "heartRate", time, value: 70 });
    expect(useCaseStore.getState().caseRevision).toBe(2);
    expect(useCaseStore.getState().lastSuccessfullyExportedRevision).toBeNull();
    useCaseStore.getState().markSuccessfullyExported();
    expect(useCaseStore.getState().lastSuccessfullyExportedRevision).toBe(2);
    useCaseStore.getState().updateScalar(useCaseStore.getState().measurements[0].id, time, 71);
    expect(useCaseStore.getState()).toMatchObject({ caseRevision: 3, lastSuccessfullyExportedRevision: 2 });
  });

  it("erhöht die Revision bei einer übernommenen Basisdatenänderung ohne Dokumentation zu verändern", () => {
    useCaseStore.getState().startCase();
    const time = useCaseStore.getState().startedAt!;
    useCaseStore.getState().addMeasurement({ kind: "temperature", time, value: 37 });
    const before = useCaseStore.getState().measurements;
    const revision = useCaseStore.getState().caseRevision;
    useCaseStore.getState().markBasisDataChanged();
    expect(useCaseStore.getState().caseRevision).toBe(revision + 1);
    expect(useCaseStore.getState().measurements).toEqual(before);
  });

  it("speichert endedAt und stellt es nach Hydration wieder her", () => {
    vi.setSystemTime(new Date("2026-08-01T19:00:00"));
    useCaseStore.getState().startCase();
    vi.setSystemTime(new Date("2026-08-01T19:20:00"));
    useCaseStore.getState().endCase();
    const endedAt = useCaseStore.getState().endedAt;
    expect(endedAt).toBe(Date.now());
    expect(loadCase()).toMatchObject({ status: "ok", data: { endedAt } });
    resetStore();
    useCaseStore.getState().hydrate();
    expect(useCaseStore.getState().endedAt).toBe(endedAt);
  });

  it("erstellt, bearbeitet und entfernt Medikamente und Infusionen", () => {
    useCaseStore.getState().startCase();
    const time = useCaseStore.getState().startedAt!;
    const medication = useCaseStore.getState().addMedication({
      administrationType: "bolus",
      name: "Demo",
      startedAt: time,
      dose: 1,
      unit: { label: "mg", code: "mg", system: "UCUM", isCustom: false },
      concentration: null,
      endedAt: time + 20 * 60_000,
      ongoing: false,
    });
    useCaseStore.getState().updateMedication(medication.id, {
      administrationType: "continuous",
      name: "Demo kontinuierlich",
      startedAt: time,
      dose: 2,
      unit: { label: "mg/h", code: "mg/h", system: "UCUM", isCustom: false },
      concentration: null,
      endedAt: null,
      ongoing: true,
    });
    expect(useCaseStore.getState().medications[0]).toMatchObject({ administrationType: "continuous", ongoing: true });
    const infusion = useCaseStore.getState().addInfusion({
      name: "Ringer",
      startedAt: time,
      amount: 500,
      unit: { label: "mL", code: "mL", system: "UCUM", isCustom: false },
      concentration: null,
      endedAt: time + 30 * 60_000,
      ongoing: false,
    });
    expect(loadCase()).toMatchObject({ status: "ok", data: { medications: [{ id: medication.id }], infusions: [{ id: infusion.id }] } });
    useCaseStore.getState().removeMedication(medication.id);
    useCaseStore.getState().removeInfusion(infusion.id);
    expect(useCaseStore.getState().medications).toHaveLength(0);
    expect(useCaseStore.getState().infusions).toHaveLength(0);
  });

  it("akzeptiert SpO₂ 0 und 100 und lehnt Werte außerhalb auch im Store ab", () => {
    useCaseStore.getState().startCase();
    const time = useCaseStore.getState().startedAt!;
    expect(() => useCaseStore.getState().addMeasurement({ kind: "spo2", time, value: 0 })).not.toThrow();
    expect(() => useCaseStore.getState().addMeasurement({ kind: "spo2", time: time + 1, value: 100 })).not.toThrow();
    expect(() => useCaseStore.getState().addMeasurement({ kind: "spo2", time: time + 2, value: -1 })).toThrow(/0 und 100/);
    expect(() => useCaseStore.getState().addMeasurement({ kind: "spo2", time: time + 3, value: 100.1 })).toThrow(/0 und 100/);
  });

  it("bewahrt Temperatur-Zwischenwerte an verschiedenen Timestamps und nach Reload", () => {
    useCaseStore.getState().startCase();
    const time = useCaseStore.getState().startedAt!;
    [35.2, 35.7, 36.1, 36.4, 36.8, 37.2, 38.6].forEach((value, index) => {
      useCaseStore.getState().addMeasurement({ kind: "temperature", time: time + index * 1_000, value });
    });
    expect(useCaseStore.getState().measurements.filter((item) => item.kind === "temperature")).toHaveLength(7);
    resetStore();
    useCaseStore.getState().hydrate();
    expect(useCaseStore.getState().measurements.filter((item) => item.kind === "temperature")).toHaveLength(7);
  });

  it("verschiebt ein Therapieende, beendet ongoing und lehnt Ende vor Beginn ab", () => {
    useCaseStore.getState().startCase();
    const time = useCaseStore.getState().startedAt!;
    const medication = useCaseStore.getState().addMedication({
      administrationType: "continuous",
      name: "Perfusor",
      startedAt: time,
      dose: 1,
      unit: { label: "mg/h", code: "mg/h", system: "UCUM", isCustom: false },
      concentration: null,
      endedAt: null,
      ongoing: true,
    });
    expect(useCaseStore.getState().updateTherapyEnd("medication", medication.id, time - 1)).toBe(false);
    expect(useCaseStore.getState().medications[0]).toMatchObject({ ongoing: true, endedAt: null });
    expect(useCaseStore.getState().updateTherapyEnd("medication", medication.id, time + 47 * 60_000)).toBe(true);
    expect(useCaseStore.getState().medications[0]).toMatchObject({ ongoing: false, endedAt: time + 47 * 60_000 });
    expect(loadCase()).toMatchObject({ status: "ok", data: { medications: [{ endedAt: time + 47 * 60_000 }] } });
  });

  it("persistiert NiBP erst mit Mittelwert und danach mit gezogenen Endpunkten", () => {
    useCaseStore.getState().startCase();
    const time = useCaseStore.getState().startedAt!;
    const measurement = useCaseStore.getState().addMeasurement({
      kind: "nibp",
      time,
      systolic: null,
      mean: 90,
      diastolic: null,
    });
    expect(measurement).toMatchObject({ systolic: null, mean: 90, diastolic: null });
    useCaseStore.getState().updateNibp(measurement.id, time, 125, 90, 68);
    expect(loadCase()).toMatchObject({
      status: "ok",
      data: { measurements: [{ systolic: 125, mean: 90, diastolic: 68 }] },
    });
  });

  it("legt denselben Ereignistyp mehrfach an und persistiert Drag-Zeit", () => {
    useCaseStore.getState().startCase();
    const time = useCaseStore.getState().startedAt!;
    const first = useCaseStore.getState().upsertEvent("incision", time);
    const same = useCaseStore.getState().upsertEvent("incision", time + 1000);
    expect(same.id).not.toBe(first.id);
    expect(useCaseStore.getState().events).toHaveLength(2);
    useCaseStore.getState().updateEventTime(first.id, time + 2000);
    expect(loadCase()).toMatchObject({ status: "ok", data: { events: [expect.objectContaining({ id: first.id, time: time + 2000 }), expect.objectContaining({ id: same.id })] } });
    useCaseStore.getState().removeEvent(first.id);
    expect(useCaseStore.getState().events).toHaveLength(1);
  });

  it("speichert, bearbeitet und entfernt einen Extra-Kommentar", () => {
    useCaseStore.getState().startCase();
    const time = useCaseStore.getState().startedAt!;
    const extra = useCaseStore.getState().upsertEvent("extra", time, "Unerwartete Reaktion");
    expect(loadCase()).toMatchObject({
      status: "ok",
      data: { events: [{ id: extra.id, eventType: "extra", comment: "Unerwartete Reaktion" }] },
    });
    useCaseStore.getState().updateEvent(extra.id, "extra", time + 1_000, "Maßnahme dokumentiert");
    expect(useCaseStore.getState().events[0]).toMatchObject({ comment: "Maßnahme dokumentiert", time: time + 1_000 });
    useCaseStore.getState().removeEvent(extra.id);
    expect(useCaseStore.getState().events).toHaveLength(0);
  });

  it("ändert Ereignistyp und Zeit ohne andere gleichartige Einträge zu löschen", () => {
    useCaseStore.getState().startCase();
    const time = useCaseStore.getState().startedAt!;
    const incision = useCaseStore.getState().upsertEvent("incision", time);
    useCaseStore.getState().upsertEvent("suture", time + 1_000);
    useCaseStore.getState().updateEvent(incision.id, "suture", time + 2_000);
    expect(useCaseStore.getState().events).toHaveLength(2);
    expect(useCaseStore.getState().events).toContainEqual(expect.objectContaining({ id: incision.id, eventType: "suture", time: time + 2_000 }));
  });
});
