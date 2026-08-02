import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LineBand } from "@/components/vitals/LineBand";
import { computeTimelineLayout } from "@/lib/timeline/geometry";
import { buildXScale, buildYScales } from "@/lib/timeline/scales";
import { computeVitalScaleDomains } from "@/lib/timeline/dynamicYScale";
import type { ScalarMeasurement } from "@/types/vitals";

describe("Temperatur-Rendering", () => {
  it("rendert alle sieben chronologischen Zwischenwerte mit stabiler ID", () => {
    const start = 1_000_000;
    const values = [35.2, 35.7, 36.1, 36.4, 36.8, 37.2, 38.6];
    const measurements: ScalarMeasurement[] = values.map((value, index) => ({
      id: `temperature-${index}`,
      kind: "temperature",
      time: start + index * 1_000,
      value,
      createdAt: start,
      updatedAt: start,
    }));
    const layout = computeTimelineLayout(1000);
    const xScale = buildXScale({ start, end: start + 10_000 }, layout);
    const domains = computeVitalScaleDomains(measurements, start, start + 10_000);
    const yScales = buildYScales(layout, domains);
    render(<svg><LineBand kind="temperature" measurements={measurements} testId="series-temperature" ctx={{
      layout, xScale, yScales, startedAt: start, now: start + 10_000, selectedId: null, dragPreview: null,
      onPointTap: () => {}, onScalarDragMove: () => {}, onScalarDragEnd: () => {}, onScalarDragCancel: () => {},
    }} /></svg>);
    for (let index = 0; index < values.length; index += 1) {
      expect(screen.getByTestId(`point-temperature-temperature-${index}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId("points-temperature").querySelectorAll("circle")).toHaveLength(7);
  });
});
