import type { PatientBaseData } from "../types/patient";
import { STORAGE_KEY } from "./constants";
import { parsePatientData } from "./patient-validation";

/**
 * SSR-sicherer Zugriff auf localStorage. Gibt null zurueck, wenn kein Browser
 * vorhanden ist oder der Zugriff blockiert wird (z.B. strenger Privatmodus).
 */
function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Liest die gespeicherten Daten. Gibt null zurueck, wenn nichts Gueltiges
 * vorhanden ist. Beschaedigtes JSON fuehrt nicht zum Absturz. Wirft nie.
 */
export function loadPatientData(): PatientBaseData | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    return parsePatientData(JSON.parse(raw));
  } catch {
    // Ungueltiges/beschaedigtes JSON o.ae. -> App darf nicht abstuerzen.
    return null;
  }
}

/**
 * Schreibt die Daten nach localStorage. Wirft bei Fehler (z.B. Speicherplatz
 * voll oder blockierter Storage), damit der Aufrufer einen Fehlerzustand zeigen kann.
 */
export function savePatientData(data: PatientBaseData): void {
  const storage = getStorage();
  if (!storage) {
    throw new Error("localStorage ist nicht verfügbar.");
  }
  storage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** Entfernt den gespeicherten Eintrag. Wirft nie. */
export function clearPatientData(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Nicht kritisch – bewusst ignoriert.
  }
}

/**
 * Best-Effort-Anfrage nach dauerhaftem Speicher. Wird der Aufruf nicht
 * unterstuetzt oder abgelehnt, funktioniert die App trotzdem weiter.
 */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.persist) {
      await navigator.storage.persist();
    }
  } catch {
    // Bewusst ignoriert.
  }
}
