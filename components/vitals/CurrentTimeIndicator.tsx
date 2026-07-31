"use client";

import { formatClock } from "../../lib/timeline/format";
import type { TimelineLayout } from "../../lib/timeline/geometry";
import { timeToX, type XScale } from "../../lib/timeline/scales";

interface Props {
  layout: TimelineLayout;
  xScale: XScale;
  startedAt: number;
  now: number;
}

// Vierteiliger Jetzt-Indikator: (A) fosforlu gruene Spur Start->jetzt,
// (B) koyu gruene Jetzt-Nokta, (C) eine einzige acik gruene vertikale Linie durch
// alle vier Baender, (D) Jetzt-Etikett.
export function CurrentTimeIndicator({ layout, xScale, startedAt, now }: Props) {
  const xStart = timeToX(xScale, startedAt);
  const xNow = timeToX(xScale, now);
  const traceY = layout.plotBottom + 16;
  const nearRight = xNow > layout.plotRight - 96;

  return (
    <g pointerEvents="none" data-testid="now-indicator">
      {/* C: eine gemeinsame vertikale Linie durch alle Baender */}
      <line
        x1={xNow}
        y1={layout.plotTop}
        x2={xNow}
        y2={traceY}
        stroke="var(--timeline-now-line)"
        strokeWidth={2}
        data-testid="now-line"
      />
      {/* A: gluehende Spur – breite, weiche Basis + duennere kraeftige Linie */}
      <line
        x1={xStart}
        y1={traceY}
        x2={xNow}
        y2={traceY}
        stroke="var(--timeline-now-soft)"
        strokeWidth={11}
        strokeLinecap="round"
      />
      <line
        x1={xStart}
        y1={traceY}
        x2={xNow}
        y2={traceY}
        stroke="var(--timeline-now)"
        strokeWidth={4}
        strokeLinecap="round"
        data-testid="now-trace"
      />
      {/* B: koyu gruener Jetzt-Punkt */}
      <circle cx={xNow} cy={traceY} r={6} fill="var(--timeline-now-dark)" data-testid="now-dot" />
      {/* D: Jetzt-Etikett (bleibt im Diagramm) */}
      <text
        x={nearRight ? xNow - 8 : xNow + 8}
        y={layout.plotTop + 11}
        textAnchor={nearRight ? "end" : "start"}
        className="timeline-now-label"
        data-testid="now-label"
      >
        Jetzt · {formatClock(now)}
      </text>
    </g>
  );
}
