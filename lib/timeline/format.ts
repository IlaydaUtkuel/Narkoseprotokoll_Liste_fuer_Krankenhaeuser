import { VITAL_CONFIG } from "./config";
import type { VitalKind } from "../../types/vitals";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// HH:mm:ss (Start-Button, Zeitpunkt im Formular, Jetzt-Etikett).
export function formatClock(ts: number): string {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

// HH:mm (X-Achse, "Gestartet um", "Gespeichert um").
export function formatHm(ts: number): string {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// Zahl gemaess Parameter-Precision im deutschen Locale (Temperatur mit Komma).
export function formatVitalNumber(kind: VitalKind, value: number): string {
  const configured = VITAL_CONFIG[kind].precision;
  const precision = Number.isInteger(value) ? configured : Math.max(configured, 2);
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: configured,
    maximumFractionDigits: precision,
  });
}
