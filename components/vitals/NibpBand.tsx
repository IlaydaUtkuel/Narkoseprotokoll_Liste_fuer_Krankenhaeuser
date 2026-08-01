"use client";

import { VITAL_COLOR_VAR } from "../../lib/timeline/config";
import { formatClock } from "../../lib/timeline/format";
import { timeToX } from "../../lib/timeline/scales";
import { MeasurementHit } from "./MeasurementHit";
import type { BandContext } from "./timelineTypes";
import type { NibpMeasurement } from "../../types/vitals";

interface Props {
  measurements: NibpMeasurement[];
  ctx: BandContext;
}

// NiBP: systolisch oben, diastolisch unten, duenne vertikale Linie dazwischen,
// gefuellter Punkt beim Mittelwert. Bearbeitung nur ueber das Formular (drei Werte).
export function NibpBand({ measurements, ctx }: Props) {
  const yScale = ctx.yScales.nibp;

  return (
    <g data-testid="points-nibp">
      {measurements.map((m) => {
        const cx = timeToX(ctx.xScale, m.time);
        const ySys = yScale(m.systolic);
        const yDia = yScale(m.diastolic);
        const yMean = yScale(m.mean);
        const selected = ctx.selectedId === m.id;
        const ariaLabel = `Nichtinvasiver Blutdruck ${m.systolic} zu ${m.diastolic}, Mittel ${m.mean} mmHg um ${formatClock(m.time)} bearbeiten`;

        return (
          <g key={m.id}>
            <line
              x1={cx}
              y1={ySys}
              x2={cx}
              y2={yDia}
              style={{ stroke: VITAL_COLOR_VAR.nibp }}
              strokeWidth={selected ? 3 : 2}
              data-testid="series-nibp"
              pointerEvents="none"
            />
            <line x1={cx - 6} y1={ySys} x2={cx + 6} y2={ySys} style={{ stroke: VITAL_COLOR_VAR.nibp }} strokeWidth={2} pointerEvents="none" />
            <line x1={cx - 6} y1={yDia} x2={cx + 6} y2={yDia} style={{ stroke: VITAL_COLOR_VAR.nibp }} strokeWidth={2} pointerEvents="none" />
            <MeasurementHit
              cx={cx}
              cy={(ySys + yDia) / 2}
              ariaLabel={ariaLabel}
              testId={`point-nibp-${m.id}`}
              onTap={() => ctx.onPointTap(m)}
            >
              <circle
                cx={cx}
                cy={yMean}
                r={selected ? 6 : 5}
                fill="var(--vital-nibp-dark)"
                stroke="#ffffff"
                strokeWidth={1.5}
              />
            </MeasurementHit>
          </g>
        );
      })}
    </g>
  );
}
