"use client";

import { create } from "zustand";
import { CASE_ID, CASE_SCHEMA_VERSION } from "../lib/timeline/config";
import { clearCase, loadCase, saveCase } from "../lib/timeline/casePersistence";
import { createId, findNearestSameKind, isValidSpo2 } from "../lib/timeline/measurementUtils";
import { validateTherapyEnd } from "../lib/timeline/therapyTime";
import type {
  InfusionEntry,
  Measurement,
  MedicationEntry,
  PersistedCase,
  SaveStatus,
  ScalarKind,
  TimelineEvent,
  TimelineEventType,
} from "../types/vitals";

export interface NewScalar {
  kind: ScalarKind;
  time: number;
  value: number;
}
export interface NewNibp {
  kind: "nibp";
  time: number;
  systolic: number | null;
  mean: number;
  diastolic: number | null;
}
export type NewMeasurement = NewScalar | NewNibp;

export type NewMedication = Omit<MedicationEntry, "id" | "kind" | "createdAt" | "updatedAt">;
export type NewInfusion = Omit<InfusionEntry, "id" | "kind" | "createdAt" | "updatedAt">;

export interface CaseState {
  hydrated: boolean;
  loadError: boolean;
  startedAt: number | null;
  endedAt: number | null;
  measurements: Measurement[];
  medications: MedicationEntry[];
  infusions: InfusionEntry[];
  events: TimelineEvent[];
  saveStatus: SaveStatus;
  lastSavedAt: number | null;

  hydrate: () => void;
  startCase: () => void;
  endCase: () => void;
  updateEndedAt: (time: number) => void;
  addMeasurement: (input: NewMeasurement) => Measurement;
  updateScalar: (id: string, time: number, value: number) => void;
  updateNibp: (
    id: string,
    time: number,
    systolic: number | null,
    mean: number,
    diastolic: number | null,
  ) => void;
  removeMeasurement: (id: string) => void;
  addMedication: (input: NewMedication) => MedicationEntry;
  updateMedication: (id: string, input: NewMedication) => void;
  removeMedication: (id: string) => void;
  addInfusion: (input: NewInfusion) => InfusionEntry;
  updateInfusion: (id: string, input: NewInfusion) => void;
  removeInfusion: (id: string) => void;
  updateTherapyEnd: (kind: "medication" | "infusion", id: string, endedAt: number) => boolean;
  upsertEvent: (eventType: TimelineEventType, time: number) => TimelineEvent;
  updateEventTime: (id: string, time: number) => void;
  updateEvent: (id: string, eventType: TimelineEventType, time: number) => void;
  removeEvent: (id: string) => void;
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
  const { startedAt, endedAt, measurements, medications, infusions, events } = get();
  const savedAt = Date.now();
  const payload: PersistedCase = {
    schemaVersion: CASE_SCHEMA_VERSION,
    caseId: CASE_ID,
    startedAt,
    endedAt,
    measurements,
    medications,
    infusions,
    events,
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
  endedAt: null,
  measurements: [],
  medications: [],
  infusions: [],
  events: [],
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
    const { startedAt, endedAt, measurements, medications, infusions, events, lastSavedAt } = result.data;
    set({
      hydrated: true,
      loadError: false,
      startedAt,
      endedAt,
      measurements,
      medications,
      infusions,
      events,
      lastSavedAt,
      saveStatus:
        startedAt !== null || measurements.length > 0 || medications.length > 0 || infusions.length > 0 || events.length > 0
          ? "saved"
          : "idle",
    });
  },

  startCase: () => {
    if (get().startedAt !== null) return; // Start ist einmalig und aendert sich nicht.
    set({ startedAt: Date.now() });
    persist(get, set);
  },

  endCase: () => {
    const { startedAt, endedAt } = get();
    if (startedAt === null || endedAt !== null) return;
    set({ endedAt: Date.now() });
    persist(get, set);
  },

  updateEndedAt: (time) => {
    if (get().startedAt === null) return;
    set({ endedAt: time });
    persist(get, set);
  },

  addMeasurement: (input) => {
    if (input.kind === "spo2" && !isValidSpo2(input.value)) {
      throw new RangeError("Der SpO₂-Wert muss zwischen 0 und 100 % liegen.");
    }
    const now = Date.now();
    const duplicate = findNearestSameKind(get().measurements, input.kind, input.time);
    if (duplicate) {
      const measurement: Measurement = input.kind === "nibp" && duplicate.kind === "nibp"
        ? {
            ...duplicate,
            time: input.time,
            systolic: input.systolic,
            mean: input.mean,
            diastolic: input.diastolic,
            updatedAt: now,
          }
        : input.kind !== "nibp" && duplicate.kind !== "nibp"
          ? { ...duplicate, time: input.time, value: input.value, updatedAt: now }
          : duplicate;
      set({ measurements: get().measurements.map((item) => item.id === duplicate.id ? measurement : item) });
      persist(get, set);
      return measurement;
    }
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
    const current = get().measurements.find((measurement) => measurement.id === id);
    if (current?.kind === "spo2" && !isValidSpo2(value)) {
      throw new RangeError("Der SpO₂-Wert muss zwischen 0 und 100 % liegen.");
    }
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

  addMedication: (input) => {
    if (!validateTherapyEnd(input.startedAt, input.endedAt, input.ongoing)) {
      throw new RangeError("Das Ende muss nach dem Beginn liegen.");
    }
    const now = Date.now();
    const medication: MedicationEntry = {
      ...input,
      id: createId(),
      kind: "medication",
      createdAt: now,
      updatedAt: now,
    };
    set({ medications: [...get().medications, medication] });
    persist(get, set);
    return medication;
  },

  updateMedication: (id, input) => {
    if (!validateTherapyEnd(input.startedAt, input.endedAt, input.ongoing)) {
      throw new RangeError("Das Ende muss nach dem Beginn liegen.");
    }
    const now = Date.now();
    set({
      medications: get().medications.map((item) =>
        item.id === id ? { ...item, ...input, updatedAt: now } : item,
      ),
    });
    persist(get, set);
  },

  removeMedication: (id) => {
    set({ medications: get().medications.filter((item) => item.id !== id) });
    persist(get, set);
  },

  addInfusion: (input) => {
    if (!validateTherapyEnd(input.startedAt, input.endedAt, input.ongoing)) {
      throw new RangeError("Das Ende muss nach dem Beginn liegen.");
    }
    const now = Date.now();
    const infusion: InfusionEntry = {
      ...input,
      id: createId(),
      kind: "infusion",
      createdAt: now,
      updatedAt: now,
    };
    set({ infusions: [...get().infusions, infusion] });
    persist(get, set);
    return infusion;
  },

  updateInfusion: (id, input) => {
    if (!validateTherapyEnd(input.startedAt, input.endedAt, input.ongoing)) {
      throw new RangeError("Das Ende muss nach dem Beginn liegen.");
    }
    const now = Date.now();
    set({
      infusions: get().infusions.map((item) =>
        item.id === id ? { ...item, ...input, updatedAt: now } : item,
      ),
    });
    persist(get, set);
  },

  removeInfusion: (id) => {
    set({ infusions: get().infusions.filter((item) => item.id !== id) });
    persist(get, set);
  },

  updateTherapyEnd: (kind, id, endedAt) => {
    const list = kind === "medication" ? get().medications : get().infusions;
    const entry = list.find((item) => item.id === id);
    if (!entry || !Number.isFinite(endedAt) || endedAt <= entry.startedAt) return false;
    const now = Date.now();
    if (kind === "medication") {
      set({
        medications: get().medications.map((item) =>
          item.id === id ? { ...item, endedAt, ongoing: false, updatedAt: now } : item,
        ),
      });
    } else {
      set({
        infusions: get().infusions.map((item) =>
          item.id === id ? { ...item, endedAt, ongoing: false, updatedAt: now } : item,
        ),
      });
    }
    persist(get, set);
    return true;
  },

  upsertEvent: (eventType, time) => {
    const now = Date.now();
    const event: TimelineEvent = {
      id: createId(),
      kind: "event",
      eventType,
      time,
      createdAt: now,
      updatedAt: now,
    };
    set({ events: [...get().events, event] });
    persist(get, set);
    return event;
  },

  updateEventTime: (id, time) => {
    const now = Date.now();
    set({
      events: get().events.map((item) =>
        item.id === id ? { ...item, time, updatedAt: now } : item,
      ),
    });
    persist(get, set);
  },

  updateEvent: (id, eventType, time) => {
    const now = Date.now();
    set({
      events: get().events.map((item) => item.id === id ? { ...item, eventType, time, updatedAt: now } : item),
    });
    persist(get, set);
  },

  removeEvent: (id) => {
    set({ events: get().events.filter((item) => item.id !== id) });
    persist(get, set);
  },

  resetCase: () => {
    clearCase();
    if (savedTimer) clearTimeout(savedTimer);
    set({
      startedAt: null,
      endedAt: null,
      measurements: [],
      medications: [],
      infusions: [],
      events: [],
      loadError: false,
      saveStatus: "idle",
      lastSavedAt: null,
    });
  },
}));
