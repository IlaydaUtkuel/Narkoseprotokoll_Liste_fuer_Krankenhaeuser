"use client";

import { useId } from "react";
import { VITAL_COLOR_VAR } from "../../lib/timeline/config";
import { buildStepPoints, spo2AreaPath, spo2LinePath } from "../../lib/timeline/spo2Path";
import { ScalarPointsLayer } from "./ScalarPointsLayer";
import type { BandContext } from "./timelineTypes";
import type { ScalarMeasurement } from "../../types/vitals";

interface Props {
  measurements: ScalarMeasurement[];
  ctx: BandContext;
}

// SpO2 als wasserartige Step-After-Flaeche: der letzte Wert wird nur bis "jetzt"
// gehalten (nicht in die Zukunft), keine kuenstlichen Schwankungen.
export function Spo2Band({ measurements, ctx }: Props) {
  const band = ctx.layout.bandByKind.spo2;
  const yScale = ctx.yScales.spo2;
  const gradientId = useId().replace(/:/g, "_");

  const effective = measurements.map((m) =>
    ctx.dragPreview?.id === m.id
      ? { time: ctx.dragPreview.time, value: ctx.dragPreview.value }
      : { time: m.time, value: m.value },
  );
  const points = buildStepPoints(effective, ctx.now);
  const areaD = points.length ? spo2AreaPath(points, ctx.xScale, yScale, band.innerBottom) : "";
  const lineD = points.length ? spo2LinePath(points, ctx.xScale, yScale) : "";

  return (
    <g>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--vital-spo2-soft)" />
          <stop offset="100%" stopColor="rgba(22, 119, 255, 0.02)" />
        </linearGradient>
      </defs>
      {areaD ? <path d={areaD} fill={`url(#${gradientId})`} data-testid="spo2-area" pointerEvents="none" /> : null}
      {lineD ? (
        <path
          d={lineD}
          fill="none"
          style={{ stroke: VITAL_COLOR_VAR.spo2 }}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          data-testid="series-spo2"
          pointerEvents="none"
        />
      ) : null}
      <ScalarPointsLayer kind="spo2" points={measurements} ctx={ctx} />
    </g>
  );
}
