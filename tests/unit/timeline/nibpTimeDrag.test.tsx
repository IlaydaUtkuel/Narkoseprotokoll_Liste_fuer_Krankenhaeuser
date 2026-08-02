import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NibpHandleLayer } from "@/components/vitals/NibpBand";
import { computeTimelineLayout } from "@/lib/timeline/geometry";
import { buildXScale, buildYScales } from "@/lib/timeline/scales";
import type { BandContext } from "@/components/vitals/timelineTypes";
import type { NibpMeasurement } from "@/types/vitals";

const START = 1_000_000;
const END = START + 30 * 60_000;

function setup() {
  const layout = computeTimelineLayout(1000);
  const xScale = buildXScale({ start: START, end: END }, layout);
  const yScales = buildYScales(layout);
  const measurement: NibpMeasurement = {
    id: "nibp-drag",
    kind: "nibp",
    time: START + 5 * 60_000,
    systolic: 120,
    mean: 90,
    diastolic: 60,
    createdAt: START,
    updatedAt: START,
  };
  const onUpdate = vi.fn();
  const onPointTap = vi.fn();
  const ctx: BandContext = {
    layout,
    xScale,
    yScales,
    startedAt: START,
    now: END,
    selectedId: null,
    dragPreview: null,
    onPointTap,
    onScalarDragMove: vi.fn(),
    onScalarDragEnd: vi.fn(),
    onScalarDragCancel: vi.fn(),
  };
  const result = render(<svg width="1000" height={layout.height}><NibpHandleLayer measurements={[measurement]} ctx={ctx} onUpdate={onUpdate} onEdit={vi.fn()} /></svg>);
  Object.defineProperty(result.container.querySelector("svg"), "getBoundingClientRect", {
    configurable: true,
    value: () => ({ left: 0, top: 0, width: 1000, height: layout.height, right: 1000, bottom: layout.height, x: 0, y: 0, toJSON: () => ({}) }),
  });
  return { layout, measurement, onUpdate, onPointTap };
}

describe("NIBP richtungsgebundener Drag", () => {
  it("ändert bei horizontalem Mittel-Drag nur den gemeinsamen Timestamp", () => {
    const { measurement, onUpdate } = setup();
    const handle = screen.getByTestId("nibp-time-handle-nibp-drag");
    const startX = Number(handle.getAttribute("cx"));
    const startY = Number(handle.getAttribute("cy"));
    fireEvent.pointerDown(handle, { pointerId: 1, pointerType: "mouse", button: 0, clientX: startX, clientY: startY });
    fireEvent.pointerMove(handle, { pointerId: 1, pointerType: "mouse", clientX: startX + 100, clientY: startY + 2 });
    fireEvent.pointerUp(handle, { pointerId: 1, pointerType: "mouse", clientX: startX + 100, clientY: startY + 2 });
    expect(onUpdate).toHaveBeenCalledOnce();
    const [, time, systolic, mean, diastolic] = onUpdate.mock.calls[0];
    expect(time).not.toBe(measurement.time);
    expect({ systolic, mean, diastolic }).toEqual({ systolic: 120, mean: 90, diastolic: 60 });
  });

  it("ändert bei vertikalem Mittel-Drag nur Mittel", () => {
    const { measurement, onUpdate } = setup();
    const handle = screen.getByTestId("nibp-time-handle-nibp-drag");
    const x = Number(handle.getAttribute("cx"));
    const y = Number(handle.getAttribute("cy"));
    fireEvent.pointerDown(handle, { pointerId: 2, pointerType: "pen", clientX: x, clientY: y });
    fireEvent.pointerMove(handle, { pointerId: 2, pointerType: "pen", clientX: x + 1, clientY: y - 30 });
    fireEvent.pointerUp(handle, { pointerId: 2, pointerType: "pen", clientX: x + 1, clientY: y - 30 });
    expect(onUpdate).toHaveBeenCalledOnce();
    expect(onUpdate.mock.calls[0].slice(0, 3)).toEqual([measurement.id, measurement.time, 120]);
    expect(onUpdate.mock.calls[0][3]).not.toBe(90);
    expect(onUpdate.mock.calls[0][4]).toBe(60);
  });

  it("verwirft bei pointercancel jede Zeitvorschau", () => {
    const { onUpdate } = setup();
    const handle = screen.getByTestId("nibp-time-handle-nibp-drag");
    const x = Number(handle.getAttribute("cx"));
    const y = Number(handle.getAttribute("cy"));
    fireEvent.pointerDown(handle, { pointerId: 3, pointerType: "touch", clientX: x, clientY: y });
    fireEvent.pointerMove(handle, { pointerId: 3, pointerType: "touch", clientX: x + 100, clientY: y });
    fireEvent.pointerCancel(handle, { pointerId: 3, pointerType: "touch" });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("begrenzt den Timestamp auf das dokumentierbare Ende", () => {
    const { measurement, onUpdate } = setup();
    const handle = screen.getByTestId("nibp-time-handle-nibp-drag");
    const x = Number(handle.getAttribute("cx"));
    const y = Number(handle.getAttribute("cy"));
    fireEvent.pointerDown(handle, { pointerId: 4, pointerType: "mouse", button: 0, clientX: x, clientY: y });
    fireEvent.pointerMove(handle, { pointerId: 4, pointerType: "mouse", clientX: 5000, clientY: y });
    fireEvent.pointerUp(handle, { pointerId: 4, pointerType: "mouse", clientX: 5000, clientY: y });
    expect(onUpdate).toHaveBeenCalledWith(measurement.id, END, 120, 90, 60);
  });

  it("behält einen kurzen Klick als NIBP-Bearbeitungsaktion", () => {
    const { onPointTap } = setup();
    const handle = screen.getByTestId("nibp-time-handle-nibp-drag");
    fireEvent.pointerDown(handle, { pointerId: 5, pointerType: "mouse", button: 0, clientX: 400, clientY: 400 });
    fireEvent.pointerUp(handle, { pointerId: 5, pointerType: "mouse", clientX: 400, clientY: 400 });
    expect(onPointTap).toHaveBeenCalledOnce();
  });

  it.each([
    ["systolic", 120, 60],
    ["diastolic", 120, 60],
  ] as const)("ändert beim vertikalen %s-Drag nur den gewählten Endpunkt", (part, originalSystolic, originalDiastolic) => {
    const { measurement, onUpdate } = setup();
    const group = screen.getByTestId(`nibp-handle-${part}`);
    const handle = group.querySelector("circle[role='button']") as SVGCircleElement;
    const x = Number(handle.getAttribute("cx"));
    const y = Number(handle.getAttribute("cy"));
    const targetY = part === "systolic" ? y - 25 : y + 25;
    fireEvent.pointerDown(handle, { pointerId: 6, pointerType: "pen", clientX: x, clientY: y });
    fireEvent.pointerMove(handle, { pointerId: 6, pointerType: "pen", clientX: x, clientY: targetY });
    fireEvent.pointerUp(handle, { pointerId: 6, pointerType: "pen", clientX: x, clientY: targetY });
    expect(onUpdate).toHaveBeenCalledOnce();
    const [, time, systolic, mean, diastolic] = onUpdate.mock.calls[0];
    expect(time).toBe(measurement.time);
    expect(mean).toBe(90);
    if (part === "systolic") {
      expect(systolic).not.toBe(originalSystolic);
      expect(diastolic).toBe(originalDiastolic);
    } else {
      expect(systolic).toBe(originalSystolic);
      expect(diastolic).not.toBe(originalDiastolic);
    }
  });
});
