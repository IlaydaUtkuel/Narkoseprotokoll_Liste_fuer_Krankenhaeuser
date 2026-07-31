"use client";

import { create } from "zustand";
import { CASE_ID, CASE_SCHEMA_VERSION } from "../lib/timeline/config";
import { clearCase, loadCase, saveCase } from "../lib/timeline/casePersistence";
import { createId } from "../lib/timeline/measurementUtils";
import type { Measurement, PersistedCase, SaveStatus, ScalarKind } from "../types/vitals";

export interface NewScalar {
  kind: ScalarKind;
  time: number;
  value: number;
}
export interface NewNibp {
  kind: "nibp";
  time: number;
  systolic: number;
  mean: number;
  diastolic: number;
}
export type NewMeasurement = NewScalar | NewNibp;

interface CaseState {
  hydrated: boolean;
  loadError: boolean;
  startedAt: number | null;
  measurements: Measurement[];
  saveStatus: SaveStatus;
  lastSavedAt: number | null;

  hydrate: () => void;
  startCase: () => void;
  addMeasurement: (input: NewMeasurement) => Measurement;
  updateScalar: (id: string, time: number, value: number) => void;
  updateNibp: (
    id: string,
    time: number,
    systolic: number,
    mean: number,
    diastolic: number,
  ) => void;
  removeMeasurement: (id: string) => void;
  resetCase: () => void;
}

// Kurze Verzoegerung, damit "Speichert …" sichtbar wird, bevor "Gespeichert" erscheint.
const SAVED_DELAY_MS = 250;
let savedTimer: ReturnType<typeof setTimeout> | null = null;

type Get = () => CaseState;
type Set = (partial: Partial<CaseState>) => void;

// Schreibt den aktuellen Fall SOFORT nach localStorage (eine Operation) und steuert
// die Anzeige "Speichert …" -> "Gespeichert".
function persist(get: Get, set: Set): void {
  const { startedAt, measurements } = get();
  const savedAt = Date.now();
  const payload: PersistedCase = {
    schemaVersion: CASE_SCHEMA_VERSION,
    caseId: CASE_ID,
    startedAt,
    measurements,
    lastSavedAt: savedAt,
  };
  try {
    saveCase(payload);
    set({ saveStatus: "saving" });
    if (savedTimer) clearTimeout(savedTimer);
    savedTimer = setTimeout(() => {
      set({ saveStatus: "saved", lastSavedAt: savedAt });
    }, SAVED_DELAY_MS);
  } catch {
    if (savedTimer) clearTimeout(savedTimer);
    set({ saveStatus: "error" });
  }
}

export const useCaseStore = create<CaseState>((set, get) => ({
  hydrated: false,
  loadError: false,
  startedAt: null,
  measurements: [],
  saveStatus: "idle",
  lastSavedAt: null,

  hydrate: () => {
    const result = loadCase();
    if (result.status === "corrupt") {
      set({ hydrated: true, loadError: true });
      return;
    }
    if (result.status === "empty") {
      set({ hydrated: true, loadError: false });
      return;
    }
    const { startedAt, measurements, lastSavedAt } = result.data;
    set({
      hydrated: true,
      loadError: false,
      startedAt,
      measurements,
      lastSavedAt,
      saveStatus: startedAt !== null || measurements.length > 0 ? "saved" : "idle",
    });
  },

  startCase: () => {
    if (get().startedAt !== null) return; // Start ist einmalig und aendert sich nicht.
    set({ startedAt: Date.now() });
    persist(get, set);
  },

  addMeasurement: (input) => {
    const now = Date.now();
    const measurement: Measurement =
      input.kind === "nibp"
        ? {
            id: createId(),
            kind: "nibp",
            time: input.time,
            systolic: input.systolic,
            mean: input.mean,
            diastolic: input.diastolic,
            createdAt: now,
            updatedAt: now,
          }
        : {
            id: createId(),
            kind: input.kind,
            time: input.time,
            value: input.value,
            createdAt: now,
            updatedAt: now,
          };
    set({ measurements: [...get().measurements, measurement] });
    persist(get, set);
    return measurement;
  },

  updateScalar: (id, time, value) => {
    const now = Date.now();
    set({
      measurements: get().measurements.map((m) =>
        m.id === id && m.kind !== "nibp" ? { ...m, time, value, updatedAt: now } : m,
      ),
    });
    persist(get, set);
  },

  updateNibp: (id, time, systolic, mean, diastolic) => {
    const now = Date.now();
    set({
      measurements: get().measurements.map((m) =>
        m.id === id && m.kind === "nibp"
          ? { ...m, time, systolic, mean, diastolic, updatedAt: now }
          : m,
      ),
    });
    persist(get, set);
  },

  removeMeasurement: (id) => {
    set({ measurements: get().measurements.filter((m) => m.id !== id) });
    persist(get, set);
  },

  resetCase: () => {
    clearCase();
    if (savedTimer) clearTimeout(savedTimer);
    set({
      startedAt: null,
      measurements: [],
      loadError: false,
      saveStatus: "idle",
      lastSavedAt: null,
    });
  },
}));
