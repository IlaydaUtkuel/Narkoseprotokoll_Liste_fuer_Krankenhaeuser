"use client";

import { line } from "d3-shape";
import { VITAL_COLOR_VAR } from "../../lib/timeline/config";
import { sortByTime } from "../../lib/timeline/measurementUtils";
import { timeToX } from "../../lib/timeline/scales";
import { ScalarPointsLayer } from "./ScalarPointsLayer";
import type { BandContext } from "./timelineTypes";
import type { ScalarMeasurement } from "../../types/vitals";

interface Props {
  kind: "heartRate" | "temperature";
  measurements: ScalarMeasurement[];
  ctx: BandContext;
  testId: string;
}

// Herzfrequenz / Temperatur: verbindet nur echte Messpunkte (kein Halten bis jetzt).
export function LineBand({ kind, measurements, ctx, testId }: Props) {
  const yScale = ctx.yScales[kind];
  const effective = sortByTime(
    measurements.map((m) =>
      ctx.dragPreview?.id === m.id
        ? { time: ctx.dragPreview.time, value: ctx.dragPreview.value }
        : { time: m.time, value: m.value },
    ),
  );

  const generator = line<{ time: number; value: number }>()
    .x((d) => timeToX(ctx.xScale, d.time))
    .y((d) => yScale(d.value));
  const d = effective.length >= 2 ? (generator(effective) ?? "") : "";

  return (
    <g>
      {d ? (
        <path
          d={d}
          fill="none"
          style={{ stroke: VITAL_COLOR_VAR[kind] }}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          data-testid={testId}
          pointerEvents="none"
        />
      ) : null}
      <ScalarPointsLayer kind={kind} points={measurements} ctx={ctx} />
    </g>
  );
}
