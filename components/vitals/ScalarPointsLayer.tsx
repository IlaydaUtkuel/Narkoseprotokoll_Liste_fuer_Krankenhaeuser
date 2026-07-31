"use client";

import { VITAL_COLOR_VAR, VITAL_CONFIG } from "../../lib/timeline/config";
import { formatClock, formatVitalNumber } from "../../lib/timeline/format";
import { timeToX } from "../../lib/timeline/scales";
import { MeasurementHit } from "./MeasurementHit";
import type { BandContext } from "./timelineTypes";
import type { ScalarKind, ScalarMeasurement } from "../../types/vitals";

interface Props {
  kind: ScalarKind;
  points: ScalarMeasurement[];
  ctx: BandContext;
}

// Messpunkte eines skalaren Bandes: Tap oeffnet Bearbeitung, Ziehen passt Zeit/Wert
// an (Live-Preview mit Tooltip). Waehrend des Ziehens wird nichts persistiert.
export function ScalarPointsLayer({ kind, points, ctx }: Props) {
  const yScale = ctx.yScales[kind];
  const color = VITAL_COLOR_VAR[kind];
  const config = VITAL_CONFIG[kind];

  return (
    <g data-testid={`points-${kind}`}>
      {points.map((m) => {
        const preview = ctx.dragPreview && ctx.dragPreview.id === m.id ? ctx.dragPreview : null;
        const time = preview ? preview.time : m.time;
        const value = preview ? preview.value : m.value;
        const cx = timeToX(ctx.xScale, time);
        const cy = yScale(value);
        const active = ctx.selectedId === m.id || preview !== null;
        const ariaLabel = `${config.label} ${formatVitalNumber(kind, value)} ${config.unit} um ${formatClock(time)} bearbeiten`;

        const flipTooltip = cx + 120 > ctx.layout.plotRight;
        const tipX = flipTooltip ? cx - 108 : cx + 10;

        return (
          <g key={m.id}>
            <MeasurementHit
              cx={cx}
              cy={cy}
              ariaLabel={ariaLabel}
              testId={`point-${kind}-${m.id}`}
              onTap={() => ctx.onPointTap(m)}
              onDragMove={(x, y) => ctx.onScalarDragMove(m, x, y)}
              onDragEnd={() => ctx.onScalarDragEnd(m)}
              onDragCancel={() => ctx.onScalarDragCancel()}
            >
              <circle
                cx={cx}
                cy={cy}
                r={active ? 7 : 5}
                fill={color}
                stroke="#ffffff"
                strokeWidth={active ? 2 : 1.5}
              />
            </MeasurementHit>

            {preview ? (
              <g pointerEvents="none" data-testid="drag-tooltip">
                <rect x={tipX} y={cy - 34} width={98} height={34} rx={6} fill="rgba(23,48,41,0.92)" />
                <text x={tipX + 8} y={cy - 20} fill="#ffffff" fontSize={11}>
                  {formatClock(time)}
                </text>
                <text x={tipX + 8} y={cy - 7} fill="#ffffff" fontSize={12} fontWeight={700}>
                  {formatVitalNumber(kind, value)} {config.unit}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}
