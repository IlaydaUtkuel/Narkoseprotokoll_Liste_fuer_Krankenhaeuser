import { clearPatientData, loadPatientData } from "../patient-storage";
import { clearCase, loadCase } from "./casePersistence";
import type { PatientBaseData } from "../../types/patient";
import type { PersistedCase } from "../../types/vitals";
import type { CaseExportSnapshot, CaseSaveReceipt } from "./caseExport";

export const CASE_ARCHIVE_STORAGE_KEY = "sikant-anesthesia-demo-archives:v1";

export interface ArchivedCase {
  archiveId: string;
  folderPath?: string;
  fileName?: string;
  saveMethod?: CaseSaveReceipt["method"];
  archivedAt: string;
  patient: PatientBaseData | null;
  caseData: PersistedCase;
}

function archiveStorage(): Storage {
  if (typeof window === "undefined") throw new Error("Das lokale Archiv ist nicht verfügbar.");
  return window.localStorage;
}

export function loadCaseArchives(): ArchivedCase[] {
  try {
    const raw = archiveStorage().getItem(CASE_ARCHIVE_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as ArchivedCase[] : [];
  } catch {
    return [];
  }
}

// Schreibt zuerst ein vollstaendiges Archiv. Erst wenn dieser Schreibvorgang
// erfolgreich war, werden der aktive Fall und die Basisdaten freigegeben.
export function archiveAndCloseCompletedCase(
  snapshot: CaseExportSnapshot,
  receipt: CaseSaveReceipt,
): ArchivedCase {
  const loaded = loadCase();
  if (loaded.status !== "ok" || loaded.data.endedAt === null || snapshot.endedAt === null) {
    throw new Error("Nur ein beendeter Eingriff kann gespeichert und geschlossen werden.");
  }

  const archived: ArchivedCase = {
    archiveId: globalThis.crypto?.randomUUID?.() ?? `archive-${Date.now()}`,
    fileName: receipt.fileName,
    saveMethod: receipt.method,
    archivedAt: snapshot.archivedAt,
    patient: snapshot.basisdaten ?? loadPatientData(),
    caseData: snapshot,
  };
  const previous = loadCaseArchives();
  archiveStorage().setItem(CASE_ARCHIVE_STORAGE_KEY, JSON.stringify([...previous, archived]));

  clearPatientData();
  clearCase();
  return archived;
}
