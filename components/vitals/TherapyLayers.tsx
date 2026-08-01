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

interface SharedProps {
  layout: TimelineLayout;
  xScale: XScale;
  now: number;
  endedAt: number | null;
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
  const clipId = useId().replace(/:/g, "_");
  return (
    <g pointerEvents="none" clipPath={`url(#${clipId})`} data-testid="therapy-durations">
      <defs>
        <clipPath id={clipId}>
          <rect x={layout.plotLeft} y={layout.contentTop} width={layout.plotWidth} height={layout.plotBottom - layout.contentTop} />
        </clipPath>
      </defs>
      {medications.map((entry) => {
        const end = displayEndTime(entry, now, endedAt);
        if (end === null || end <= entry.startTime) return null;
        const x1 = timeToX(xScale, entry.startTime);
        const x2 = timeToX(xScale, end);
        return (
          <rect
            key={entry.id}
            x={x1}
            y={layout.contentTop}
            width={Math.max(1, x2 - x1)}
            height={layout.plotBottom - layout.contentTop}
            className="therapy-duration therapy-duration--medication"
            data-testid={`medication-duration-${entry.id}`}
          />
        );
      })}
      {infusions.map((entry) => {
        const end = displayEndTime(entry, now, endedAt);
        if (end === null || end <= entry.startTime) return null;
        const x1 = timeToX(xScale, entry.startTime);
        const x2 = timeToX(xScale, end);
        return (
          <rect
            key={entry.id}
            x={x1}
            y={layout.contentTop}
            width={Math.max(1, x2 - x1)}
            height={layout.plotBottom - layout.contentTop}
            className="therapy-duration therapy-duration--infusion"
            data-testid={`infusion-duration-${entry.id}`}
          />
        );
      })}
    </g>
  );
}

export function TherapyMarkerLayer({
  layout,
  xScale,
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
          label={`${entry.name} · ${entry.dose} ${entry.unit}`}
          time={entry.startTime}
          className="medication"
          testId={`medication-${entry.id}`}
          markerIndex={index}
          onEdit={() => onEditMedication(entry)}
        />
      ))}
      {infusions.map((entry, index) => (
        <TherapyMarker
          key={entry.id}
          x={timeToX(xScale, entry.startTime)}
          laneTop={infusionLane.top}
          plotBottom={layout.plotBottom}
          label={`${entry.name} · ${entry.amount} ${entry.unit}`}
          time={entry.startTime}
          className="infusion"
          testId={`infusion-${entry.id}`}
          markerIndex={index}
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
  label,
  time,
  className,
  testId,
  markerIndex,
  onEdit,
}: {
  x: number;
  laneTop: number;
  plotBottom: number;
  label: string;
  time: number;
  className: "medication" | "infusion";
  testId: string;
  markerIndex: number;
  onEdit: () => void;
}) {
  const markerY = laneTop + 18 + markerIndex * 32;
  return (
    <>
      <line x1={x} y1={laneTop} x2={x} y2={plotBottom} className={`therapy-start-line therapy-start-line--${className}`} pointerEvents="none" />
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
        <rect x={x - 10} y={markerY - 13} width={150} height={28} rx={6} fill="transparent" data-testid={`therapy-hit-${testId}`} />
        <circle cx={x} cy={markerY} r={8} fill="transparent" />
        <circle cx={x} cy={markerY} r={6} className={`therapy-marker-dot therapy-marker-dot--${className}`} />
        <text x={x + 8} y={markerY - 2} className="therapy-marker-label">{label}</text>
        <text x={x + 8} y={markerY + 11} className="therapy-marker-time">{formatClock(time)}</text>
      </g>
    </>
  );
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
  const markerY = laneTop + 15 + markerIndex * 18;
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
