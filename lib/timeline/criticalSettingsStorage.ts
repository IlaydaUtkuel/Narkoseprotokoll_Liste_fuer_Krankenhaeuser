import { ageDefaults, ageGroupFor, calculatePatientAge, EMPTY_CRITICAL_THRESHOLDS, type AgeGroup, type CriticalThresholdSource, type CriticalThresholds } from "./criticalValues";

export const CRITICAL_SETTINGS_PREFIX = "sikant-critical-values:v1:";

export interface CriticalSettings {
  schemaVersion: 1;
  caseId: string;
  birthDate: string;
  ageGroup: AgeGroup;
  thresholds: CriticalThresholds;
  source: CriticalThresholdSource;
  ageChangedNotice: boolean;
}

function storage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

function key(caseId: string) { return `${CRITICAL_SETTINGS_PREFIX}${caseId}`; }

export function createAutomaticCriticalSettings(caseId: string, birthDate: string, today = new Date()): CriticalSettings {
  const age = calculatePatientAge(birthDate, today);
  return {
    schemaVersion: 1,
    caseId,
    birthDate,
    ageGroup: ageGroupFor(age),
    thresholds: ageDefaults(age),
    source: "automatic",
    ageChangedNotice: false,
  };
}

function parseThresholds(raw: unknown): CriticalThresholds | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const parsed = { ...EMPTY_CRITICAL_THRESHOLDS };
  for (const keyName of Object.keys(parsed) as (keyof CriticalThresholds)[]) {
    const value = (raw as Record<string, unknown>)[keyName];
    if (value !== null && value !== undefined && (typeof value !== "number" || !Number.isFinite(value))) return null;
    parsed[keyName] = value == null ? null : value as number;
  }
  return parsed;
}

export function loadCriticalSettings(caseId: string, birthDate: string, today = new Date()): CriticalSettings {
  const store = storage();
  if (store) {
    try {
      const raw = store.getItem(key(caseId));
      if (raw) {
        const value = JSON.parse(raw) as Record<string, unknown>;
        const thresholds = parseThresholds(value.thresholds);
        if (value.schemaVersion === 1 && value.caseId === caseId && thresholds && (value.source === "automatic" || value.source === "custom")) {
          return {
            schemaVersion: 1,
            caseId,
            birthDate: typeof value.birthDate === "string" ? value.birthDate : birthDate,
            ageGroup: ["minor", "adult", "older-adult", "unknown"].includes(String(value.ageGroup)) ? value.ageGroup as AgeGroup : "unknown",
            thresholds,
            source: value.source,
            ageChangedNotice: value.ageChangedNotice === true,
          };
        }
      }
    } catch { /* corrupt UI support state is replaced below */ }
  }
  const created = createAutomaticCriticalSettings(caseId, birthDate, today);
  saveCriticalSettings(created);
  return created;
}

export function saveCriticalSettings(settings: CriticalSettings): void {
  try { storage()?.setItem(key(settings.caseId), JSON.stringify(settings)); } catch { /* UI support remains usable in memory for this render */ }
}

export function syncCriticalSettingsBirthDate(caseId: string, oldBirthDate: string, newBirthDate: string, today = new Date()): CriticalSettings {
  const current = loadCriticalSettings(caseId, oldBirthDate, today);
  const nextAge = calculatePatientAge(newBirthDate, today);
  const nextGroup = ageGroupFor(nextAge);
  const next: CriticalSettings = current.source === "automatic"
    ? {
        ...current,
        birthDate: newBirthDate,
        ageGroup: nextGroup,
        thresholds: current.ageGroup === nextGroup ? current.thresholds : ageDefaults(nextAge),
        ageChangedNotice: false,
      }
    : {
        ...current,
        birthDate: newBirthDate,
        ageGroup: nextGroup,
        ageChangedNotice: oldBirthDate !== newBirthDate,
      };
  saveCriticalSettings(next);
  return next;
}

export function clearCriticalSettings(caseId: string): void {
  try { storage()?.removeItem(key(caseId)); } catch { /* best effort UI cleanup */ }
}
