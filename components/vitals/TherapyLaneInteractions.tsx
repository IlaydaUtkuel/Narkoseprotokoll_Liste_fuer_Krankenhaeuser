"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { eventDefinition } from "../../lib/timeline/events";
import { formatClock } from "../../lib/timeline/format";
import type { TimelineLayout } from "../../lib/timeline/geometry";
import { clampValue } from "../../lib/timeline/measurementUtils";
import { timeToX, xToTime, type XScale } from "../../lib/timeline/scales";
import { validateTimelineTime, type TimelineTimeError } from "../../lib/timeline/timeValidation";
import { NOW_SNAP_PX } from "../../lib/timeline/config";
import { usesTwoPhase } from "../../lib/timeline/previewInteraction";
import { usePointerGesture } from "../../hooks/useTimelinePointer";
import type { TimelineEventType } from "../../types/vitals";

export interface LaneTwoPhaseTap {
  kind: "medication" | "infusion" | "event";
  time: number;
  svgX: number;
  svgY: number;
  pointerType: string;
  eventType?: TimelineEventType;
}

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
  // Stift/Finger: erster Kontakt legt Vorschau ab, zweiter Kontakt bestaetigt.
  onTwoPhaseTap: (tap: LaneTwoPhaseTap) => void;
  // Beim pointerdown: erlaubt dem Elternteil, eine nicht bestätigte Vorschau sofort
  // zu entfernen (verhindert zwei gleichzeitig sichtbare Vorschauen).
  onTwoPhaseDown?: (info: { kind: "medication" | "infusion" | "event"; svgX: number; svgY: number; pointerType: string }) => void;
  // Meldet aktive Stift-/Finger-Interaktion (fuer temporären Scroll-Lock).
  onInteractionActive?: (active: boolean) => void;
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
  onTwoPhaseTap,
  onTwoPhaseDown,
  onInteractionActive,
}: Props & { kind: TherapyLaneKind; lane: TimelineLayout["therapyLanes"][number] }) {
  const latest = useRef<LanePlacementPreview | null>(null);
  const twoPhase = useRef({ active: false, pointerId: -1 });
  // Ein Tap fokussiert das Rect ebenfalls. Die Fokus-Vorschau ist aber nur eine
  // Tastatur-Hilfe – nach einer Zeigergeste darf sie keine zweite Vorschau erzeugen.
  const pointerFocus = useRef(false);
  const laneCenterY = lane.top + lane.height / 2;
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
  // Maus/Tastatur: unveraendertes Sofort-Verhalten (ein Tap legt an).
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
  // Stift/Finger: beim Loslassen Vorschau ablegen bzw. (zweiter Kontakt) bestaetigen.
  const releaseTwoPhase = (event: ReactPointerEvent<SVGRectElement>) => {
    const mapped = mapEvent(event);
    if (!mapped) return;
    onPreview(null);
    if (mapped.error) { onInvalid(mapped.error); return; }
    if (kind === "event" && !selectedEvent) { onMissingEvent(); return; }
    onTwoPhaseTap({
      kind,
      time: mapped.time,
      svgX: mapped.x,
      svgY: laneCenterY,
      pointerType: event.pointerType,
      ...(kind === "event" && selectedEvent ? { eventType: selectedEvent } : {}),
    });
  };
  const gesture = usePointerGesture({ capture: false, threshold: 9, onTap: place });
  return (
    <g>
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
      // touch-action: none -> die Interaktion in der Lane scrollt die Seite nicht.
      style={{ touchAction: "none", cursor: kind === "event" && !selectedEvent ? "default" : "crosshair" }}
      onPointerMove={(event) => {
        if (usesTwoPhase(event.pointerType)) {
          const mapped = mapEvent(event);
          if (mapped) onPreview(kind === "event" && !selectedEvent ? null : mapped);
          return;
        }
        gesture.onPointerMove(event);
        if (event.pointerType === "mouse") {
          const mapped = mapEvent(event);
          if (mapped) onPreview(kind === "event" && !selectedEvent ? null : mapped);
        }
      }}
      onPointerLeave={() => onPreview(null)}
      onFocus={() => {
        // Fokus durch Tippen/Klicken erzeugt keine zusätzliche Vorschau.
        if (pointerFocus.current) { pointerFocus.current = false; return; }
        const time = endedAt ?? now;
        onPreview(kind === "event" && !selectedEvent ? null : { kind, time, x: timeToX(xScale, time), error: null, ...(kind === "event" && selectedEvent ? { eventType: selectedEvent } : {}) });
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
        pointerFocus.current = true;
        if (usesTwoPhase(event.pointerType)) {
          twoPhase.current = { active: true, pointerId: event.pointerId };
          try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* ignore */ }
          onInteractionActive?.(true);
          const mapped = mapEvent(event);
          // Elternteil entscheidet Bestätigung/sofortiges Löschen der alten Vorschau.
          if (mapped) onTwoPhaseDown?.({ kind, svgX: mapped.x, svgY: laneCenterY, pointerType: event.pointerType });
          if (mapped) onPreview(kind === "event" && !selectedEvent ? null : mapped);
          return;
        }
        const mapped = mapEvent(event);
        if (mapped) onPreview(kind === "event" && !selectedEvent ? null : mapped);
        gesture.onPointerDown(event);
      }}
      onPointerUp={(event) => {
        if (usesTwoPhase(event.pointerType)) {
          const state = twoPhase.current;
          twoPhase.current = { active: false, pointerId: -1 };
          try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
          onInteractionActive?.(false);
          if (state.active && state.pointerId === event.pointerId) releaseTwoPhase(event);
          return;
        }
        gesture.onPointerUp(event);
        onPreview(null);
      }}
      onPointerCancel={(event) => {
        if (usesTwoPhase(event.pointerType)) {
          twoPhase.current = { active: false, pointerId: -1 };
          try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
          onInteractionActive?.(false);
          onPreview(null);
          return;
        }
        gesture.onPointerCancel(event);
        onPreview(null);
      }}
    />
    <g className="therapy-lane-keyboard-focus" pointerEvents="none" aria-hidden>
      <circle cx={layout.plotLeft + 10} cy={lane.top + 10} r={6} />
      <path d={`M ${layout.plotLeft + 7} ${lane.top + 10} l 2 2 l 4 -4`} />
    </g>
    </g>
  );
}

function LanePreview({ preview, layout }: { preview: LanePlacementPreview | null; layout: TimelineLayout }) {
  if (!preview || (preview.kind === "event" && !preview.eventType)) return null;
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
