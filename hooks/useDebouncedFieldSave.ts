"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FieldSaveStatus } from "../types/patient";
import { AUTOSAVE_DELAY_MS } from "../lib/constants";

interface Options {
  /** Debounce-Dauer in ms (Standard: 2500). */
  delay?: number;
  /** Schreibt den aktuellen Stand. Darf werfen; ein Wurf fuehrt zum Fehlerstatus. */
  persist: () => void;
}

interface Result {
  statuses: Record<string, FieldSaveStatus>;
  /** Plant das Speichern eines Feldes: setzt sofort "saving" und startet den Timer neu. */
  scheduleSave: (field: string) => void;
  /** Markiert Felder direkt als gespeichert (z.B. nach dem Laden aus localStorage). */
  markSaved: (fields: string[]) => void;
  /** Setzt alle Status zurueck und stoppt laufende Timer (z.B. nach dem Loeschen). */
  resetStatuses: () => void;
}

/**
 * Verwaltet je Feld einen eigenen Debounce-Timer und den zugehoerigen
 * Speicherstatus. Eine Aenderung in einem Feld beeinflusst den Timer eines
 * anderen Feldes nicht.
 */
export function useDebouncedFieldSave({ delay = AUTOSAVE_DELAY_MS, persist }: Options): Result {
  const [statuses, setStatuses] = useState<Record<string, FieldSaveStatus>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // persist ueber ein Ref halten, damit scheduleSave stabil bleibt und beim
  // Ausloesen stets den aktuellsten Datenstand schreibt. Das Ref wird in einem
  // Effekt aktualisiert (nicht waehrend des Renderns).
  const persistRef = useRef(persist);
  useEffect(() => {
    persistRef.current = persist;
  }, [persist]);

  const scheduleSave = useCallback(
    (field: string) => {
      setStatuses((prev) => ({ ...prev, [field]: "saving" }));
      const existing = timers.current[field];
      if (existing) clearTimeout(existing);
      timers.current[field] = setTimeout(() => {
        delete timers.current[field];
        try {
          persistRef.current();
          setStatuses((prev) => ({ ...prev, [field]: "saved" }));
        } catch {
          setStatuses((prev) => ({ ...prev, [field]: "error" }));
        }
      }, delay);
    },
    [delay],
  );

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

  return { statuses, scheduleSave, markSaved, resetStatuses };
}
