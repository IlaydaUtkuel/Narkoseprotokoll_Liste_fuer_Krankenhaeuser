import { act, renderHook } from "@testing-library/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { usePointerGesture } from "@/hooks/useTimelinePointer";

function pointerEvent(overrides: Partial<ReactPointerEvent<Element>> = {}): ReactPointerEvent<Element> {
  return {
    pointerId: 7,
    pointerType: "touch",
    button: 0,
    clientX: 10,
    clientY: 10,
    currentTarget: {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    },
    ...overrides,
  } as unknown as ReactPointerEvent<Element>;
}

describe("usePointerGesture", () => {
  it("persistiert einen Drag nur bei pointerup und verwirft ihn bei pointercancel", () => {
    const onDragEnd = vi.fn();
    const onCancel = vi.fn();
    const { result } = renderHook(() => usePointerGesture({ capture: true, threshold: 7, onDragEnd, onCancel }));

    act(() => {
      result.current.onPointerDown(pointerEvent());
      result.current.onPointerMove(pointerEvent({ clientX: 30 }));
      result.current.onPointerCancel(pointerEvent({ clientX: 30 }));
    });
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onDragEnd).not.toHaveBeenCalled();

    act(() => {
      result.current.onPointerDown(pointerEvent());
      result.current.onPointerMove(pointerEvent({ clientX: 30 }));
      result.current.onPointerUp(pointerEvent({ clientX: 30 }));
    });
    expect(onDragEnd).toHaveBeenCalledOnce();
  });

  it("finalisiert einen laufenden Drag bei lostpointercapture (Safari-Geste)", () => {
    const onDragEnd = vi.fn();
    const onCancel = vi.fn();
    const { result } = renderHook(() => usePointerGesture({ capture: true, threshold: 7, onDragEnd, onCancel }));
    act(() => {
      result.current.onPointerDown(pointerEvent());
      result.current.onPointerMove(pointerEvent({ clientX: 30 }));
      result.current.onLostPointerCapture(pointerEvent({ clientX: 30 }));
    });
    expect(onDragEnd).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("verwirft einen noch nicht als Drag erkannten Kontakt bei lostpointercapture", () => {
    const onDragEnd = vi.fn();
    const onCancel = vi.fn();
    const { result } = renderHook(() => usePointerGesture({ capture: true, threshold: 7, onDragEnd, onCancel }));
    act(() => {
      result.current.onPointerDown(pointerEvent());
      result.current.onLostPointerCapture(pointerEvent());
    });
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onDragEnd).not.toHaveBeenCalled();
  });
});
