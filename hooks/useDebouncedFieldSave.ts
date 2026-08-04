"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FieldSaveStatus } from "../types/patient";
import { AUTOSAVE_DELAY_MS } from "../lib/constants";

interface Options {
  /** Verzoegerung fuer die sichtbare "Gespeichert"-Anzeige in ms (Standard: 2500). */
  delay?: number;
}

interface Result {
  statuses: Record<string, FieldSaveStatus>;
  /**
   * Meldet, dass ein Feld gerade gespeichert wurde: zeigt sofort "saving" und nach
   * `delay` ohne weitere Aenderung "saved". Das eigentliche Schreiben passiert
   * bereits im Formular; dieser Hook steuert nur die beruhigende Anzeige.
   */
  reportSaving: (field: string) => void;
  /**
   * Meldet, dass ein Feld sofort und endgueltig gespeichert wurde: zeigt ohne
   * Verzoegerung "Gespeichert" (z.B. Umschalter, die keine Tipppause brauchen).
   */
  reportSaved: (field: string) => void;
  /** Meldet einen echten Schreibfehler fuer ein Feld. */
  reportError: (field: string) => void;
  /** Markiert Felder direkt als gespeichert (z.B. nach dem Laden aus localStorage). */
  markSaved: (fields: string[]) => void;
  /** Setzt alle Status zurueck und stoppt laufende Timer (z.B. nach dem Loeschen). */
  resetStatuses: () => void;
}

/**
 * Verwaltet je Feld einen eigenen Anzeige-Timer und den zugehoerigen Speicherstatus.
 * Eine Aenderung in einem Feld beeinflusst den Timer eines anderen Feldes nicht.
 */
export function useDebouncedFieldSave({ delay = AUTOSAVE_DELAY_MS }: Options = {}): Result {
  const [statuses, setStatuses] = useState<Record<string, FieldSaveStatus>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const reportSaving = useCallback(
    (field: string) => {
      setStatuses((prev) => ({ ...prev, [field]: "saving" }));
      const existing = timers.current[field];
      if (existing) clearTimeout(existing);
      timers.current[field] = setTimeout(() => {
        delete timers.current[field];
        setStatuses((prev) => ({ ...prev, [field]: "saved" }));
      }, delay);
    },
    [delay],
  );

  const reportSaved = useCallback((field: string) => {
    const existing = timers.current[field];
    if (existing) {
      clearTimeout(existing);
      delete timers.current[field];
    }
    setStatuses((prev) => ({ ...prev, [field]: "saved" }));
  }, []);

  const reportError = useCallback((field: string) => {
    const existing = timers.current[field];
    if (existing) {
      clearTimeout(existing);
      delete timers.current[field];
    }
    setStatuses((prev) => ({ ...prev, [field]: "error" }));
  }, []);

  const markSaved = useCallback((fields: string[]) => {
    setStatuses((prev) => {
      const next = { ...prev };
      for (const f of fields) next[f] = "saved";
      return next;
    });
  }, []);

  const resetStatuses = useCallback(() => {
    for (const key of Object.keys(timers.current)) {
      clearTimeout(timers.current[key]);
      delete timers.current[key];
    }
    setStatuses({});
  }, []);

  // Timer beim Unmount aufraeumen.
  useEffect(() => {
    const running = timers.current;
    return () => {
      for (const key of Object.keys(running)) clearTimeout(running[key]);
    };
  }, []);

  return { statuses, reportSaving, reportSaved, reportError, markSaved, resetStatuses };
}
