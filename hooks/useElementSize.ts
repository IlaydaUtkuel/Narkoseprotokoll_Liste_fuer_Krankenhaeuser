"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

export interface ElementSize {
  width: number;
  height: number;
}

/**
 * Misst die Groesse eines Elements per ResizeObserver. Damit wird die SVG-Breite
 * nie fest verdrahtet, sondern folgt der Containerbreite (iPad-Ausrichtung, Desktop).
 */
export function useElementSize<T extends HTMLElement>(): [RefObject<T | null>, ElementSize] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const apply = (width: number, height: number) => {
      setSize((prev) =>
        Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5
          ? prev
          : { width, height },
      );
    };

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        apply(entry.contentRect.width, entry.contentRect.height);
      }
    });
    observer.observe(el);

    const rect = el.getBoundingClientRect();
    apply(rect.width, rect.height);

    return () => observer.disconnect();
  }, []);

  return [ref, size];
}
