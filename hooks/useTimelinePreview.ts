"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createPreview,
  type PreviewSeed,
  type TimelinePreview,
} from "../lib/timeline/previewInteraction";
import { PREVIEW_TTL_MS } from "../lib/timeline/config";

/**
 * Verwaltet genau eine aktive, fluechtige Vorschau der Zeitgrafik. Es kann immer
 * nur eine Vorschau existieren; eine neue Vorschau ersetzt die alte sofort. Nach
 * PREVIEW_TTL_MS verschwindet sie automatisch. Der Timeout ist per Token
 * abgesichert: ein alter Timer kann eine bereits ersetzte, neue Vorschau nicht
 * mehr loeschen. Persistenz oder Fallexport werden nie beruehrt.
 */
export interface TimelinePreviewControls {
  preview: TimelinePreview | null;
  setPreview: (seed: PreviewSeed) => TimelinePreview;
  clearPreview: () => void;
}

export function useTimelinePreview(): TimelinePreviewControls {
  const [preview, setPreviewState] = useState<TimelinePreview | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef(0);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const clearPreview = useCallback(() => {
    clearTimer();
    setPreviewState(null);
  }, []);

  const setPreview = useCallback((seed: PreviewSeed): TimelinePreview => {
    clearTimer();
    tokenRef.current += 1;
    const token = tokenRef.current;
    const next = createPreview(seed, token, Date.now());
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      // Nur loeschen, wenn diese Vorschau noch die aktuelle ist.
      setPreviewState((current) => (current && current.token === token ? null : current));
    }, PREVIEW_TTL_MS);
    setPreviewState(next);
    return next;
  }, []);

  useEffect(() => () => clearTimer(), []);

  return { preview, setPreview, clearPreview };
}
