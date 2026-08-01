import { CASE_SCHEMA_VERSION } from "./config";
import type { PatientBaseData } from "../../types/patient";
import type { PersistedCase } from "../../types/vitals";

export interface CaseExportSnapshot extends PersistedCase {
  exportVersion: 1;
  persistenceSchemaVersion: number;
  basisdaten: PatientBaseData | null;
  archivedAt: string;
}

export interface DirectoryHandleLike {
  name?: string;
  getFileHandle(name: string, options: { create: true }): Promise<{
    createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
  }>;
}

export type CaseSaveReceipt = {
  method: "directory" | "share" | "download";
  fileName: string;
  destinationName?: string;
};

export function buildCaseExportSnapshot(
  caseData: PersistedCase,
  basisdaten: PatientBaseData | null,
  archivedAt: string = new Date().toISOString(),
): CaseExportSnapshot {
  return {
    ...caseData,
    schemaVersion: CASE_SCHEMA_VERSION,
    exportVersion: 1,
    persistenceSchemaVersion: CASE_SCHEMA_VERSION,
    basisdaten,
    archivedAt,
  };
}

function safeFilePart(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/[. ]+$/g, "")
    .slice(0, 70) || "nicht-angegeben";
}

export function caseSnapshotFileName(snapshot: CaseExportSnapshot): string {
  const opDate = snapshot.basisdaten?.operationDate || "ohne-OP-Datum";
  const compactTime = snapshot.archivedAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `Narkosefall_${safeFilePart(snapshot.caseId)}_${safeFilePart(opDate)}_${safeFilePart(compactTime)}.json`;
}

export function snapshotFile(snapshot: CaseExportSnapshot): File {
  return new File([JSON.stringify(snapshot, null, 2)], caseSnapshotFileName(snapshot), {
    type: "application/json",
    lastModified: Date.now(),
  });
}

export function directoryPickerSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export async function chooseDirectory(): Promise<DirectoryHandleLike> {
  const picker = (window as Window & {
    showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<DirectoryHandleLike>;
  }).showDirectoryPicker;
  if (!picker) throw new Error("Die Ordnerauswahl wird von diesem Browser nicht unterstützt.");
  return picker({ mode: "readwrite" });
}

export async function writeSnapshotToDirectory(
  snapshot: CaseExportSnapshot,
  directory: DirectoryHandleLike,
): Promise<CaseSaveReceipt> {
  const fileName = caseSnapshotFileName(snapshot);
  const fileHandle = await directory.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(snapshotFile(snapshot));
  await writable.close();
  return { method: "directory", fileName, ...(directory.name ? { destinationName: directory.name } : {}) };
}

export async function shareOrDownloadSnapshot(snapshot: CaseExportSnapshot): Promise<CaseSaveReceipt> {
  const file = snapshotFile(snapshot);
  const shareData: ShareData = { files: [file], title: "Narkosefall speichern" };
  if (typeof navigator.share === "function" && navigator.canShare?.(shareData)) {
    await navigator.share(shareData);
    return { method: "share", fileName: file.name };
  }
  const url = URL.createObjectURL(file);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
  return { method: "download", fileName: file.name };
}

export function isPickerCancellation(reason: unknown): boolean {
  return reason instanceof DOMException && reason.name === "AbortError";
}
