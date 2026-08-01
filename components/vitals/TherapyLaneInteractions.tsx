"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { eventDefinition } from "../../lib/timeline/events";
import { formatClock } from "../../lib/timeline/format";
import type { TimelineLayout } from "../../lib/timeline/geometry";
import { clampValue } from "../../lib/timeline/measurementUtils";
import { timeToX, xToTime, type XScale } from "../../lib/timeline/scales";
import { validateTimelineTime, type TimelineTimeError } from "../../lib/timeline/timeValidation";
import { NOW_SNAP_PX } from "../../lib/timeline/config";
import { usePointerGesture } from "../../hooks/useTimelinePointer";
import type { TimelineEventType } from "../../types/vitals";

export type TherapyLaneKind = "medication" | "infusion" | "event";

export interface LanePlacementPreview {
  kind: TherapyLaneKind;
  x: number;
  time: number;
  error: TimelineTimeError | null;
  eventType?: TimelineEventType;
}

interface Props {
  layout: TimelineLayout;
  xScale: XScale;
  startedAt: number;
  endedAt: number | null;
  now: number;
  selectedEvent: TimelineEventType | null;
  preview: LanePlacementPreview | null;
  onPreview: (preview: LanePlacementPreview | null) => void;
  onCreateMedication: (time: number) => void;
  onCreateInfusion: (time: number) => void;
  onPlaceEvent: (eventType: TimelineEventType, time: number) => void;
  onInvalid: (error: TimelineTimeError) => void;
  onMissingEvent: () => void;
}

export function TherapyLaneInteractionLayer(props: Props) {
  const lanes = [
    { kind: "medication" as const, lane: props.layout.therapyLanes[0] },
    { kind: "infusion" as const, lane: props.layout.therapyLanes[1] },
    { kind: "event" as const, lane: props.layout.therapyLanes[2] },
  ];
  return (
    <g data-testid="therapy-lane-interactions">
      {lanes.map(({ kind, lane }) => (
        <LaneTarget key={kind} kind={kind} lane={lane} {...props} />
      ))}
      <LanePreview preview={props.preview} layout={props.layout} />
    </g>
  );
}

function LaneTarget({
  kind,
  lane,
  layout,
  xScale,
  startedAt,
  endedAt,
  now,
  selectedEvent,
  onPreview,
  onCreateMedication,
  onCreateInfusion,
  onPlaceEvent,
  onInvalid,
  onMissingEvent,
}: Props & { kind: TherapyLaneKind; lane: TimelineLayout["therapyLanes"][number] }) {
  const latest = useRef<LanePlacementPreview | null>(null);
  const mapEvent = (event: ReactPointerEvent<SVGRectElement>) => {
    const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!rect) return null;
    const x = clampValue(event.clientX - rect.left, layout.plotLeft, layout.plotRight);
    const nowX = timeToX(xScale, now);
    const time = Math.abs(x - nowX) <= NOW_SNAP_PX ? now : Math.round(xToTime(xScale, x));
    const error = validateTimelineTime(time, startedAt, Date.now(), endedAt);
    const mapped: LanePlacementPreview = {
      kind,
      x,
      time,
      error,
      ...(kind === "event" && selectedEvent ? { eventType: selectedEvent } : {}),
    };
    latest.current = mapped;
    return mapped;
  };
  const place = (event: ReactPointerEvent<Element>) => {
    const mapped = mapEvent(event as ReactPointerEvent<SVGRectElement>);
    if (!mapped) return;
    if (mapped.error) {
      onInvalid(mapped.error);
      return;
    }
    if (kind === "event" && !selectedEvent) {
      onMissingEvent();
      return;
    }
    if (kind === "medication") onCreateMedication(mapped.time);
    if (kind === "infusion") onCreateInfusion(mapped.time);
    if (kind === "event" && selectedEvent) onPlaceEvent(selectedEvent, mapped.time);
  };
  const gesture = usePointerGesture({ capture: false, threshold: 9, onTap: place });
  return (
    <rect
      x={layout.plotLeft}
      y={lane.top}
      width={layout.plotWidth}
      height={lane.height}
      fill="transparent"
      data-testid={`lane-create-${kind}`}
      aria-label={kind === "event" ? "Ereignis im Zeitbereich platzieren" : `${kind === "medication" ? "Medikament" : "Infusion oder Flüssigkeit"} zu einer Zeit anlegen`}
      role="button"
      tabIndex={0}
      className="therapy-lane-hit"
      style={{ touchAction: "pan-y", cursor: kind === "event" && !selectedEvent ? "default" : "crosshair" }}
      onPointerMove={(event) => {
        gesture.onPointerMove(event);
        if (event.pointerType === "mouse" || event.pointerType === "pen") {
          const mapped = mapEvent(event);
          if (mapped) onPreview(mapped);
        }
      }}
      onPointerLeave={() => onPreview(null)}
      onFocus={() => {
        const time = endedAt ?? now;
        onPreview({ kind, time, x: timeToX(xScale, time), error: null, ...(kind === "event" && selectedEvent ? { eventType: selectedEvent } : {}) });
      }}
      onBlur={() => onPreview(null)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        const time = endedAt ?? now;
        if (kind === "medication") onCreateMedication(time);
        if (kind === "infusion") onCreateInfusion(time);
        if (kind === "event" && selectedEvent) onPlaceEvent(selectedEvent, time);
        if (kind === "event" && !selectedEvent) onMissingEvent();
      }}
      onPointerDown={(event) => {
        const mapped = mapEvent(event);
        if (mapped) onPreview(mapped);
        gesture.onPointerDown(event);
      }}
      onPointerUp={(event) => {
        gesture.onPointerUp(event);
        onPreview(null);
      }}
      onPointerCancel={(event) => {
        gesture.onPointerCancel(event);
        onPreview(null);
      }}
    />
  );
}

function LanePreview({ preview, layout }: { preview: LanePlacementPreview | null; layout: TimelineLayout }) {
  if (!preview) return null;
  const lane = preview.kind === "medication"
    ? layout.therapyLanes[0]
    : preview.kind === "infusion"
      ? layout.therapyLanes[1]
      : layout.therapyLanes[2];
  const event = preview.eventType ? eventDefinition(preview.eventType) : null;
  const label = preview.kind === "medication"
    ? "Medikament anlegen"
    : preview.kind === "infusion"
      ? "Infusion / Flüssigkeit anlegen"
      : event
        ? `${event.symbol} ${event.label} platzieren`
        : "Links ein Ereignis auswählen";
  const nearRight = preview.x > layout.plotRight - 210;
  const x = nearRight ? preview.x - 202 : preview.x + 8;
  return (
    <g pointerEvents="none" data-testid="lane-placement-preview">
      <line x1={preview.x} y1={lane.top} x2={preview.x} y2={lane.bottom} className={`lane-preview-line ${preview.error ? "lane-preview-line--invalid" : ""}`} />
      {event ? <text x={preview.x} y={lane.top + 18} textAnchor="middle" className="lane-preview-symbol">{event.symbol}</text> : null}
      <rect x={x} y={lane.bottom - 24} width={194} height={21} rx={5} className="lane-preview-tooltip" />
      <text x={x + 7} y={lane.bottom - 9} className="lane-preview-tooltip__text">
        {formatClock(preview.time)} · {preview.error ? "nicht verfügbar" : label}
      </text>
    </g>
  );
}
