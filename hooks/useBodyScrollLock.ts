"use client";

import { useEffect } from "react";
import { lockBodyScroll, unlockBodyScroll } from "../lib/timeline/scrollLock";

/**
 * Sperrt den Seiten-Scroll waehrend einer aktiven Grafik-Interaktion (Stift/Finger)
 * und stellt die vorherige Scroll-Position beim Loslassen bzw. Abbrechen wieder her.
 * Fuer die Maus wird nie gesperrt, damit Mausrad-Scrollen am Desktop erhalten bleibt.
 */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [active]);
}
