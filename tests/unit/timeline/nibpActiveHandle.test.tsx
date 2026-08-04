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
    id: "nibp-active",
    kind: "nibp",
    time: START + 5 * 60_000,
    systolic: 120,
    mean: 90,
    diastolic: 60,
    createdAt: START,
    updatedAt: START,
  };
  const onUpdate = vi.fn();
  const ctx: BandContext = {
    layout,
    xScale,
    yScales,
    startedAt: START,
    now: END,
    selectedId: null,
    dragPreview: null,
    onPointTap: vi.fn(),
    onScalarDragMove: vi.fn(),
    onScalarDragEnd: vi.fn(),
    onScalarDragCancel: vi.fn(),
  };
  const result = render(
    <svg width="1000" height={layout.height}>
      <NibpHandleLayer measurements={[measurement]} ctx={ctx} onUpdate={onUpdate} onEdit={vi.fn()} />
    </svg>,
  );
  Object.defineProperty(result.container.querySelector("svg"), "getBoundingClientRect", {
    configurable: true,
    value: () => ({ left: 0, top: 0, width: 1000, height: layout.height, right: 1000, bottom: layout.height, x: 0, y: 0, toJSON: () => ({}) }),
  });
  return { onUpdate };
}

const hitOf = (part: "systolic" | "diastolic") =>
  screen.getByTestId(`nibp-handle-${part}`).querySelector("circle[role='button']") as SVGCircleElement;
const visualOf = (part: "systolic" | "diastolic") =>
  screen.getByTestId(`nibp-handle-${part}`).querySelectorAll("circle")[1] as SVGCircleElement;

describe("NIBP aktiver Griff (schwarz/weiss)", () => {
  it("markiert nur den beruehrten Griff als aktiv; der andere bleibt weiss", () => {
    setup();
    expect(visualOf("systolic").getAttribute("class")).not.toContain("nibp-handle--active");
    expect(visualOf("diastolic").getAttribute("class")).not.toContain("nibp-handle--active");

    const dia = hitOf("diastolic");
    fireEvent.pointerDown(dia, { pointerId: 1, pointerType: "pen", clientX: 400, clientY: 400 });
    expect(visualOf("diastolic").getAttribute("class")).toContain("nibp-handle--active");
    expect(visualOf("systolic").getAttribute("class")).not.toContain("nibp-handle--active");
    expect(screen.getByTestId("nibp-handle-diastolic")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("nibp-handle-systolic")).toHaveAttribute("data-active", "false");
  });

  it("wechselt die Aktivierung beim naechsten Griff", () => {
    setup();
    const dia = hitOf("diastolic");
    fireEvent.pointerDown(dia, { pointerId: 2, pointerType: "pen", clientX: 400, clientY: 400 });
    fireEvent.pointerUp(dia, { pointerId: 2, pointerType: "pen", clientX: 400, clientY: 400 });
    const sys = hitOf("systolic");
    fireEvent.pointerDown(sys, { pointerId: 3, pointerType: "pen", clientX: 400, clientY: 300 });
    expect(visualOf("systolic").getAttribute("class")).toContain("nibp-handle--active");
    expect(visualOf("diastolic").getAttribute("class")).not.toContain("nibp-handle--active");
  });

  it("setzt den Griff nach pointerup wieder auf weiss zurueck", () => {
    setup();
    const sys = hitOf("systolic");
    fireEvent.pointerDown(sys, { pointerId: 4, pointerType: "pen", clientX: 400, clientY: 300 });
    expect(visualOf("systolic").getAttribute("class")).toContain("nibp-handle--active");
    fireEvent.pointerUp(sys, { pointerId: 4, pointerType: "pen", clientX: 400, clientY: 300 });
    expect(visualOf("systolic").getAttribute("class")).not.toContain("nibp-handle--active");
  });

  it("setzt den Griff auch nach pointercancel und lostpointercapture zurueck", () => {
    setup();
    const sys = hitOf("systolic");
    fireEvent.pointerDown(sys, { pointerId: 5, pointerType: "pen", clientX: 400, clientY: 300 });
    fireEvent.pointerCancel(sys, { pointerId: 5, pointerType: "pen" });
    expect(visualOf("systolic").getAttribute("class")).not.toContain("nibp-handle--active");

    fireEvent.pointerDown(sys, { pointerId: 6, pointerType: "pen", clientX: 400, clientY: 300 });
    fireEvent.lostPointerCapture(sys, { pointerId: 6, pointerType: "pen" });
    expect(visualOf("systolic").getAttribute("class")).not.toContain("nibp-handle--active");
  });

  it("sperrt die anderen Griffe, solange ein Griff aktiv ist", () => {
    setup();
    const sys = hitOf("systolic");
    fireEvent.pointerDown(sys, { pointerId: 7, pointerType: "pen", clientX: 400, clientY: 300 });
    // Der nicht aktive Griff nimmt keine Pointer-Events mehr an.
    expect(hitOf("diastolic")).toHaveAttribute("pointer-events", "none");
    expect(screen.getByTestId("nibp-time-handle-nibp-active")).toHaveAttribute("pointer-events", "none");
    fireEvent.pointerUp(sys, { pointerId: 7, pointerType: "pen", clientX: 400, clientY: 300 });
    expect(hitOf("diastolic")).not.toHaveAttribute("pointer-events", "none");
  });

  it("behaelt den aktiven Griff waehrend des Drags (kein Wechsel)", () => {
    const { onUpdate } = setup();
    const sys = hitOf("systolic");
    const y = Number(sys.getAttribute("cy"));
    fireEvent.pointerDown(sys, { pointerId: 8, pointerType: "pen", clientX: 400, clientY: y });
    // Bewegung weit Richtung Diastolisch: der aktive Griff bleibt Systolisch.
    fireEvent.pointerMove(sys, { pointerId: 8, pointerType: "pen", clientX: 400, clientY: y + 120 });
    expect(visualOf("systolic").getAttribute("class")).toContain("nibp-handle--active");
    expect(visualOf("diastolic").getAttribute("class")).not.toContain("nibp-handle--active");
    fireEvent.pointerUp(sys, { pointerId: 8, pointerType: "pen", clientX: 400, clientY: y + 120 });
    // Nur Systolisch wurde geschrieben; Mittel und Diastolisch unveraendert.
    expect(onUpdate).toHaveBeenCalledTimes(1);
    const [, , , mean, diastolic] = onUpdate.mock.calls[0];
    expect(mean).toBe(90);
    expect(diastolic).toBe(60);
  });
});
