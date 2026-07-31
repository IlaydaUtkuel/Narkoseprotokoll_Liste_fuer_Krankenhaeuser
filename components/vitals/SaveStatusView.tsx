"use client";

import { formatClock } from "../../lib/timeline/format";
import { useCaseStore } from "../../store/anesthesiaCaseStore";

// Zeigt den Speicherzustand: Speichert … / Gespeichert · HH:mm:ss / Speicherfehler.
export function SaveStatusView() {
  const saveStatus = useCaseStore((s) => s.saveStatus);
  const lastSavedAt = useCaseStore((s) => s.lastSavedAt);

  if (saveStatus === "saving") {
    return (
      <span className="save-status save-status--saving" data-testid="save-status">
        Speichert …
      </span>
    );
  }
  if (saveStatus === "error") {
    return (
      <span className="save-status save-status--error" data-testid="save-status">
        Speicherfehler
      </span>
    );
  }
  if (saveStatus === "saved") {
    return (
      <span className="save-status save-status--saved" data-testid="save-status">
        Gespeichert{lastSavedAt ? ` · ${formatClock(lastSavedAt)}` : ""}
      </span>
    );
  }
  return <span className="save-status" data-testid="save-status" />;
}
