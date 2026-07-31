"use client";

import type { FieldSaveStatus } from "../types/patient";
import { TEXT } from "../lib/constants";

export type GlobalStatus = "saved" | "pending" | "error";

/**
 * Leitet aus allen Feld-Status den Gesamtstatus ab:
 * - ein Fehler ueberwiegt alles,
 * - danach zaehlt ein noch wartendes Feld ("saving"),
 * - sonst gilt alles als gespeichert.
 */
export function computeGlobalStatus(statuses: Record<string, FieldSaveStatus>): GlobalStatus {
  const values = Object.values(statuses);
  if (values.includes("error")) return "error";
  if (values.includes("saving")) return "pending";
  return "saved";
}

export function GlobalSaveStatus({ statuses }: { statuses: Record<string, FieldSaveStatus> }) {
  const status = computeGlobalStatus(statuses);

  if (status === "error") {
    return (
      <div className="global-status global-status--error" role="alert" data-testid="global-status">
        {TEXT.globalError}
      </div>
    );
  }
  if (status === "pending") {
    return (
      <div className="global-status global-status--pending" role="status" data-testid="global-status">
        {TEXT.globalPending}
      </div>
    );
  }
  return (
    <div className="global-status global-status--saved" role="status" data-testid="global-status">
      {TEXT.globalSaved}
    </div>
  );
}
