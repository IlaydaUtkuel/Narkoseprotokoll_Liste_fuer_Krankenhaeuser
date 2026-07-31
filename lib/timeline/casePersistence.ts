import { CASE_ID, CASE_SCHEMA_VERSION, CASE_STORAGE_KEY } from "./config";
import type { Measurement, PersistedCase } from "../../types/vitals";

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

// Streng validierend: ein einziger beschaedigter Eintrag macht den Fall ungueltig,
// damit keine stille Teil-Datenrettung passiert.
export function parseCase(raw: unknown): PersistedCase | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== CASE_SCHEMA_VERSION) return null;
  if (!Array.isArray(o.measurements)) return null;

  const measurements: Measurement[] = [];
  for (const item of o.measurements) {
    const m = parseMeasurement(item);
    if (!m) return null;
    measurements.push(m);
  }

  return {
    schemaVersion: CASE_SCHEMA_VERSION,
    caseId: typeof o.caseId === "string" ? o.caseId : CASE_ID,
    startedAt: isFiniteNumber(o.startedAt) ? o.startedAt : null,
    measurements,
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
