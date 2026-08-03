"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";

export interface GestureHandlers {
  /** Punkt-Hit-Areas: true (setPointerCapture, Drag). Plot: false (pan-y-Scroll erlaubt). */
  capture?: boolean;
  /** Bewegungsschwelle in px, um Tap von Drag/Scroll zu unterscheiden. */
  threshold?: number;
  onTap?: (e: ReactPointerEvent<Element>) => void;
  onDragStart?: (e: ReactPointerEvent<Element>) => void;
  onDragMove?: (e: ReactPointerEvent<Element>) => void;
  onDragEnd?: (e: ReactPointerEvent<Element>) => void;
  onCancel?: () => void;
}

interface GestureState {
  active: boolean;
  moved: boolean;
  dragging: boolean;
  startX: number;
  startY: number;
  pointerId: number;
}

/**
 * Ein gemeinsamer Pointer-Handler fuer Maus, Finger und Stift (pointerType wird
 * ausgewertet). Keine separaten Mouse-/Touch-Systeme. Kurze Bewegung = Tap; ueber
 * der Schwelle = Drag (bei capture) bzw. Scroll (ohne capture). pointercancel wird
 * behandelt, damit ein abgebrochener Vorgang keine falschen Daten schreibt.
 */
export function usePointerGesture(handlers: GestureHandlers) {
  const threshold = handlers.threshold ?? 9;
  const state = useRef<GestureState>({
    active: false,
    moved: false,
    dragging: false,
    startX: 0,
    startY: 0,
    pointerId: -1,
  });

  const reset = () => {
    state.current.active = false;
    state.current.moved = false;
    state.current.dragging = false;
    state.current.pointerId = -1;
  };

  const onPointerDown = (e: ReactPointerEvent<Element>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    state.current = {
      active: true,
      moved: false,
      dragging: false,
      startX: e.clientX,
      startY: e.clientY,
      pointerId: e.pointerId,
    };
    if (handlers.capture) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* not capturable */
      }
    }
  };

  const onPointerMove = (e: ReactPointerEvent<Element>) => {
    const s = state.current;
    if (!s.active || e.pointerId !== s.pointerId) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (!s.moved && Math.hypot(dx, dy) > threshold) {
      s.moved = true;
      if (handlers.capture) {
        s.dragging = true;
        handlers.onDragStart?.(e);
      }
    }
    if (s.dragging) handlers.onDragMove?.(e);
  };

  const onPointerUp = (e: ReactPointerEvent<Element>) => {
    const s = state.current;
    if (!s.active || e.pointerId !== s.pointerId) return;
    if (handlers.capture) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    if (s.dragging) handlers.onDragEnd?.(e);
    else if (!s.moved) handlers.onTap?.(e);
    reset();
  };

  const onPointerCancel = (e: ReactPointerEvent<Element>) => {
    const s = state.current;
    if (e.pointerId !== s.pointerId) return;
    if (handlers.capture) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    handlers.onCancel?.();
    reset();
  };

  // Safari kann die Pointer-Capture mitten im Drag verlieren (z. B. System-Geste).
  // Dann kommt kein pointerup mehr. Ein laufender Drag wird sicher abgeschlossen,
  // ein noch nicht als Drag erkannter Kontakt sicher verworfen – nie hängen bleiben.
  const onLostPointerCapture = (e: ReactPointerEvent<Element>) => {
    const s = state.current;
    if (!s.active || e.pointerId !== s.pointerId) return;
    if (s.dragging) handlers.onDragEnd?.(e);
    else handlers.onCancel?.();
    reset();
  };

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture };
}
