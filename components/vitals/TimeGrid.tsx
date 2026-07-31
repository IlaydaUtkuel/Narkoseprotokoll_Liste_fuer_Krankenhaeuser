"use client";

import { formatHm } from "../../lib/timeline/format";
import type { TimelineLayout } from "../../lib/timeline/geometry";
import { timeToX, type XScale } from "../../lib/timeline/scales";

interface Props {
  layout: TimelineLayout;
  xScale: XScale;
  ticks: number[];
}

const MIN_LABEL_GAP = 44;

// Ermittelt (ohne Seiteneffekte im Render) welche Ticks eine Beschriftung erhalten.
function pickLabeledTicks(ticks: number[], xScale: XScale, plotRight: number): Set<number> {
  const labeled = new Set<number>();
  let lastLabelX = Number.NEGATIVE_INFINITY;
  for (const t of ticks) {
    const x = timeToX(xScale, t);
    if (x - lastLabelX >= MIN_LABEL_GAP && x <= plotRight + 1) {
      labeled.add(t);
      lastLabelX = x;
    }
  }
  return labeled;
}

// Gemeinsame vertikale 5-Minuten-Rasterlinien durch alle Baender + untere Zeitachse.
// Bei zu geringem Abstand werden nur Etiketten ausgeduennt – das 5-Minuten-Raster bleibt.
export function TimeGrid({ layout, xScale, ticks }: Props) {
  const labeled = pickLabeledTicks(ticks, xScale, layout.plotRight);

  return (
    <g pointerEvents="none" data-testid="time-grid">
      {ticks.map((t) => {
        const x = timeToX(xScale, t);
        const showLabel = labeled.has(t);
        return (
          <g key={t}>
            <line
              x1={x}
              y1={layout.plotTop}
              x2={x}
              y2={layout.plotBottom}
              stroke="var(--timeline-grid)"
              strokeWidth={1}
            />
            {showLabel ? (
              <text
                x={x}
                y={layout.plotBottom + 34}
                textAnchor="middle"
                className="timeline-axis-label"
              >
                {formatHm(t)}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}
