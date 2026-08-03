import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTimelinePreview } from "@/hooks/useTimelinePreview";
import type { PreviewSeed } from "@/lib/timeline/previewInteraction";
import { PREVIEW_TTL_MS } from "@/lib/timeline/config";

function seed(overrides: Partial<PreviewSeed> = {}): PreviewSeed {
  return {
    kind: "vital",
    pointerType: "pen",
    band: "spo2",
    lane: null,
    eventType: null,
    time: 1_000,
    value: 96,
    unit: "%",
    svgX: 100,
    svgY: 100,
    ...overrides,
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useTimelinePreview", () => {
  it("legt eine Vorschau ab und entfernt sie nach der TTL automatisch", () => {
    const { result } = renderHook(() => useTimelinePreview());
    act(() => {
      result.current.setPreview(seed());
    });
    expect(result.current.preview).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(PREVIEW_TTL_MS);
    });
    expect(result.current.preview).toBeNull();
  });

  it("ersetzt eine bestehende Vorschau sofort; der alte Timer loescht die neue nicht", () => {
    const { result } = renderHook(() => useTimelinePreview());
    act(() => {
      result.current.setPreview(seed({ svgX: 100 }));
    });
    // Kurz vor Ablauf der ersten Vorschau eine neue setzen.
    act(() => {
      vi.advanceTimersByTime(PREVIEW_TTL_MS - 100);
      result.current.setPreview(seed({ svgX: 500 }));
    });
    // Der alte Timer wuerde jetzt feuern – darf die neue Vorschau aber nicht loeschen.
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.preview?.svgX).toBe(500);
    // Erst die volle TTL der neuen Vorschau entfernt sie.
    act(() => {
      vi.advanceTimersByTime(PREVIEW_TTL_MS);
    });
    expect(result.current.preview).toBeNull();
  });

  it("loescht sofort bei clearPreview", () => {
    const { result } = renderHook(() => useTimelinePreview());
    act(() => {
      result.current.setPreview(seed());
      result.current.clearPreview();
    });
    expect(result.current.preview).toBeNull();
  });
});
