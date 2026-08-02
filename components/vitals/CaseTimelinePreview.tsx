"use client";

import { useMemo } from "react";
import { BAND_ORDER, VITAL_COLOR_VAR } from "../../lib/timeline/config";
import { computeVitalScaleDomains } from "../../lib/timeline/dynamicYScale";
import { eventDefinition } from "../../lib/timeline/events";
import { formatClock } from "../../lib/timeline/format";
import { computeTimelineLayout } from "../../lib/timeline/geometry";
import { buildXScale, buildYScales, computeDomain, timeToX } from "../../lib/timeline/scales";
import { relativeTimelineTicks } from "../../lib/timeline/timeTicks";
import { useElementSize } from "../../hooks/useElementSize";
import type { PersistedCase, ScalarMeasurement } from "../../types/vitals";
import { TherapyDurationLayer, TherapyLaneBackgrounds, therapyVisual } from "./TherapyLayers";
import { TimeGrid } from "./TimeGrid";
import { VitalBandBackground } from "./VitalBandBackground";

export function CaseTimelinePreview({ caseData }: { caseData: PersistedCase }) {
  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const width = Math.max(320, Math.round(size.width) || 960);
  const layout = useMemo(() => computeTimelineLayout(width), [width]);
  const endTime = caseData.endedAt ?? caseData.lastSavedAt ?? caseData.startedAt ?? 0;
  const domain = useMemo(
    () => computeDomain(caseData.startedAt, endTime, undefined, caseData.endedAt),
    [caseData.startedAt, caseData.endedAt, endTime],
  );
  const xScale = useMemo(() => buildXScale(domain, layout), [domain, layout]);
  const scaleDomains = useMemo(
    () => computeVitalScaleDomains(caseData.measurements, domain.start, domain.end),
    [caseData.measurements, domain.start, domain.end],
  );
  const yScales = useMemo(() => buildYScales(layout, scaleDomains), [layout, scaleDomains]);
  const ticks = useMemo(
    () => relativeTimelineTicks(domain.start, domain.end, layout.plotWidth),
    [domain.start, domain.end, layout.plotWidth],
  );

  return (
    <div ref={containerRef} className="case-preview-timeline" data-testid="case-timeline-preview">
      <svg width={width} height={layout.height} viewBox={`0 0 ${width} ${layout.height}`} role="img" aria-label="Schreibgeschützte Vorschau der Falldokumentation">
        <TherapyLaneBackgrounds layout={layout} />
        {layout.bands.map((band) => (
          <VitalBandBackground
            key={band.kind}
            band={band}
            layout={layout}
            yScale={yScales[band.kind]}
            scaleDomain={scaleDomains[band.kind]}
          />
        ))}
        <TimeGrid layout={layout} xScale={xScale} majorTicks={ticks.major} minorTicks={ticks.minor} />
        <TherapyDurationLayer
          layout={layout}
          xScale={xScale}
          now={endTime}
          endedAt={caseData.endedAt}
          medications={caseData.medications}
          infusions={caseData.infusions}
        />
        {BAND_ORDER.filter((kind) => kind !== "nibp").map((kind) => {
          const values = caseData.measurements
            .filter((measurement): measurement is ScalarMeasurement => measurement.kind === kind)
            .sort((a, b) => a.time - b.time);
          const points = values.map((measurement) => `${timeToX(xScale, measurement.time)},${yScales[kind](measurement.value)}`).join(" ");
          return (
            <g key={kind} data-testid={`preview-series-${kind}`}>
              {points ? <polyline points={points} fill="none" stroke={VITAL_COLOR_VAR[kind]} strokeWidth={2.4} /> : null}
              {values.map((measurement) => <circle key={measurement.id} cx={timeToX(xScale, measurement.time)} cy={yScales[kind](measurement.value)} r={4.5} fill={VITAL_COLOR_VAR[kind]} stroke="#fff" strokeWidth={1.5} />)}
            </g>
          );
        })}
        <g data-testid="preview-series-nibp">
          {caseData.measurements.filter((measurement) => measurement.kind === "nibp").map((measurement) => {
            const x = timeToX(xScale, measurement.time);
            const meanY = yScales.nibp(measurement.mean);
            const sysY = yScales.nibp(measurement.systolic ?? measurement.mean);
            const diaY = yScales.nibp(measurement.diastolic ?? measurement.mean);
            return <g key={measurement.id}>
              <line x1={x} y1={sysY} x2={x} y2={diaY} stroke={VITAL_COLOR_VAR.nibp} strokeWidth={2} />
              {measurement.systolic !== null ? <circle cx={x} cy={sysY} r={4} fill="#fff" stroke={VITAL_COLOR_VAR.nibp} strokeWidth={2} /> : null}
              <circle cx={x} cy={meanY} r={5} fill={VITAL_COLOR_VAR.nibp} stroke="#fff" strokeWidth={1.5} />
              {measurement.diastolic !== null ? <circle cx={x} cy={diaY} r={4} fill="#fff" stroke={VITAL_COLOR_VAR.nibp} strokeWidth={2} /> : null}
            </g>;
          })}
        </g>
        {[...caseData.medications.map((entry, index) => ({ entry, index, kind: "medication" as const, lane: layout.therapyLanes[0] })), ...caseData.infusions.map((entry, index) => ({ entry, index, kind: "infusion" as const, lane: layout.therapyLanes[1] }))].map(({ entry, index, kind, lane }) => {
          const x = timeToX(xScale, entry.startedAt);
          const visual = therapyVisual(kind, index);
          return <g key={entry.id} data-testid={`preview-${kind}-${entry.id}`}>
            <line x1={x} y1={lane.top} x2={x} y2={layout.plotBottom} stroke={visual.color} strokeWidth={visual.strokeWidth} strokeDasharray={visual.dasharray ?? "4 3"} />
            <circle cx={x} cy={lane.top + 25 + (index % 3) * 25} r={5} fill={visual.color} />
            <text x={x + 7} y={lane.top + 23 + (index % 3) * 25} className="therapy-marker-label">{entry.name}</text>
            <text x={x + 7} y={lane.top + 36 + (index % 3) * 25} className="therapy-marker-time">{formatClock(entry.startedAt)}</text>
          </g>;
        })}
        {caseData.events.map((entry, index) => {
          const x = timeToX(xScale, entry.time);
          const definition = eventDefinition(entry.eventType);
          const y = layout.therapyLanes[2].top + 25 + (index % 3) * 25;
          return <g key={entry.id} data-testid={`preview-event-${entry.id}`}>
            <line x1={x} y1={layout.therapyLanes[2].top} x2={x} y2={layout.plotBottom} className="timeline-event-line" />
            <circle cx={x} cy={y} r={8} className="event-marker-circle" />
            <text x={x} y={y + 4} textAnchor="middle" className="event-marker-symbol">{definition.symbol}</text>
            <text x={x + 9} y={y} className="event-marker-label">{definition.label} · {formatClock(entry.time)}</text>
          </g>;
        })}
        {caseData.startedAt !== null ? <Boundary x={timeToX(xScale, caseData.startedAt)} top={layout.contentTop} bottom={layout.plotBottom} label={`Start ${formatClock(caseData.startedAt)}`} className="start" /> : null}
        {caseData.endedAt !== null ? <Boundary x={timeToX(xScale, caseData.endedAt)} top={layout.contentTop} bottom={layout.plotBottom} label={`Ende ${formatClock(caseData.endedAt)}`} className="end" /> : null}
      </svg>
    </div>
  );
}

function Boundary({ x, top, bottom, label, className }: { x: number; top: number; bottom: number; label: string; className: "start" | "end" }) {
  return <g pointerEvents="none" data-testid={`preview-${className}`}>
    <line x1={x} y1={top} x2={x} y2={bottom} className={`preview-boundary preview-boundary--${className}`} />
    <text x={x + (className === "start" ? 5 : -5)} y={bottom + 39} textAnchor={className === "start" ? "start" : "end"} className={`preview-boundary-label preview-boundary-label--${className}`}>{label}</text>
  </g>;
}
