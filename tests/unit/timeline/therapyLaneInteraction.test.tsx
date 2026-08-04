import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TherapyLaneInteractionLayer } from "@/components/vitals/TherapyLaneInteractions";
import { computeTimelineLayout } from "@/lib/timeline/geometry";
import { buildXScale, xToTime } from "@/lib/timeline/scales";

const START = 1_000_000;
const END = START + 30 * 60_000;

function setup() {
  const layout = computeTimelineLayout(1000);
  const xScale = buildXScale({ start: START, end: END }, layout);
  const onCreateMedication = vi.fn();
  const onCreateInfusion = vi.fn();
  const onPreview = vi.fn();
  const result = render(
    <svg width="1000" height={layout.height}>
      <TherapyLaneInteractionLayer
        layout={layout}
        xScale={xScale}
        startedAt={START}
        endedAt={END}
        now={END}
        selectedEvent={null}
        preview={null}
        onPreview={onPreview}
        onCreateMedication={onCreateMedication}
        onCreateInfusion={onCreateInfusion}
        onPlaceEvent={vi.fn()}
        onInvalid={vi.fn()}
        onMissingEvent={vi.fn()}
        onTwoPhaseTap={vi.fn()}
      />
    </svg>,
  );
  Object.defineProperty(result.container.querySelector("svg"), "getBoundingClientRect", {
    configurable: true,
    value: () => ({ left: 0, top: 0, width: 1000, height: layout.height, right: 1000, bottom: layout.height, x: 0, y: 0, toJSON: () => ({}) }),
  });
  return { layout, xScale, onCreateMedication, onCreateInfusion, onPreview };
}

describe("Therapie-Lane Pointer und Fokus", () => {
  it.each(["medication", "infusion"])("verwendet in der %s-Lane keinen Inline-Ganzflächen-Outline", (kind) => {
    setup();
    const lane = screen.getByTestId(`lane-create-${kind}`);
    expect(lane).toHaveClass("therapy-lane-hit");
    expect(lane.getAttribute("style")).not.toContain("outline");
    expect(lane.nextElementSibling).toHaveClass("therapy-lane-keyboard-focus");
  });

  it("öffnet den Medikament-Dialog mit dem exakt angeklickten Timestamp", () => {
    const { layout, xScale, onCreateMedication } = setup();
    const lane = screen.getByTestId("lane-create-medication");
    const x = layout.plotLeft + layout.plotWidth * 0.4;
    const y = layout.therapyLanes[0].top + 10;
    fireEvent.pointerDown(lane, { pointerId: 1, pointerType: "mouse", button: 0, clientX: x, clientY: y });
    fireEvent.pointerUp(lane, { pointerId: 1, pointerType: "mouse", button: 0, clientX: x, clientY: y });
    expect(onCreateMedication).toHaveBeenCalledWith(Math.round(xToTime(xScale, x)));
  });

  it("behält für Tastaturfokus eine kleine separate Fokusmarke", () => {
    const { onPreview } = setup();
    const lane = screen.getByTestId("lane-create-infusion");
    fireEvent.focus(lane);
    expect(onPreview).toHaveBeenCalledWith(expect.objectContaining({ kind: "infusion", time: END }));
    expect(lane.nextElementSibling?.querySelector("circle")).toBeInTheDocument();
  });
});
