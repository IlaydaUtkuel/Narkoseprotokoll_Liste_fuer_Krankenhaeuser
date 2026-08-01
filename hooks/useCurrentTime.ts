"use client";

import { useEffect, useState } from "react";

/**
 * Liefert die aktuelle Zeit (ms). Startet als null, um Hydration-Unterschiede zu
 * vermeiden, setzt nach dem Mount die echte Zeit und aktualisiert im gegebenen
 * Intervall. Bei visibilitychange (Tab wieder aktiv) wird sofort neu berechnet,
 * damit die Zeit nach Hintergrund/Vordergrund korrekt ist.
 */
export function useCurrentTime(intervalMs: number, frozenAt: number | null = null): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (frozenAt !== null) return;
    const update = () => setNow(Date.now());
    update();
    const id = window.setInterval(update, intervalMs);
    const onVisibility = () => {
      if (document.visibilityState === "visible") update();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [frozenAt, intervalMs]);

  return frozenAt ?? now;
}
