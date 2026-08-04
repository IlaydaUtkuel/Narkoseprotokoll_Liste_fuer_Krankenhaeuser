import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TherapyLaneInteractionLayer } from "@/components/vitals/TherapyLaneInteractions";
import { computeTimelineLayout } from "@/lib/timeline/geometry";
import { buildXScale } from "@/lib/timeline/scales";

const START = 1_000_000;
const END = START + 30 * 60_000;

function setup(selectedEvent: "incision" | null = null) {
  const layout = computeTimelineLayout(1000);
  const xScale = buildXScale({ start: START, end: END }, layout);
  const handlers = {
    onCreateMedication: vi.fn(),
    onCreateInfusion: vi.fn(),
    onPlaceEvent: vi.fn(),
    onTwoPhaseTap: vi.fn(),
    onMissingEvent: vi.fn(),
    onInvalid: vi.fn(),
    onPreview: vi.fn(),
    onInteractionActive: vi.fn(),
  };
  const result = render(
    <svg width="1000" height={layout.height}>
      <TherapyLaneInteractionLayer
        layout={layout}
        xScale={xScale}
        startedAt={START}
        endedAt={END}
        now={END}
        selectedEvent={selectedEvent}
        preview={null}
        {...handlers}
      />
    </svg>,
  );
  Object.defineProperty(result.container.querySelector("svg"), "getBoundingClientRect", {
    configurable: true,
    value: () => ({ left: 0, top: 0, width: 1000, height: layout.height, right: 1000, bottom: layout.height, x: 0, y: 0, toJSON: () => ({}) }),
  });
  return { layout, ...handlers };
}

describe("Therapie-Lane iPad-Zwei-Schritt", () => {
  it("meldet einen Stift-Tap als Zwei-Schritt-Vorschau statt sofort anzulegen", () => {
    const { layout, onTwoPhaseTap, onCreateMedication, onInteractionActive } = setup();
    const lane = screen.getByTestId("lane-create-medication");
    const x = layout.plotLeft + layout.plotWidth * 0.4;
    const y = layout.therapyLanes[0].top + 10;
    fireEvent.pointerDown(lane, { pointerId: 1, pointerType: "pen", clientX: x, clientY: y });
    fireEvent.pointerUp(lane, { pointerId: 1, pointerType: "pen", clientX: x, clientY: y });
    expect(onCreateMedication).not.toHaveBeenCalled();
    expect(onTwoPhaseTap).toHaveBeenCalledTimes(1);
    expect(onTwoPhaseTap.mock.calls[0][0]).toMatchObject({ kind: "medication", pointerType: "pen" });
    expect(onInteractionActive).toHaveBeenCalledWith(true);
    expect(onInteractionActive).toHaveBeenLastCalledWith(false);
  });

  it("legt bei der Maus weiterhin sofort an (Desktop unveraendert)", () => {
    const { layout, onTwoPhaseTap, onCreateInfusion } = setup();
    const lane = screen.getByTestId("lane-create-infusion");
    const x = layout.plotLeft + layout.plotWidth * 0.5;
    const y = layout.therapyLanes[1].top + 10;
    fireEvent.pointerDown(lane, { pointerId: 2, pointerType: "mouse", button: 0, clientX: x, clientY: y });
    fireEvent.pointerUp(lane, { pointerId: 2, pointerType: "mouse", button: 0, clientX: x, clientY: y });
    expect(onCreateInfusion).toHaveBeenCalledTimes(1);
    expect(onTwoPhaseTap).not.toHaveBeenCalled();
  });

  it("meldet ohne ausgewaehltes Ereignis keine Ereignis-Vorschau", () => {
    const { layout, onTwoPhaseTap, onMissingEvent } = setup(null);
    const lane = screen.getByTestId("lane-create-event");
    const x = layout.plotLeft + layout.plotWidth * 0.3;
    const y = layout.therapyLanes[2].top + 10;
    fireEvent.pointerDown(lane, { pointerId: 3, pointerType: "touch", clientX: x, clientY: y });
    fireEvent.pointerUp(lane, { pointerId: 3, pointerType: "touch", clientX: x, clientY: y });
    expect(onMissingEvent).toHaveBeenCalledTimes(1);
    expect(onTwoPhaseTap).not.toHaveBeenCalled();
  });

  it("meldet mit ausgewaehltem Ereignis den Ereignistyp in der Vorschau", () => {
    const { layout, onTwoPhaseTap } = setup("incision");
    const lane = screen.getByTestId("lane-create-event");
    const x = layout.plotLeft + layout.plotWidth * 0.3;
    const y = layout.therapyLanes[2].top + 10;
    fireEvent.pointerDown(lane, { pointerId: 4, pointerType: "touch", clientX: x, clientY: y });
    fireEvent.pointerUp(lane, { pointerId: 4, pointerType: "touch", clientX: x, clientY: y });
    expect(onTwoPhaseTap).toHaveBeenCalledTimes(1);
    expect(onTwoPhaseTap.mock.calls[0][0]).toMatchObject({ kind: "event", eventType: "incision" });
  });

  it("erzeugt bei pointercancel keine Platzierung", () => {
    const { layout, onTwoPhaseTap, onInteractionActive } = setup();
    const lane = screen.getByTestId("lane-create-medication");
    const x = layout.plotLeft + layout.plotWidth * 0.4;
    const y = layout.therapyLanes[0].top + 10;
    fireEvent.pointerDown(lane, { pointerId: 5, pointerType: "touch", clientX: x, clientY: y });
    fireEvent.pointerCancel(lane, { pointerId: 5, pointerType: "touch", clientX: x, clientY: y });
    expect(onTwoPhaseTap).not.toHaveBeenCalled();
    expect(onInteractionActive).toHaveBeenLastCalledWith(false);
  });
});
