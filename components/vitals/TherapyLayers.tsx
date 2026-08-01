"use client";

import { useId, useRef, useState } from "react";
import { eventDefinition } from "../../lib/timeline/events";
import { formatClock } from "../../lib/timeline/format";
import { clampValue } from "../../lib/timeline/measurementUtils";
import { timeToX, xToTime, type XScale } from "../../lib/timeline/scales";
import { displayEndTime } from "../../lib/timeline/therapyUtils";
import { usePointerGesture } from "../../hooks/useTimelinePointer";
import type { TimelineLayout } from "../../lib/timeline/geometry";
import type { InfusionEntry, MedicationEntry, TimelineEvent } from "../../types/vitals";

const MEDICATION_COLORS = ["#722ed1", "#9254de", "#531dab", "#b37feb"];
const INFUSION_COLORS = ["#087f8c", "#0891b2", "#0e7490", "#155e75"];

export function therapyVisual(kind: "medication" | "infusion", index: number) {
  const variant = index % 4;
  return {
    color: (kind === "medication" ? MEDICATION_COLORS : INFUSION_COLORS)[variant],
    spacing: 12 + variant * 3,
    angle: kind === "medication" ? 45 : -45,
    strokeWidth: variant % 2 === 0 ? 1.15 : 1.5,
    dasharray: variant === 2 ? "3 2" : variant === 3 ? "1 2" : undefined,
  };
}

interface SharedProps {
  layout: TimelineLayout;
  xScale: XScale;
  now: number;
  endedAt: number | null;
}

export interface ActiveTherapyInterval {
  kind: "medication" | "infusion";
  entry: MedicationEntry | InfusionEntry;
  index: number;
  end: number;
}

export function therapyIntervalsAtTime(
  time: number,
  medications: MedicationEntry[],
  infusions: InfusionEntry[],
  now: number,
  endedAt: number | null,
): ActiveTherapyInterval[] {
  const entries = [
    ...medications.map((entry, index) => ({ kind: "medication" as const, entry, index })),
    ...infusions.map((entry, index) => ({ kind: "infusion" as const, entry, index })),
  ];
  return entries.flatMap((item) => {
    const end = displayEndTime(item.entry, now, endedAt);
    return end !== null && time >= item.entry.startTime && time <= end ? [{ ...item, end }] : [];
  });
}

export function TherapyIntervalTooltip({
  items,
  x,
  y,
  layout,
}: {
  items: ActiveTherapyInterval[];
  x: number;
  y: number;
  layout: TimelineLayout;
}) {
  if (items.length === 0) return null;
  const width = 260;
  const height = 12 + items.length * 31;
  const tooltipX = x > layout.plotRight - width - 10 ? x - width - 10 : x + 10;
  const tooltipY = clampValue(y - height - 8, layout.plotTop + 3, layout.plotBottom - height - 3);
  return (
    <g pointerEvents="none" data-testid="therapy-interval-tooltip">
      <rect x={tooltipX} y={tooltipY} width={width} height={height} rx={7} className="therapy-interval-tooltip" />
      {items.map((item, index) => {
        const visual = therapyVisual(item.kind, item.index);
        const label = item.kind === "medication" ? "Medikament" : "Infusion / Flüssigkeit";
        const rowY = tooltipY + 18 + index * 31;
        return (
          <g key={`${item.kind}-${item.entry.id}`}>
            <line x1={tooltipX + 9} y1={rowY - 4} x2={tooltipX + 25} y2={rowY - 4} stroke={visual.color} strokeWidth={visual.strokeWidth + 1} strokeDasharray={visual.dasharray} />
            <text x={tooltipX + 31} y={rowY} className="therapy-interval-tooltip__name">{item.entry.name} · {label}</text>
            <text x={tooltipX + 31} y={rowY + 13} className="therapy-interval-tooltip__time">
              {formatClock(item.entry.startTime)}–{formatClock(item.end)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export function TherapyLaneBackgrounds({ layout }: { layout: TimelineLayout }) {
  const labels = {
    medications: "Medikamente",
    infusions: "Infusionen und Flüssigkeiten",
    events: "Phasen und Ereignisse",
  };
  return (
    <g pointerEvents="none" data-testid="therapy-lanes">
      {layout.therapyLanes.map((lane) => (
        <g key={lane.kind}>
          <rect
            x={layout.plotLeft}
            y={lane.top}
            width={layout.plotWidth}
            height={lane.height}
            rx={8}
            className={`therapy-lane therapy-lane--${lane.kind}`}
            data-testid={`lane-${lane.kind}`}
          />
          <text x={8} y={lane.top + 22} className="timeline-band-title">
            {lane.kind === "infusions" ? (
              <>
                <tspan x={8}>Infusionen und</tspan>
                <tspan x={8} dy="15">Flüssigkeiten</tspan>
              </>
            ) : labels[lane.kind]}
          </text>
        </g>
      ))}
    </g>
  );
}

export function TherapyDurationLayer({
  layout,
  xScale,
  now,
  endedAt,
  medications,
  infusions,
}: SharedProps & { medications: MedicationEntry[]; infusions: InfusionEntry[] }) {
  const baseId = useId().replace(/:/g, "_");
  const entries = [
    ...medications.map((entry, index) => ({ entry, index, kind: "medication" as const })),
    ...infusions.map((entry, index) => ({ entry, index, kind: "infusion" as const })),
  ];
  return (
    <g pointerEvents="none" data-testid="therapy-durations">
      <defs>
        {entries.map(({ entry, index, kind }) => {
          const visual = therapyVisual(kind, index);
          const patternId = `${baseId}_${kind}_${entry.id}`;
          return (
            <pattern key={patternId} id={patternId} width={visual.spacing} height={visual.spacing} patternUnits="userSpaceOnUse" patternTransform={`rotate(${visual.angle})`}>
              <line x1="0" y1="0" x2="0" y2={visual.spacing} stroke={visual.color} strokeWidth={visual.strokeWidth} strokeDasharray={visual.dasharray} opacity="0.34" />
            </pattern>
          );
        })}
      </defs>
      {entries.map(({ entry, kind }) => {
        const end = displayEndTime(entry, now, endedAt);
        if (end === null || end <= entry.startTime) return null;
        const x1 = Math.max(layout.plotLeft, timeToX(xScale, entry.startTime));
        const x2 = Math.min(layout.plotRight, timeToX(xScale, end));
        const patternId = `${baseId}_${kind}_${entry.id}`;
        return (
          <g key={entry.id} data-testid={`${kind}-duration-${entry.id}`}>
            {layout.bands.map((band) => (
              <rect
                key={band.kind}
                x={x1}
                y={band.innerTop}
                width={Math.max(1, x2 - x1)}
                height={Math.max(1, band.innerBottom - band.innerTop)}
                fill={`url(#${patternId})`}
                data-testid={`${kind}-hatch-${entry.id}-${band.kind}`}
              />
            ))}
          </g>
        );
      })}
    </g>
  );
}

export function TherapyMarkerLayer({
  layout,
  xScale,
  now,
  endedAt,
  medications,
  infusions,
  events,
  minTime,
  maxTime,
  getSvgRect,
  onEditMedication,
  onEditInfusion,
  onEditEvent,
  onCommitEventTime,
}: {
  layout: TimelineLayout;
  xScale: XScale;
  now: number;
  endedAt: number | null;
  medications: MedicationEntry[];
  infusions: InfusionEntry[];
  events: TimelineEvent[];
  minTime: number;
  maxTime: number;
  getSvgRect: () => DOMRect | null;
  onEditMedication: (entry: MedicationEntry) => void;
  onEditInfusion: (entry: InfusionEntry) => void;
  onEditEvent: (entry: TimelineEvent) => void;
  onCommitEventTime: (id: string, time: number) => void;
}) {
  const medicationLane = layout.therapyLanes[0];
  const infusionLane = layout.therapyLanes[1];
  const eventLane = layout.therapyLanes[2];
  return (
    <g data-testid="therapy-markers">
      {medications.map((entry, index) => (
        <TherapyMarker
          key={entry.id}
          x={timeToX(xScale, entry.startTime)}
          laneTop={medicationLane.top}
          plotBottom={layout.plotBottom}
          plotRight={layout.plotRight}
          label={`${entry.name} · ${entry.dose} ${entry.unit}`}
          time={entry.startTime}
          className="medication"
          testId={`medication-${entry.id}`}
          markerIndex={index}
          endX={durationEndX(entry, xScale, now, endedAt, layout.plotRight)}
          onEdit={() => onEditMedication(entry)}
        />
      ))}
      {infusions.map((entry, index) => (
        <TherapyMarker
          key={entry.id}
          x={timeToX(xScale, entry.startTime)}
          laneTop={infusionLane.top}
          plotBottom={layout.plotBottom}
          plotRight={layout.plotRight}
          label={`${entry.name} · ${entry.amount} ${entry.unit}`}
          time={entry.startTime}
          className="infusion"
          testId={`infusion-${entry.id}`}
          markerIndex={index}
          endX={durationEndX(entry, xScale, now, endedAt, layout.plotRight)}
          onEdit={() => onEditInfusion(entry)}
        />
      ))}
      {events.map((entry, index) => (
        <DraggableEventMarker
          key={entry.id}
          entry={entry}
          markerIndex={index}
          laneTop={eventLane.top}
          plotBottom={layout.plotBottom}
          plotLeft={layout.plotLeft}
          plotRight={layout.plotRight}
          xScale={xScale}
          minTime={minTime}
          maxTime={maxTime}
          getSvgRect={getSvgRect}
          onEdit={() => onEditEvent(entry)}
          onCommit={(time) => onCommitEventTime(entry.id, time)}
        />
      ))}
    </g>
  );
}

function TherapyMarker({
  x,
  laneTop,
  plotBottom,
  plotRight,
  label,
  time,
  className,
  testId,
  markerIndex,
  endX,
  onEdit,
}: {
  x: number;
  laneTop: number;
  plotBottom: number;
  plotRight: number;
  label: string;
  time: number;
  className: "medication" | "infusion";
  testId: string;
  markerIndex: number;
  endX: number | null;
  onEdit: () => void;
}) {
  const markerY = laneTop + 25 + (markerIndex % 3) * 25;
  const visual = therapyVisual(className, markerIndex);
  const nearRight = x > plotRight - 190;
  const textX = nearRight ? x - 8 : x + 8;
  const textAnchor = nearRight ? "end" : "start";
  return (
    <>
      <line x1={x} y1={laneTop} x2={x} y2={plotBottom} className="therapy-start-line" stroke={visual.color} strokeWidth={visual.strokeWidth} strokeDasharray={visual.dasharray ?? "4 3"} pointerEvents="none" />
      {endX !== null ? (
        <line x1={x} y1={markerY} x2={endX} y2={markerY} stroke={visual.color} strokeWidth={4} strokeDasharray={visual.dasharray} strokeLinecap="round" opacity={0.72} pointerEvents="none" data-testid={`${testId}-lane-interval`} />
      ) : null}
      <g
        role="button"
        tabIndex={0}
        aria-label={`${label} um ${formatClock(time)} bearbeiten`}
        className="therapy-marker-focus"
        data-testid={testId}
        onClick={(event) => {
          event.stopPropagation();
          onEdit();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onEdit();
          }
        }}
      >
        <rect x={nearRight ? x - 150 : x - 10} y={markerY - 13} width={150} height={28} rx={6} fill="transparent" data-testid={`therapy-hit-${testId}`} />
        <circle cx={x} cy={markerY} r={8} fill="transparent" />
        <circle cx={x} cy={markerY} r={6} className="therapy-marker-dot" fill={visual.color} />
        <text x={textX} y={markerY - 2} textAnchor={textAnchor} className="therapy-marker-label">{label}</text>
        <text x={textX} y={markerY + 11} textAnchor={textAnchor} className="therapy-marker-time">{formatClock(time)}</text>
      </g>
    </>
  );
}

function durationEndX(
  entry: MedicationEntry | InfusionEntry,
  xScale: XScale,
  now: number,
  endedAt: number | null,
  plotRight: number,
): number | null {
  const end = displayEndTime(entry, now, endedAt);
  return end !== null && end > entry.startTime ? Math.min(plotRight, timeToX(xScale, end)) : null;
}

function DraggableEventMarker({
  entry,
  markerIndex,
  laneTop,
  plotBottom,
  plotLeft,
  plotRight,
  xScale,
  minTime,
  maxTime,
  getSvgRect,
  onEdit,
  onCommit,
}: {
  entry: TimelineEvent;
  markerIndex: number;
  laneTop: number;
  plotBottom: number;
  plotLeft: number;
  plotRight: number;
  xScale: XScale;
  minTime: number;
  maxTime: number;
  getSvgRect: () => DOMRect | null;
  onEdit: () => void;
  onCommit: (time: number) => void;
}) {
  const [preview, setPreview] = useState<number | null>(null);
  const previewRef = useRef<number | null>(null);
  const updatePreview = (clientX: number) => {
    const rect = getSvgRect();
    if (!rect) return;
    const x = clampValue(clientX - rect.left, plotLeft, plotRight);
    const time = Math.round(clampValue(xToTime(xScale, x), minTime, maxTime));
    previewRef.current = time;
    setPreview(time);
  };
  const gesture = usePointerGesture({
    capture: true,
    threshold: 9,
    onTap: onEdit,
    onDragStart: (event) => updatePreview(event.clientX),
    onDragMove: (event) => updatePreview(event.clientX),
    onDragEnd: () => {
      if (previewRef.current !== null) onCommit(previewRef.current);
      previewRef.current = null;
      setPreview(null);
    },
    onCancel: () => {
      previewRef.current = null;
      setPreview(null);
    },
  });
  const shownTime = preview ?? entry.time;
  const x = timeToX(xScale, shownTime);
  const definition = eventDefinition(entry.eventType);
  const markerY = laneTop + 25 + (markerIndex % 3) * 25;
  const nearRight = x > plotRight - 150;
  const textX = nearRight ? x - 8 : x + 8;
  const anchor = nearRight ? "end" : "start";
  return (
    <>
      <line x1={x} y1={laneTop} x2={x} y2={plotBottom} className="timeline-event-line" data-testid="event-line" pointerEvents="none" />
      <g data-testid={`event-${entry.eventType}`}>
        <circle cx={x} cy={markerY} r={9} className="event-marker-circle" pointerEvents="none" />
        <text x={x} y={markerY + 4} textAnchor="middle" className="event-marker-symbol" pointerEvents="none" aria-hidden>{definition.symbol}</text>
        <text x={textX} y={markerY - 2} textAnchor={anchor} className="event-marker-label" pointerEvents="none">{definition.label}</text>
        <text x={textX} y={markerY + 11} textAnchor={anchor} className="event-marker-time" pointerEvents="none">{formatClock(shownTime)}</text>
        <rect
          x={x - 14}
          y={markerY - 10}
          width={28}
          height={28}
          rx={14}
          fill="transparent"
          role="button"
          tabIndex={0}
          aria-label={`${definition.label} um ${formatClock(shownTime)} bearbeiten oder horizontal verschieben`}
          className="event-marker-focus"
          data-testid={`event-hit-${entry.eventType}`}
          style={{ touchAction: "none", cursor: "ew-resize" }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onEdit();
            }
          }}
          {...gesture}
        />
        {preview !== null ? (
          <g pointerEvents="none" data-testid="event-drag-tooltip">
            <rect x={nearRight ? x - 88 : x + 8} y={markerY + 13} width={80} height={22} rx={5} className="event-drag-tooltip" />
            <text x={nearRight ? x - 48 : x + 48} y={markerY + 28} textAnchor="middle" className="event-drag-tooltip-text">{formatClock(shownTime)}</text>
          </g>
        ) : null}
      </g>
    </>
  );
}
