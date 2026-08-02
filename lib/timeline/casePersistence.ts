import { CASE_ID, CASE_SCHEMA_VERSION, CASE_STORAGE_KEY } from "./config";
import {
  TIMELINE_EVENT_TYPES,
  type InfusionEntry,
  type Measurement,
  type MedicationEntry,
  type PersistedCase,
  type TimelineEvent,
} from "../../types/vitals";
import { endFromDuration, resolveEndFromClock } from "./therapyTime";
import { migrateTherapyUnit } from "./therapyUnits";

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
    if (!isFiniteNumber(o.mean)) return null;
    const systolic = nullableFiniteNumber(o.systolic);
    const diastolic = nullableFiniteNumber(o.diastolic);
    if (systolic === undefined || diastolic === undefined) return null;
    return {
      id: o.id,
      kind: "nibp",
      time: o.time,
      systolic,
      mean: o.mean,
      diastolic,
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

function parseTherapyTimestamp(
  raw: unknown,
  reference: number | null,
  rollForwardWhenEarlier: boolean,
): number | null | undefined {
  if (raw === null || raw === undefined) return null;
  if (isFiniteNumber(raw)) return raw;
  if (typeof raw !== "string") return undefined;
  const parsedIso = Date.parse(raw);
  if (Number.isFinite(parsedIso)) return parsedIso;
  const clock = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw.trim());
  if (!clock || reference === null) return undefined;
  const hour = Number(clock[1]);
  const minute = Number(clock[2]);
  const second = Number(clock[3] ?? 0);
  if (hour > 23 || minute > 59 || second > 59) return undefined;
  const timestamp = resolveEndFromClock(reference, { hour, minute, second }, null);
  if (rollForwardWhenEarlier) return timestamp;
  const sameDay = new Date(reference);
  sameDay.setHours(hour, minute, second, 0);
  return sameDay.getTime() < reference ? timestamp : sameDay.getTime();
}

function parseConcentration(raw: unknown) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const value = raw as Record<string, unknown>;
  const unit = migrateTherapyUnit(value.unit);
  return isFiniteNumber(value.value) && unit ? { value: value.value, unit } : undefined;
}

function parseMedication(raw: unknown, caseStartedAt: number | null): MedicationEntry | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (
    typeof o.id !== "string" ||
    o.kind !== "medication" ||
    (o.administrationType !== "bolus" && o.administrationType !== "continuous") ||
    typeof o.name !== "string" ||
    !isFiniteNumber(o.dose)
  ) return null;
  const startedAt = parseTherapyTimestamp(o.startedAt ?? o.startTime, caseStartedAt, false);
  if (startedAt === null || startedAt === undefined) return null;
  const ongoing = o.ongoing === true;
  let endedAt = parseTherapyTimestamp(o.endedAt ?? o.endTime, startedAt, true);
  if (endedAt === undefined) return null;
  if (endedAt === null && !ongoing && isFiniteNumber(o.durationMinutes) && o.durationMinutes > 0) {
    endedAt = endFromDuration(startedAt, o.durationMinutes);
  }
  if (ongoing) endedAt = null;
  const unit = migrateTherapyUnit(o.unit);
  const concentration = parseConcentration(o.concentration);
  if (!unit || concentration === undefined) return null;
  const createdAt = isFiniteNumber(o.createdAt) ? o.createdAt : startedAt;
  return {
    id: o.id,
    kind: "medication",
    administrationType: o.administrationType,
    name: o.name,
    startedAt,
    dose: o.dose,
    unit,
    concentration,
    endedAt,
    ongoing,
    createdAt,
    updatedAt: isFiniteNumber(o.updatedAt) ? o.updatedAt : createdAt,
  };
}

function parseInfusion(raw: unknown, caseStartedAt: number | null): InfusionEntry | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (
    typeof o.id !== "string" ||
    o.kind !== "infusion" ||
    typeof o.name !== "string" ||
    !isFiniteNumber(o.amount)
  ) return null;
  const startedAt = parseTherapyTimestamp(o.startedAt ?? o.startTime, caseStartedAt, false);
  if (startedAt === null || startedAt === undefined) return null;
  const ongoing = o.ongoing === true;
  let endedAt = parseTherapyTimestamp(o.endedAt ?? o.endTime, startedAt, true);
  if (endedAt === undefined) return null;
  if (endedAt === null && !ongoing && isFiniteNumber(o.durationMinutes) && o.durationMinutes > 0) {
    endedAt = endFromDuration(startedAt, o.durationMinutes);
  }
  if (ongoing) endedAt = null;
  const unit = migrateTherapyUnit(o.unit);
  const concentration = parseConcentration(o.concentration);
  if (!unit || concentration === undefined) return null;
  const createdAt = isFiniteNumber(o.createdAt) ? o.createdAt : startedAt;
  return {
    id: o.id,
    kind: "infusion",
    name: o.name,
    startedAt,
    amount: o.amount,
    unit,
    concentration,
    endedAt,
    ongoing,
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
  if (o.schemaVersion !== 1 && o.schemaVersion !== 2 && o.schemaVersion !== 3 && o.schemaVersion !== CASE_SCHEMA_VERSION) return null;
  if (!Array.isArray(o.measurements)) return null;

  const measurements: Measurement[] = [];
  for (const item of o.measurements) {
    const m = parseMeasurement(item);
    if (!m) return null;
    measurements.push(m);
  }

  const caseStartedAt = isFiniteNumber(o.startedAt) ? o.startedAt : null;
  const isLegacy = o.schemaVersion === 1;
  const medications = isLegacy ? [] : parseArray(o.medications, (item) => parseMedication(item, caseStartedAt));
  const infusions = isLegacy ? [] : parseArray(o.infusions, (item) => parseInfusion(item, caseStartedAt));
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
