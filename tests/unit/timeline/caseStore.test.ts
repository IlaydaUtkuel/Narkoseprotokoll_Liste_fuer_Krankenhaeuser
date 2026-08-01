import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCaseStore } from "@/store/anesthesiaCaseStore";
import { loadCase } from "@/lib/timeline/casePersistence";
import { CASE_STORAGE_KEY } from "@/lib/timeline/config";

function resetStore() {
  useCaseStore.setState({
    hydrated: false,
    loadError: false,
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
      startTime: time,
      dose: 1,
      unit: "mg",
      durationMinutes: 20,
      endTime: null,
      ongoing: false,
    });
    useCaseStore.getState().updateMedication(medication.id, {
      administrationType: "continuous",
      name: "Demo kontinuierlich",
      startTime: time,
      dose: 2,
      unit: "mg/h",
      durationMinutes: null,
      endTime: null,
      ongoing: true,
    });
    expect(useCaseStore.getState().medications[0]).toMatchObject({ administrationType: "continuous", ongoing: true });
    const infusion = useCaseStore.getState().addInfusion({
      name: "Ringer",
      startTime: time,
      amount: 500,
      unit: "ml",
      durationMinutes: 30,
      endTime: null,
      ongoing: false,
    });
    expect(loadCase()).toMatchObject({ status: "ok", data: { medications: [{ id: medication.id }], infusions: [{ id: infusion.id }] } });
    useCaseStore.getState().removeMedication(medication.id);
    useCaseStore.getState().removeInfusion(infusion.id);
    expect(useCaseStore.getState().medications).toHaveLength(0);
    expect(useCaseStore.getState().infusions).toHaveLength(0);
  });

  it("legt jedes Pflicht-Ereignis nur einmal an und persistiert Drag-Zeit", () => {
    useCaseStore.getState().startCase();
    const time = useCaseStore.getState().startedAt!;
    const first = useCaseStore.getState().upsertEvent("incision", time);
    const same = useCaseStore.getState().upsertEvent("incision", time + 1000);
    expect(same.id).toBe(first.id);
    expect(useCaseStore.getState().events).toHaveLength(1);
    useCaseStore.getState().updateEventTime(first.id, time + 2000);
    expect(loadCase()).toMatchObject({ status: "ok", data: { events: [{ time: time + 2000 }] } });
    useCaseStore.getState().removeEvent(first.id);
    expect(useCaseStore.getState().events).toHaveLength(0);
  });
});
