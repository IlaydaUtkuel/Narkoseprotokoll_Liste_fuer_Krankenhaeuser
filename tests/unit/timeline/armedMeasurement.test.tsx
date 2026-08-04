import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScalarPointsLayer } from "@/components/vitals/ScalarPointsLayer";
import { computeTimelineLayout } from "@/lib/timeline/geometry";
import { buildXScale, buildYScales } from "@/lib/timeline/scales";
import type { BandContext } from "@/components/vitals/timelineTypes";
import type { ScalarMeasurement } from "@/types/vitals";

const START = 1_000_000;
const END = START + 30 * 60_000;

const point: ScalarMeasurement = {
  id: "p1", kind: "spo2", time: START + 5 * 60_000, value: 96, createdAt: START, updatedAt: START,
};

function renderLayer(armedId: string | null) {
  const layout = computeTimelineLayout(1000);
  const ctx: BandContext = {
    layout,
    xScale: buildXScale({ start: START, end: END }, layout),
    yScales: buildYScales(layout),
    startedAt: START,
    now: END,
    selectedId: null,
    dragPreview: null,
    pointerTime: null,
    armedId,
    onPointTap: vi.fn(),
    onScalarDragMove: vi.fn(),
    onScalarDragEnd: vi.fn(),
    onScalarDragCancel: vi.fn(),
  };
  return render(<svg><ScalarPointsLayer kind="spo2" points={[point]} ctx={ctx} /></svg>);
}

describe("Ausgewaehlter Messpunkt (schwarzer Ring)", () => {
  it("zeigt ohne Auswahl keinen schwarzen Ring", () => {
    renderLayer(null);
    expect(screen.queryByTestId("point-armed-p1")).toBeNull();
  });

  it("zeigt den schwarzen Ring nur fuer den ausgewaehlten Punkt", () => {
    renderLayer("p1");
    const ring = screen.getByTestId("point-armed-p1");
    expect(ring).toBeInTheDocument();
    expect(ring.getAttribute("class")).toContain("measurement-armed-ring");
  });

  it("zeigt keinen Ring, wenn ein anderer Punkt ausgewaehlt ist", () => {
    renderLayer("anderer-punkt");
    expect(screen.queryByTestId("point-armed-p1")).toBeNull();
  });
});
