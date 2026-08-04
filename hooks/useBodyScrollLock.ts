"use client";

import { useEffect } from "react";
import { lockBodyScroll, unlockBodyScroll } from "../lib/timeline/scrollLock";

/**
 * Sperrt den Seiten-Scroll waehrend einer aktiven Grafik-Interaktion (Stift/Finger)
 * und stellt die vorherige Scroll-Position beim Loslassen bzw. Abbrechen wieder her.
 * Fuer die Maus wird nie gesperrt, damit Mausrad-Scrollen am Desktop erhalten bleibt.
 *
 * Zusaetzlich zum CSS (`touch-action: none`) wird ein nicht-passiver
 * `touchmove`-Listener registriert, der waehrend der Interaktion `preventDefault()`
 * aufruft. Nur so verhindert Mobile Safari zuverlaessig Seiten-Scroll UND den
 * Rubber-Band-Effekt, wenn der Stift innerhalb der Grafik nach oben oder unten
 * gezogen wird. Der Listener wird beim Ende der Interaktion immer entfernt –
 * auch bei pointercancel/lostpointercapture oder einem Fehler.
 */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    lockBodyScroll();
    const blockTouchScroll = (event: TouchEvent) => {
      // Mehrfinger-Gesten (z. B. Zoom) bleiben erlaubt.
      if (event.touches.length > 1) return;
      if (event.cancelable) event.preventDefault();
    };
    window.addEventListener("touchmove", blockTouchScroll, { passive: false });
    return () => {
      window.removeEventListener("touchmove", blockTouchScroll);
      unlockBodyScroll();
    };
  }, [active]);
}
