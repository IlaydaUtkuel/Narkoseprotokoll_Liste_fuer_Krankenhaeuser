"use client";

import type { FieldSaveStatus } from "../types/patient";
import { TEXT } from "../lib/constants";

interface Props {
  status?: FieldSaveStatus;
  /** data-testid fuer gezielte Pruefungen (z.B. "status-patientName"). */
  testId?: string;
}

/**
 * Zeigt den Speicherstatus eines einzelnen Feldes rechts neben dem Feld an:
 * "Wird gespeichert …" (neutral), "✓ Gespeichert" (gruen) oder
 * "Speichern fehlgeschlagen" (rot).
 */
export function AutosaveFieldStatus({ status, testId }: Props) {
  if (!status || status === "idle") {
    // Platzhalter, damit das Layout nicht springt.
    return <span className="field-status field-status--idle" data-testid={testId} aria-hidden="true" />;
  }
  if (status === "saving") {
    return (
      <span className="field-status field-status--saving" role="status" data-testid={testId}>
        {TEXT.fieldSaving}
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="field-status field-status--saved" role="status" data-testid={testId}>
        {TEXT.fieldSaved}
      </span>
    );
  }
  return (
    <span className="field-status field-status--error" role="alert" data-testid={testId}>
      {TEXT.fieldError}
    </span>
  );
}
