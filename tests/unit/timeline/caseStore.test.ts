import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCaseStore } from "@/store/anesthesiaCaseStore";
import { loadCase } from "@/lib/timeline/casePersistence";
import { CASE_STORAGE_KEY } from "@/lib/timeline/config";

function resetStore() {
  useCaseStore.setState({
    hydrated: false,
    loadError: false,
    startedAt: null,
    measurements: [],
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
});
