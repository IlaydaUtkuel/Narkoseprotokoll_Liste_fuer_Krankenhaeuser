import { CASE_ID, CASE_SCHEMA_VERSION, CASE_STORAGE_KEY } from "./config";
import {
  TIMELINE_EVENT_TYPES,
  type InfusionEntry,
  type Measurement,
  type MedicationEntry,
  type PersistedCase,
  type TimelineEvent,
} from "../../types/vitals";

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function parseMeasurement(raw: unknown): Measurement | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string") return null;
  if (!isFiniteNumber(o.time)) return null;
  const createdAt = isFiniteNumber(o.createdAt) ? o.createdAt : o.time;
  const updatedAt = isFiniteNumber(o.updatedAt) ? o.updatedAt : createdAt;

  if (o.kind === "spo2" || o.kind === "heartRate" || o.kind === "temperature") {
    if (!isFiniteNumber(o.value)) return null;
    return { id: o.id, kind: o.kind, time: o.time, value: o.value, createdAt, updatedAt };
  }
  if (o.kind === "nibp") {
    if (!isFiniteNumber(o.systolic) || !isFiniteNumber(o.mean) || !isFiniteNumber(o.diastolic)) {
      return null;
    }
    return {
      id: o.id,
      kind: "nibp",
      time: o.time,
      systolic: o.systolic,
      mean: o.mean,
      diastolic: o.diastolic,
      createdAt,
      updatedAt,
    };
  }
  return null;
}

function nullableFiniteNumber(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null;
  return isFiniteNumber(value) ? value : undefined;
}

function parseMedication(raw: unknown): MedicationEntry | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (
    typeof o.id !== "string" ||
    o.kind !== "medication" ||
    (o.administrationType !== "bolus" && o.administrationType !== "continuous") ||
    typeof o.name !== "string" ||
    !isFiniteNumber(o.startTime) ||
    !isFiniteNumber(o.dose) ||
    typeof o.unit !== "string"
  ) return null;
  const durationMinutes = nullableFiniteNumber(o.durationMinutes);
  const endTime = nullableFiniteNumber(o.endTime);
  if (durationMinutes === undefined || endTime === undefined) return null;
  const createdAt = isFiniteNumber(o.createdAt) ? o.createdAt : o.startTime;
  return {
    id: o.id,
    kind: "medication",
    administrationType: o.administrationType,
    name: o.name,
    startTime: o.startTime,
    dose: o.dose,
    unit: o.unit,
    durationMinutes,
    endTime,
    ongoing: o.ongoing === true,
    createdAt,
    updatedAt: isFiniteNumber(o.updatedAt) ? o.updatedAt : createdAt,
  };
}

function parseInfusion(raw: unknown): InfusionEntry | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (
    typeof o.id !== "string" ||
    o.kind !== "infusion" ||
    typeof o.name !== "string" ||
    !isFiniteNumber(o.startTime) ||
    !isFiniteNumber(o.amount) ||
    typeof o.unit !== "string"
  ) return null;
  const durationMinutes = nullableFiniteNumber(o.durationMinutes);
  const endTime = nullableFiniteNumber(o.endTime);
  if (durationMinutes === undefined || endTime === undefined) return null;
  const createdAt = isFiniteNumber(o.createdAt) ? o.createdAt : o.startTime;
  return {
    id: o.id,
    kind: "infusion",
    name: o.name,
    startTime: o.startTime,
    amount: o.amount,
    unit: o.unit,
    durationMinutes,
    endTime,
    ongoing: o.ongoing === true,
    createdAt,
    updatedAt: isFiniteNumber(o.updatedAt) ? o.updatedAt : createdAt,
  };
}

function parseEvent(raw: unknown): TimelineEvent | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (
    typeof o.id !== "string" ||
    o.kind !== "event" ||
    !TIMELINE_EVENT_TYPES.includes(o.eventType as TimelineEvent["eventType"]) ||
    !isFiniteNumber(o.time)
  ) return null;
  const createdAt = isFiniteNumber(o.createdAt) ? o.createdAt : o.time;
  return {
    id: o.id,
    kind: "event",
    eventType: o.eventType as TimelineEvent["eventType"],
    time: o.time,
    createdAt,
    updatedAt: isFiniteNumber(o.updatedAt) ? o.updatedAt : createdAt,
  };
}

function parseArray<T>(raw: unknown, parser: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(raw)) return null;
  const result: T[] = [];
  for (const item of raw) {
    const parsed = parser(item);
    if (!parsed) return null;
    result.push(parsed);
  }
  return result;
}

// Streng validierend: ein einziger beschaedigter Eintrag macht den Fall ungueltig,
// damit keine stille Teil-Datenrettung passiert.
export function parseCase(raw: unknown): PersistedCase | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== 1 && o.schemaVersion !== CASE_SCHEMA_VERSION) return null;
  if (!Array.isArray(o.measurements)) return null;

  const measurements: Measurement[] = [];
  for (const item of o.measurements) {
    const m = parseMeasurement(item);
    if (!m) return null;
    measurements.push(m);
  }

  const isLegacy = o.schemaVersion === 1;
  const medications = isLegacy ? [] : parseArray(o.medications, parseMedication);
  const infusions = isLegacy ? [] : parseArray(o.infusions, parseInfusion);
  const events = isLegacy ? [] : parseArray(o.events, parseEvent);
  if (!medications || !infusions || !events) return null;

  return {
    schemaVersion: CASE_SCHEMA_VERSION,
    caseId: typeof o.caseId === "string" ? o.caseId : CASE_ID,
    startedAt: isFiniteNumber(o.startedAt) ? o.startedAt : null,
    endedAt: isFiniteNumber(o.endedAt) ? o.endedAt : null,
    measurements,
    medications,
    infusions,
    events,
    lastSavedAt: isFiniteNumber(o.lastSavedAt) ? o.lastSavedAt : null,
  };
}

export type LoadResult =
  | { status: "empty" }
  | { status: "ok"; data: PersistedCase }
  | { status: "corrupt" };

export function loadCase(): LoadResult {
  const storage = getStorage();
  if (!storage) return { status: "empty" };
  let raw: string | null;
  try {
    raw = storage.getItem(CASE_STORAGE_KEY);
  } catch {
    return { status: "empty" };
  }
  if (raw === null) return { status: "empty" };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { status: "corrupt" };
  }
  const parsed = parseCase(json);
  if (!parsed) return { status: "corrupt" };
  return { status: "ok", data: parsed };
}

export function saveCase(data: PersistedCase): void {
  const storage = getStorage();
  if (!storage) throw new Error("localStorage ist nicht verfügbar.");
  storage.setItem(CASE_STORAGE_KEY, JSON.stringify(data));
}

export function clearCase(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(CASE_STORAGE_KEY);
  } catch {
    /* nicht kritisch */
  }
}
