/**
 * Temporaerer Body-Scroll-Lock fuer aktive Pointer-Interaktionen auf der Grafik.
 * Bewusst ohne position: fixed – das wuerde das Layout verschieben und die
 * Pointer-Koordinaten-Umrechnung waehrend eines Drags verfaelschen. Stattdessen
 * overflow: hidden (kein Layout-Shift) plus Speichern/Wiederherstellen der
 * Scroll-Position. Reference-Counting erlaubt verschachtelte Aufrufe.
 */

let lockCount = 0;
let savedScrollY = 0;
let savedOverflow = "";
let savedOverscroll = "";

// Zusätzlich zum CSS (`touch-action: none`) verhindert ein nicht-passiver
// touchmove-Listener zuverlässig Seiten-Scroll UND Rubber-Band in Mobile Safari,
// solange eine Stift-/Finger-Interaktion läuft.
function blockTouchScroll(event: TouchEvent): void {
  if (event.touches.length > 1) return; // Mehrfinger-Gesten (Zoom) bleiben erlaubt.
  if (event.cancelable) event.preventDefault();
}

export function isBodyScrollLocked(): boolean {
  return lockCount > 0;
}

export function lockBodyScroll(): void {
  if (typeof document === "undefined") return;
  lockCount += 1;
  if (lockCount > 1) return;
  savedScrollY = typeof window !== "undefined" ? window.scrollY : 0;
  const body = document.body;
  savedOverflow = body.style.overflow;
  savedOverscroll = body.style.overscrollBehavior;
  body.style.overflow = "hidden";
  body.style.overscrollBehavior = "contain";
  body.dataset.timelineScrollLock = "true";
  if (typeof window !== "undefined") {
    window.addEventListener("touchmove", blockTouchScroll, { passive: false });
  }
}

export function unlockBodyScroll(): void {
  if (typeof document === "undefined") return;
  if (lockCount === 0) return;
  lockCount -= 1;
  if (lockCount > 0) return;
  const body = document.body;
  body.style.overflow = savedOverflow;
  body.style.overscrollBehavior = savedOverscroll;
  delete body.dataset.timelineScrollLock;
  if (typeof window !== "undefined") {
    window.removeEventListener("touchmove", blockTouchScroll);
    window.scrollTo(0, savedScrollY);
  }
}

// Nur fuer Tests: setzt das Modul in den Ausgangszustand zurueck.
export function resetBodyScrollLockForTests(): void {
  lockCount = 0;
  savedScrollY = 0;
  savedOverflow = "";
  savedOverscroll = "";
  if (typeof document !== "undefined") delete document.body.dataset.timelineScrollLock;
}
