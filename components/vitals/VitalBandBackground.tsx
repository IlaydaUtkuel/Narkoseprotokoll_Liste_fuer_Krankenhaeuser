"use client";

import { VITAL_CONFIG } from "../../lib/timeline/config";
import type { BandLayout, TimelineLayout } from "../../lib/timeline/geometry";
import type { YScale } from "../../lib/timeline/scales";
import { formatAxisTick, type VitalScaleDomain } from "../../lib/timeline/dynamicYScale";

interface Props {
  band: BandLayout;
  layout: TimelineLayout;
  yScale: YScale;
  lastValueText?: string | null;
  scaleDomain: VitalScaleDomain;
}

// Bandhintergrund: klare Trennung, Y-Achse mit Ticks + horizontalen Gridlines,
// Titel (Parametername + Einheit) und optional der zuletzt gespeicherte Wert.
export function VitalBandBackground({ band, layout, yScale, lastValueText, scaleDomain }: Props) {
  const c = VITAL_CONFIG[band.kind];
  const ticks = scaleDomain.ticks;

  return (
    <g pointerEvents="none">
      <rect
        x={layout.plotLeft}
        y={band.top}
        width={layout.plotWidth}
        height={band.height}
        rx={8}
        fill="#fafcfb"
        stroke="#e7efec"
        strokeWidth={1}
        data-testid={`band-${band.kind}`}
      />

      {ticks.map((v) => {
        const y = yScale(v);
        return (
          <g key={v}>
            <line
              x1={layout.plotLeft}
              y1={y}
              x2={layout.plotRight}
              y2={y}
              stroke="var(--timeline-grid)"
              strokeWidth={1}
            />
            <text
              x={layout.plotLeft - 8}
              y={y + 3.5}
              textAnchor="end"
              className="timeline-y-label"
            >
              {formatAxisTick(band.kind, v)}
            </text>
          </g>
        );
      })}

      <text x={8} y={band.top + 16} className="timeline-band-title">
        {band.kind === "nibp" ? (
          <>
            <tspan x={8} dy="0">Nichtinvasiver</tspan>
            <tspan x={8} dy="15">Blutdruck</tspan>
            <tspan x={8} dy="15" className="timeline-band-unit">{c.unit}</tspan>
          </>
        ) : (
          <>
            <tspan x={8}>{c.label}</tspan>
            <tspan x={8} dy="15" className="timeline-band-unit">{c.unit}</tspan>
          </>
        )}
      </text>

      {lastValueText ? (
        <text
          x={8}
          y={band.bottom - 12}
          textAnchor="start"
          className="timeline-last-value"
          data-testid={`last-value-${band.kind}`}
        >
          zuletzt: {lastValueText}
        </text>
      ) : null}
    </g>
  );
}
