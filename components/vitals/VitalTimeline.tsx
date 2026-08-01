"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { App } from "antd";
import { BAND_ORDER, VITAL_CONFIG } from "../../lib/timeline/config";
import { computeTimelineLayout } from "../../lib/timeline/geometry";
import { findNearestHit, type HitTarget } from "../../lib/timeline/hitTesting";
import { buildXScale, buildYScales, computeDomain, timeToX, xToTime } from "../../lib/timeline/scales";
import { relativeTimelineTicks } from "../../lib/timeline/timeTicks";
import { mapPointerToTimeline, type PointerMapResult } from "../../lib/timeline/pointerMapping";
import { clampValue, roundToPrecision } from "../../lib/timeline/measurementUtils";
import { formatClock, formatVitalNumber } from "../../lib/timeline/format";
import { maxDocumentableTime, type TimelineTimeError } from "../../lib/timeline/timeValidation";
import { useCurrentTime } from "../../hooks/useCurrentTime";
import { useElementSize } from "../../hooks/useElementSize";
import { useCaseStore } from "../../store/anesthesiaCaseStore";
import { TimeGrid } from "./TimeGrid";
import { VitalBandBackground } from "./VitalBandBackground";
import { Spo2Band } from "./Spo2Band";
import { LineBand } from "./LineBand";
import { NibpBand, NibpHandleLayer } from "./NibpBand";
import { CurrentTimeIndicator } from "./CurrentTimeIndicator";
import { VitalEntryDrawer } from "./VitalEntryDrawer";
import { TherapyEntryDrawer } from "./TherapyEntryDrawer";
import { EventLaneTools } from "./TherapyToolbar";
import {
  TherapyIntervalTooltip,
  TherapyDurationLayer,
  TherapyLaneBackgrounds,
  TherapyMarkerLayer,
  therapyIntervalsAtTime,
  type ActiveTherapyInterval,
} from "./TherapyLayers";
import {
  TherapyLaneInteractionLayer,
  type LanePlacementPreview,
} from "./TherapyLaneInteractions";
import type { BandContext, DragPreview, EntryDraft, TherapyDraft } from "./timelineTypes";
import type { Measurement, NibpMeasurement, ScalarMeasurement, TimelineEventType, VitalKind } from "../../types/vitals";

const MIN_WIDTH = 320;
const NOW_INTERVAL_MS = 250;
const DRAG_THRESHOLD_PX = 9;

type CursorMap = Extract<PointerMapResult, { svgX: number }>;
type CrosshairState = CursorMap & { locked: boolean };

interface PlotPointerState {
  active: boolean;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  moved: boolean;
  dragging: boolean;
  targetId: string | null;
}

interface IntervalTooltipState {
  items: ActiveTherapyInterval[];
  x: number;
  y: number;
  locked: boolean;
}

const EMPTY_POINTER: PlotPointerState = {
  active: false,
  pointerId: -1,
  pointerType: "mouse",
  startX: 0,
  startY: 0,
  moved: false,
  dragging: false,
  targetId: null,
};

export function VitalTimeline() {
  const { message } = App.useApp();
  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pointerRef = useRef<PlotPointerState>({ ...EMPTY_POINTER });

  const startedAt = useCaseStore((state) => state.startedAt);
  const endedAt = useCaseStore((state) => state.endedAt);
  const measurements = useCaseStore((state) => state.measurements);
  const medications = useCaseStore((state) => state.medications);
  const infusions = useCaseStore((state) => state.infusions);
  const events = useCaseStore((state) => state.events);
  const updateScalar = useCaseStore((state) => state.updateScalar);
  const updateNibp = useCaseStore((state) => state.updateNibp);
  const updateEventTime = useCaseStore((state) => state.updateEventTime);
  const upsertEvent = useCaseStore((state) => state.upsertEvent);

  const now = useCurrentTime(NOW_INTERVAL_MS, endedAt);
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [therapyDraft, setTherapyDraft] = useState<TherapyDraft | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [crosshair, setCrosshair] = useState<CrosshairState | null>(null);
  const [selectedEventType, setSelectedEventType] = useState<TimelineEventType | null>(null);
  const [lanePreview, setLanePreview] = useState<LanePlacementPreview | null>(null);
  const [intervalTooltip, setIntervalTooltip] = useState<IntervalTooltipState | null>(null);

  const width = Math.max(MIN_WIDTH, Math.round(size.width) || MIN_WIDTH);
  const layout = useMemo(() => computeTimelineLayout(width), [width]);
  const yScales = useMemo(() => buildYScales(layout), [layout]);
  const nowValue = now ?? 0;
  const domain = computeDomain(startedAt, nowValue, undefined, endedAt);
  const xScale = useMemo(
    () => buildXScale({ start: domain.start, end: domain.end }, layout),
    [domain.start, domain.end, layout],
  );
  const ticks = useMemo(
    () => relativeTimelineTicks(domain.start, domain.end, layout.plotWidth),
    [domain.start, domain.end, layout.plotWidth],
  );

  const scalarsOf = (kind: VitalKind) =>
    measurements.filter((measurement): measurement is ScalarMeasurement => measurement.kind === kind);
  const nibps = measurements.filter((measurement): measurement is NibpMeasurement => measurement.kind === "nibp");

  const lastByKind = useMemo(() => {
    const map: Record<VitalKind, string | null> = { spo2: null, heartRate: null, nibp: null, temperature: null };
    for (const kind of BAND_ORDER) {
      const list = measurements.filter((measurement) => measurement.kind === kind).sort((a, b) => a.time - b.time);
      const last = list[list.length - 1];
      if (!last) continue;
      map[kind] = last.kind === "nibp"
        ? `${last.systolic ?? "–"}/${last.diastolic ?? "–"} (M ${last.mean})`
        : `${formatVitalNumber(kind, last.value)} ${VITAL_CONFIG[kind].unit}`;
    }
    return map;
  }, [measurements]);

  const hitTargets = useMemo<HitTarget[]>(
    () => measurements.map((measurement) => {
      const x = timeToX(xScale, measurement.time);
      if (measurement.kind === "nibp") {
        const scale = yScales.nibp;
        const meanY = scale(measurement.mean);
        return {
          id: measurement.id,
          shape: "nibp" as const,
          x,
          y1: measurement.systolic === null ? meanY - 16 : scale(measurement.systolic),
          y2: measurement.diastolic === null ? meanY + 16 : scale(measurement.diastolic),
          meanY,
        };
      }
      return { id: measurement.id, shape: "point" as const, x, y: yScales[measurement.kind](measurement.value) };
    }),
    [measurements, xScale, yScales],
  );

  const openEdit = (measurement: Measurement, nibpFocus?: "systolic" | "diastolic") => {
    setSelectedId(measurement.id);
    setCrosshair(crosshairForMeasurement(measurement, xScale, yScales));
    if (measurement.kind === "nibp") {
      setDraft({
        mode: "edit-nibp",
        id: measurement.id,
        time: measurement.time,
        systolic: measurement.systolic,
        mean: measurement.mean,
        diastolic: measurement.diastolic,
        ...(nibpFocus ? { focusPart: nibpFocus } : {}),
      });
    } else {
      setDraft({
        mode: "edit-scalar",
        id: measurement.id,
        kind: measurement.kind,
        time: measurement.time,
        value: measurement.value,
      });
    }
  };

  const mapPointer = (clientX: number, clientY: number): PointerMapResult => {
    if (startedAt === null || !svgRef.current) return { ok: false, reason: "outside" };
    return mapPointerToTimeline({
      clientX,
      clientY,
      rect: svgRef.current.getBoundingClientRect(),
      layout,
      xScale,
      yScales,
      startedAt,
      now: nowValue,
      endedAt,
    });
  };

  const showTimeError = (error: TimelineTimeError) => {
    if (error === "future") message.warning("Zukünftige Werte können nicht dokumentiert werden.");
    if (error === "beforeStart") message.warning("Werte vor dem Start können nicht dokumentiert werden.");
    if (error === "afterEnd") {
      message.error("Nach dem Ende des Eingriffs können keine neuen Einträge dokumentiert werden.");
    }
  };

  const intervalAtPointer = (clientX: number, clientY: number, locked: boolean): IntervalTooltipState | null => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = clampValue(clientX - rect.left, layout.plotLeft, layout.plotRight);
    const y = clampValue(clientY - rect.top, layout.plotTop, layout.plotBottom);
    const time = xToTime(xScale, x);
    const items = therapyIntervalsAtTime(time, medications, infusions, nowValue, endedAt);
    return items.length > 0 ? { items, x, y, locked } : null;
  };

  const openCreate = (mapped: CursorMap) => {
    if (!mapped.ok) {
      showTimeError(mapped.reason);
      setCrosshair({ ...mapped, locked: false });
      return;
    }
    setSelectedId(null);
    setCrosshair({ ...mapped, locked: true });
    if (mapped.kind === "nibp") {
      setDraft({ mode: "create-nibp", time: mapped.time, mean: mapped.pointerValue });
    } else {
      setDraft({ mode: "create-scalar", kind: mapped.kind, time: mapped.time, value: mapped.pointerValue });
    }
  };

  const onScalarDragMove = (measurement: ScalarMeasurement, clientX: number, clientY: number) => {
    if (!svgRef.current || startedAt === null) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = clampValue(clientX - rect.left, layout.plotLeft, layout.plotRight);
    const svgY = clientY - rect.top;
    const upperTime = maxDocumentableTime(nowValue, endedAt);
    const time = clampValue(xToTime(xScale, svgX), startedAt, upperTime);
    const config = VITAL_CONFIG[measurement.kind];
    const value = roundToPrecision(
      clampValue(yScales[measurement.kind].invert(svgY), config.min, config.max),
      config.precision,
    );
    setDragPreview({ id: measurement.id, kind: measurement.kind, time, value });
    setCrosshair({
      ok: true,
      kind: measurement.kind,
      time,
      value,
      pointerValue: value,
      svgX,
      svgY: yScales[measurement.kind](value),
      locked: true,
    });
  };

  const finishScalarDrag = (measurement: ScalarMeasurement) => {
    if (dragPreview?.id === measurement.id) {
      updateScalar(measurement.id, dragPreview.time, dragPreview.value);
    }
    setDragPreview(null);
  };

  const resetPointer = () => {
    pointerRef.current = { ...EMPTY_POINTER };
  };

  const onPlotPointerDown = (event: ReactPointerEvent<SVGRectElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (startedAt === null) {
      message.info("Bitte starten Sie zuerst den Fall.");
      return;
    }
    const mapped = mapPointer(event.clientX, event.clientY);
    if ("svgX" in mapped) setCrosshair({ ...mapped, locked: true });
    const rect = svgRef.current?.getBoundingClientRect();
    const hit = rect
      ? findNearestHit(
          { x: event.clientX - rect.left, y: event.clientY - rect.top },
          hitTargets,
          event.pointerType,
        )
      : null;
    pointerRef.current = {
      active: true,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      dragging: false,
      targetId: hit?.id ?? null,
    };
    const target = hit ? measurements.find((measurement) => measurement.id === hit.id) : null;
    if (target && target.kind !== "nibp") {
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* no capture */ }
    }
  };

  const onPlotPointerMove = (event: ReactPointerEvent<SVGRectElement>) => {
    const state = pointerRef.current;
    if (!state.active || state.pointerId !== event.pointerId) {
      if ((event.pointerType === "mouse" || event.pointerType === "pen") && !draft && !therapyDraft) {
        const mapped = mapPointer(event.clientX, event.clientY);
        setCrosshair("svgX" in mapped ? { ...mapped, locked: false } : null);
        setIntervalTooltip(intervalAtPointer(event.clientX, event.clientY, false));
      }
      return;
    }
    const distance = Math.hypot(event.clientX - state.startX, event.clientY - state.startY);
    if (distance > DRAG_THRESHOLD_PX) state.moved = true;
    const target = state.targetId
      ? measurements.find((measurement): measurement is ScalarMeasurement =>
          measurement.id === state.targetId && measurement.kind !== "nibp",
        )
      : null;
    if (target && state.moved) {
      state.dragging = true;
      onScalarDragMove(target, event.clientX, event.clientY);
    }
  };

  const onPlotPointerUp = (event: ReactPointerEvent<SVGRectElement>) => {
    const state = pointerRef.current;
    if (!state.active || state.pointerId !== event.pointerId) return;
    const target = state.targetId ? measurements.find((measurement) => measurement.id === state.targetId) : null;
    if (!state.moved && !target && event.pointerType === "touch") {
      const touchedInterval = intervalAtPointer(event.clientX, event.clientY, true);
      if (touchedInterval && !intervalTooltip?.locked) {
        setIntervalTooltip(touchedInterval);
        try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
        resetPointer();
        return;
      }
      if (!touchedInterval) setIntervalTooltip(null);
    }
    if (state.dragging && target?.kind !== "nibp" && target) {
      finishScalarDrag(target);
    } else if (!state.moved) {
      if (target) openEdit(target);
      else {
        const mapped = mapPointer(event.clientX, event.clientY);
        if ("svgX" in mapped) openCreate(mapped);
      }
    }
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
    resetPointer();
  };

  const closeVitalDraft = () => {
    setDraft(null);
    setSelectedId(null);
    setCrosshair(null);
    setIntervalTooltip(null);
  };
  const openTherapyDraft = (next: TherapyDraft) => {
    setCrosshair(null);
    setIntervalTooltip(null);
    setLanePreview(null);
    setTherapyDraft(next);
  };

  const ctx: BandContext = {
    layout,
    xScale,
    yScales,
    startedAt: startedAt ?? nowValue,
    now: nowValue,
    selectedId,
    dragPreview,
    onPointTap: openEdit,
    onScalarDragMove,
    onScalarDragEnd: finishScalarDrag,
    onScalarDragCancel: () => setDragPreview(null),
  };

  const showData = startedAt !== null;

  return (
    <>
      <div ref={containerRef} className="timeline-surface" data-testid="vital-timeline">
        {now === null ? <div style={{ height: layout.height }} /> : (
          <svg
            ref={svgRef}
            width={width}
            height={layout.height}
            viewBox={`0 0 ${width} ${layout.height}`}
            role="img"
            aria-label="Gemeinsame Zeitgrafik für Therapien, Ereignisse und Vitalparameter"
            data-testid="vital-timeline-svg"
            style={{ touchAction: "pan-y", display: "block" }}
          >
            <TherapyLaneBackgrounds layout={layout} />
            {layout.bands.map((band) => (
              <VitalBandBackground key={band.kind} band={band} layout={layout} yScale={yScales[band.kind]} lastValueText={lastByKind[band.kind]} />
            ))}
            <TimeGrid layout={layout} xScale={xScale} majorTicks={ticks.major} minorTicks={ticks.minor} />
            <TherapyDurationLayer layout={layout} xScale={xScale} now={nowValue} endedAt={endedAt} medications={medications} infusions={infusions} />
            {startedAt !== null ? (
              <TherapyLaneInteractionLayer
                layout={layout}
                xScale={xScale}
                startedAt={startedAt}
                endedAt={endedAt}
                now={nowValue}
                selectedEvent={selectedEventType}
                preview={lanePreview}
                onPreview={setLanePreview}
                onCreateMedication={(time) => openTherapyDraft({ mode: "create-medication", startTime: time })}
                onCreateInfusion={(time) => openTherapyDraft({ mode: "create-infusion", startTime: time })}
                onPlaceEvent={(eventType, time) => {
                  upsertEvent(eventType, time);
                  setSelectedEventType(null);
                  setLanePreview(null);
                  message.success("Ereignis platziert.");
                }}
                onInvalid={showTimeError}
                onMissingEvent={() => message.warning("Bitte zuerst links ein Ereignissymbol auswählen.")}
              />
            ) : null}
            <EventLaneTools
              layout={layout}
              disabled={startedAt === null || endedAt !== null}
              selected={selectedEventType}
              onSelect={(eventType) => {
                // Eine erneute Beruehrung desselben Werkzeugs darf die Auswahl
                // nicht unbemerkt aufheben (wichtig fuer iPad/Pen-Clickfolgen).
                setSelectedEventType(eventType);
                setLanePreview(null);
              }}
            />

            {showData ? (
              <>
                <Spo2Band measurements={scalarsOf("spo2")} ctx={ctx} />
                <LineBand kind="heartRate" measurements={scalarsOf("heartRate")} ctx={ctx} testId="series-heartRate" />
                <NibpBand measurements={nibps} ctx={ctx} />
                <LineBand kind="temperature" measurements={scalarsOf("temperature")} ctx={ctx} testId="series-temperature" />
              </>
            ) : null}

            <rect
              x={layout.plotLeft}
              y={layout.plotTop}
              width={layout.plotWidth}
              height={layout.plotBottom - layout.plotTop}
              fill="transparent"
              data-testid="timeline-create-area"
              style={{ touchAction: "pan-y", cursor: startedAt === null ? "not-allowed" : "crosshair" }}
              onPointerDown={onPlotPointerDown}
              onPointerMove={onPlotPointerMove}
              onPointerUp={onPlotPointerUp}
              onPointerCancel={() => {
                setDragPreview(null);
                setIntervalTooltip(null);
                resetPointer();
              }}
              onPointerLeave={() => {
                if (!crosshair?.locked && !draft) setCrosshair(null);
                if (!intervalTooltip?.locked) setIntervalTooltip(null);
              }}
            />

            {showData ? (
              <>
                <NibpHandleLayer
                  measurements={nibps}
                  ctx={ctx}
                  onUpdate={updateNibp}
                  onEdit={(measurement, part) => openEdit(measurement, part)}
                />
                <TherapyMarkerLayer
                  layout={layout}
                  xScale={xScale}
                  now={nowValue}
                  endedAt={endedAt}
                  medications={medications}
                  infusions={infusions}
                  events={events}
                  minTime={startedAt}
                  maxTime={maxDocumentableTime(nowValue, endedAt)}
                  getSvgRect={() => svgRef.current?.getBoundingClientRect() ?? null}
                  onEditMedication={(entry) => openTherapyDraft({ mode: "edit-medication", entry })}
                  onEditInfusion={(entry) => openTherapyDraft({ mode: "edit-infusion", entry })}
                  onEditEvent={(entry) => openTherapyDraft({ mode: "edit-event", entry })}
                  onCommitEventTime={updateEventTime}
                />
                <CurrentTimeIndicator layout={layout} xScale={xScale} startedAt={startedAt} now={nowValue} />
              </>
            ) : null}
            {intervalTooltip ? (
              <TherapyIntervalTooltip items={intervalTooltip.items} x={intervalTooltip.x} y={intervalTooltip.y} layout={layout} />
            ) : null}
            <CrosshairLayer crosshair={crosshair} layout={layout} />
            {renderDraftPreview(draft, xScale, yScales)}
          </svg>
        )}
      </div>
      <VitalEntryDrawer draft={draft} onClose={closeVitalDraft} />
      <TherapyEntryDrawer draft={therapyDraft} onClose={() => setTherapyDraft(null)} />
    </>
  );
}

function crosshairForMeasurement(
  measurement: Measurement,
  xScale: BandContext["xScale"],
  yScales: BandContext["yScales"],
): CrosshairState {
  const pointerValue = measurement.kind === "nibp" ? measurement.mean : measurement.value;
  return {
    ok: true,
    kind: measurement.kind,
    time: measurement.time,
    value: measurement.kind === "nibp" ? null : measurement.value,
    pointerValue,
    svgX: timeToX(xScale, measurement.time),
    svgY: yScales[measurement.kind](pointerValue),
    locked: true,
  };
}

function CrosshairLayer({ crosshair, layout }: { crosshair: CrosshairState | null; layout: BandContext["layout"] }) {
  if (!crosshair) return null;
  const config = VITAL_CONFIG[crosshair.kind];
  const band = layout.bandByKind[crosshair.kind];
  const nearRight = crosshair.svgX > layout.plotRight - 230;
  const labelX = nearRight ? crosshair.svgX - 224 : crosshair.svgX + 10;
  const labelY = clampValue(crosshair.svgY - 42, band.top + 4, band.bottom - 48);
  const valueLabel = crosshair.kind === "nibp"
    ? `Zeigerwert ${formatVitalNumber("nibp", crosshair.pointerValue)} ${config.unit}`
    : `${config.label} ${formatVitalNumber(crosshair.kind, crosshair.pointerValue)} ${config.unit}`;
  const invalidLabel = !crosshair.ok
    ? crosshair.reason === "afterEnd"
      ? "Nicht dokumentierbar · Eingriff beendet"
      : crosshair.reason === "future"
        ? "Nicht dokumentierbar · Zukunft"
        : "Nicht dokumentierbar · vor Beginn"
    : null;
  return (
    <g pointerEvents="none" data-testid="timeline-crosshair">
      <line x1={crosshair.svgX} y1={layout.contentTop} x2={crosshair.svgX} y2={layout.plotBottom} className="crosshair-vertical" />
      <line x1={layout.plotLeft} y1={crosshair.svgY} x2={layout.plotRight} y2={crosshair.svgY} className="crosshair-horizontal" />
      <line x1={crosshair.svgX - 6} y1={crosshair.svgY} x2={crosshair.svgX + 6} y2={crosshair.svgY} className="crosshair-center" />
      <line x1={crosshair.svgX} y1={crosshair.svgY - 6} x2={crosshair.svgX} y2={crosshair.svgY + 6} className="crosshair-center" />
      <rect x={labelX} y={labelY} width={214} height={invalidLabel ? 43 : 28} rx={6} className="crosshair-tooltip" />
      <text x={labelX + 8} y={labelY + 18} className="crosshair-tooltip-text" data-testid="crosshair-coordinate">
        {formatClock(crosshair.time)} · {valueLabel}
      </text>
      {invalidLabel ? <text x={labelX + 8} y={labelY + 35} className="crosshair-tooltip-warning">{invalidLabel}</text> : null}
    </g>
  );
}

function renderDraftPreview(
  draft: EntryDraft | null,
  xScale: BandContext["xScale"],
  yScales: BandContext["yScales"],
) {
  if (!draft) return null;
  if (draft.mode === "create-scalar") {
    return <circle cx={timeToX(xScale, draft.time)} cy={yScales[draft.kind](draft.value)} r={7} fill="none" stroke="#173029" strokeWidth={2} strokeDasharray="4 3" pointerEvents="none" data-testid="draft-preview" />;
  }
  if (draft.mode === "create-nibp") {
    return <circle cx={timeToX(xScale, draft.time)} cy={yScales.nibp(draft.mean)} r={7} fill="none" stroke="#173029" strokeWidth={2} strokeDasharray="4 3" pointerEvents="none" data-testid="draft-preview" />;
  }
  return null;
}
