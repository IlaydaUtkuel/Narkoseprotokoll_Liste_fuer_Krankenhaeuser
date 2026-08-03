"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { POINTER_MOVE_THRESHOLD_PX, VITAL_COLOR_VAR } from "../../lib/timeline/config";
import { formatClock } from "../../lib/timeline/format";
import { clampValue } from "../../lib/timeline/measurementUtils";
import {
  applyNibpDrag,
  nonOverlappingRadius,
  type NibpTriple,
} from "../../lib/timeline/nibpDrag";
import { timeToX, xToTime } from "../../lib/timeline/scales";
import { clientToSvgPoint } from "../../lib/timeline/svgCoords";
import { usePointerGesture } from "../../hooks/useTimelinePointer";
import { MeasurementHit } from "./MeasurementHit";
import type { BandContext } from "./timelineTypes";
import type { NibpMeasurement } from "../../types/vitals";

interface Props {
  measurements: NibpMeasurement[];
  ctx: BandContext;
}

interface HandleLayerProps extends Props {
  onUpdate: (
    id: string,
    time: number,
    systolic: number | null,
    mean: number,
    diastolic: number | null,
  ) => void;
  onEdit: (measurement: NibpMeasurement, part: NibpPart) => void;
}

type NibpPart = "systolic" | "diastolic";

const UNSET_HANDLE_OFFSET = 16;

function endpointY(measurement: NibpMeasurement, part: NibpPart, ctx: BandContext): number {
  const value = measurement[part];
  const meanY = ctx.yScales.nibp(measurement.mean);
  return value === null
    ? meanY + (part === "systolic" ? -UNSET_HANDLE_OFFSET : UNSET_HANDLE_OFFSET)
    : ctx.yScales.nibp(value);
}

// Die gespeicherte Mitte ist der Anker. Nicht gesetzte Endpunkte werden nur als
// gestrichelte Ziehgriffe dargestellt und erhalten erst beim Drag einen Messwert.
export function NibpBand({ measurements, ctx }: Props) {
  const yScale = ctx.yScales.nibp;

  return (
    <g data-testid="points-nibp" pointerEvents="none">
      {measurements.map((measurement) => {
        const cx = timeToX(ctx.xScale, measurement.time);
        const yMean = yScale(measurement.mean);
        const ySys = endpointY(measurement, "systolic", ctx);
        const yDia = endpointY(measurement, "diastolic", ctx);
        const selected = ctx.selectedId === measurement.id;
        const ariaLabel = `Nichtinvasiver Blutdruck, Mittel ${measurement.mean} mmHg um ${formatClock(measurement.time)} bearbeiten`;

        return (
          <g key={measurement.id}>
            <line
              x1={cx}
              y1={ySys}
              x2={cx}
              y2={yDia}
              style={{ stroke: VITAL_COLOR_VAR.nibp }}
              strokeWidth={selected ? 3 : 2}
              strokeDasharray={measurement.systolic === null || measurement.diastolic === null ? "4 3" : undefined}
              data-testid="series-nibp"
            />
            <line x1={cx - 6} y1={ySys} x2={cx + 6} y2={ySys} style={{ stroke: VITAL_COLOR_VAR.nibp }} strokeWidth={2} />
            <line x1={cx - 6} y1={yDia} x2={cx + 6} y2={yDia} style={{ stroke: VITAL_COLOR_VAR.nibp }} strokeWidth={2} />
            <MeasurementHit
              cx={cx}
              cy={yMean}
              ariaLabel={ariaLabel}
              testId={`point-nibp-${measurement.id}`}
              onTap={() => ctx.onPointTap(measurement)}
            >
              <circle
                cx={cx}
                cy={yMean}
                r={selected ? 6 : 5}
                fill="var(--vital-nibp-dark)"
                stroke="#ffffff"
                strokeWidth={1.5}
              />
            </MeasurementHit>
          </g>
        );
      })}
    </g>
  );
}

// Die kleinen Endpunkt-Griffe liegen oberhalb der allgemeinen Plot-Hit-Area.
// Dadurch bleiben leere Plotbereiche weiterhin präzise anklickbar.
export function NibpHandleLayer({ measurements, ctx, onUpdate, onEdit }: HandleLayerProps) {
  return (
    <g data-testid="nibp-handles">
      {measurements.map((measurement) => (
        <NibpHandles key={measurement.id} measurement={measurement} ctx={ctx} onUpdate={onUpdate} onEdit={onEdit} />
      ))}
    </g>
  );
}

function NibpHandles({
  measurement,
  ctx,
  onUpdate,
  onEdit,
}: {
  measurement: NibpMeasurement;
  ctx: BandContext;
  onUpdate: HandleLayerProps["onUpdate"];
  onEdit: HandleLayerProps["onEdit"];
}) {
  const [preview, setPreview] = useState<{ part: NibpPart; value: number } | null>(null);
  const [meanPreview, setMeanPreview] = useState<{ mode: "time" | "mean"; time: number; mean: number } | null>(null);
  const meanPreviewRef = useRef<typeof meanPreview>(null);
  const meanDrag = useRef({ active: false, pointerId: -1, startX: 0, startY: 0, mode: null as "time" | "mean" | null });
  // Snapshot aller drei Werte beim Drag-Start. Nicht gezogene Werte werden nie
  // neu berechnet, sondern unveraendert aus diesem Snapshot uebernommen.
  const dragSnapshot = useRef<NibpTriple | null>(null);
  const [active, setActive] = useState(false);
  const shownTime = meanPreview?.time ?? measurement.time;
  const shownMean = meanPreview?.mean ?? measurement.mean;
  const cx = timeToX(ctx.xScale, shownTime);
  const yScale = ctx.yScales.nibp;
  const shownSystolic = preview?.part === "systolic" ? preview.value : measurement.systolic;
  const shownDiastolic = preview?.part === "diastolic" ? preview.value : measurement.diastolic;
  const shownMeasurement = { ...measurement, time: shownTime, mean: shownMean, systolic: shownSystolic, diastolic: shownDiastolic };
  const yMean = yScale(shownMean);
  const ySys = endpointY(shownMeasurement, "systolic", ctx);
  const yDia = endpointY(shownMeasurement, "diastolic", ctx);
  // Trefferradien duerfen nie einen Nachbargriff verdecken: hoechstens der halbe
  // Abstand zum naechsten Griff. So bleibt auf dem iPad der beabsichtigte Griff
  // waehlbar, auch wenn die Werte dicht beieinander liegen.
  const rSys = nonOverlappingRadius(ySys, [yMean], 9, 4);
  const rDia = nonOverlappingRadius(yDia, [yMean], 9, 4);
  const rMean = nonOverlappingRadius(yMean, [ySys, yDia], 10, 5);
  const tooltipX = cx > ctx.layout.plotRight - 252 ? cx - 246 : cx + 12;
  const tooltipY = clampValue(yScale(shownMean) - 48, ctx.layout.bandByKind.nibp.top + 3, ctx.layout.bandByKind.nibp.bottom - 45);

  const snapshot = (): NibpTriple => ({ systolic: measurement.systolic, mean: measurement.mean, diastolic: measurement.diastolic });

  const updateMeanPreview = (event: ReactPointerEvent<SVGCircleElement>) => {
    const state = meanDrag.current;
    if (!state.active || state.pointerId !== event.pointerId) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (!state.mode && Math.hypot(dx, dy) >= POINTER_MOVE_THRESHOLD_PX.touch) {
      state.mode = Math.abs(dx) >= Math.abs(dy) ? "time" : "mean";
    }
    if (!state.mode) return;
    // getScreenCTM-basierte Umrechnung: robust gegen Safari-Zoom, Seiten-Scroll
    // und responsive SVG-Skalierung – kein „Springen“ beim Ziehen.
    const svg = event.currentTarget.ownerSVGElement;
    const point = clientToSvgPoint(svg, event.clientX, event.clientY);
    const base = dragSnapshot.current ?? snapshot();
    if (state.mode === "time") {
      const x = clampValue(point.x, ctx.layout.plotLeft, ctx.layout.plotRight);
      const time = Math.round(clampValue(xToTime(ctx.xScale, x), ctx.startedAt, ctx.now));
      const next = { mode: "time" as const, time, mean: base.mean };
      meanPreviewRef.current = next;
      setMeanPreview(next);
    } else {
      const [min, max] = yScale.domain();
      // Nur das Mittel folgt dem Pointer; Systolisch und Diastolisch begrenzen es.
      const { mean } = applyNibpDrag(base, "mean", yScale.invert(point.y), min, max);
      const next = { mode: "mean" as const, time: measurement.time, mean };
      meanPreviewRef.current = next;
      setMeanPreview(next);
    }
    setActive(true);
  };

  const finishMeanDrag = (event: ReactPointerEvent<SVGCircleElement>) => {
    const state = meanDrag.current;
    if (!state.active || state.pointerId !== event.pointerId) return;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
    const latestPreview = meanPreviewRef.current;
    const base = dragSnapshot.current ?? snapshot();
    if (latestPreview) {
      // Nur Zeit bzw. Mittel aendern; Systolisch und Diastolisch aus dem Snapshot.
      onUpdate(measurement.id, latestPreview.time, base.systolic, latestPreview.mean, base.diastolic);
    } else {
      ctx.onPointTap(measurement);
    }
    meanDrag.current = { active: false, pointerId: -1, startX: 0, startY: 0, mode: null };
    meanPreviewRef.current = null;
    dragSnapshot.current = null;
    setMeanPreview(null);
  };

  const previewFromPointer = (part: NibpPart, event: ReactPointerEvent<Element>) => {
    const owner = event.currentTarget as SVGGraphicsElement;
    const point = clientToSvgPoint(owner.ownerSVGElement, event.clientX, event.clientY);
    const base = dragSnapshot.current ?? snapshot();
    const [scaleMin, scaleMax] = yScale.domain();
    const raw = yScale.invert(point.y);
    const next = applyNibpDrag(base, part, raw, scaleMin, scaleMax);
    setActive(true);
    setPreview({ part, value: (part === "systolic" ? next.systolic : next.diastolic) as number });
  };

  const commit = (part: NibpPart) => {
    if (!preview || preview.part !== part) { dragSnapshot.current = null; return; }
    const base = dragSnapshot.current ?? snapshot();
    onUpdate(
      measurement.id,
      measurement.time,
      part === "systolic" ? preview.value : base.systolic,
      base.mean,
      part === "diastolic" ? preview.value : base.diastolic,
    );
    setPreview(null);
    dragSnapshot.current = null;
  };

  return (
    <g onPointerEnter={() => setActive(true)} onPointerLeave={() => { if (!preview && !meanPreview) setActive(false); }}>
      <NibpHandle
        part="systolic"
        cx={cx}
        cy={ySys}
        radius={rSys}
        configured={shownSystolic !== null}
        onDragStart={(event) => { dragSnapshot.current = snapshot(); previewFromPointer("systolic", event); }}
        onPreview={(event) => previewFromPointer("systolic", event)}
        onCommit={() => commit("systolic")}
        onCancel={() => { setPreview(null); dragSnapshot.current = null; }}
        onTap={() => onEdit(measurement, "systolic")}
      />
      <NibpHandle
        part="diastolic"
        cx={cx}
        cy={yDia}
        radius={rDia}
        configured={shownDiastolic !== null}
        onDragStart={(event) => { dragSnapshot.current = snapshot(); previewFromPointer("diastolic", event); }}
        onPreview={(event) => previewFromPointer("diastolic", event)}
        onCommit={() => commit("diastolic")}
        onCancel={() => { setPreview(null); dragSnapshot.current = null; }}
        onTap={() => onEdit(measurement, "diastolic")}
      />
      <circle
        cx={cx}
        cy={yMean}
        r={rMean}
        fill="transparent"
        role="button"
        tabIndex={0}
        aria-label="Mittelwert bearbeiten oder horizontal in der Zeit verschieben"
        data-testid={`nibp-time-handle-${measurement.id}`}
        style={{ touchAction: "none", cursor: meanPreview?.mode === "time" ? "ew-resize" : "move" }}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          meanDrag.current = { active: true, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, mode: null };
          dragSnapshot.current = snapshot();
          try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* ignore */ }
          setActive(true);
        }}
        onPointerMove={updateMeanPreview}
        onPointerUp={finishMeanDrag}
        onLostPointerCapture={finishMeanDrag}
        onPointerCancel={(event) => {
          if (meanDrag.current.pointerId !== event.pointerId) return;
          meanDrag.current = { active: false, pointerId: -1, startX: 0, startY: 0, mode: null };
          meanPreviewRef.current = null;
          dragSnapshot.current = null;
          setMeanPreview(null);
          setActive(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            ctx.onPointTap(measurement);
          }
        }}
      />
      {meanPreview ? <circle cx={cx} cy={yScale(shownMean)} r={6} className="nibp-mean-drag-preview" pointerEvents="none" /> : null}
      {active || preview ? (
        <g pointerEvents="none" data-testid={`nibp-values-${measurement.id}`}>
          <rect x={tooltipX} y={tooltipY} width={240} height={42} rx={6} className="nibp-value-tooltip" />
          <text x={tooltipX + 8} y={tooltipY + 15} className="nibp-value-tooltip__values">
            S {shownSystolic ?? "–"} · M {shownMean} · D {shownDiastolic ?? "–"}
          </text>
          <text x={tooltipX + 8} y={tooltipY + 29} className="nibp-value-tooltip__unit">mmHg · {formatClock(shownTime)}{differentLocalDate(measurement.time, shownTime) ? ` · ${formatLocalDate(shownTime)}` : ""}</text>
          <text x={tooltipX + 8} y={tooltipY + 39} className="nibp-value-tooltip__unit">Horizontal: Zeit · Vertikal: Mittel</text>
        </g>
      ) : null}
    </g>
  );
}

function differentLocalDate(left: number, right: number): boolean {
  const a = new Date(left);
  const b = new Date(right);
  return a.getFullYear() !== b.getFullYear() || a.getMonth() !== b.getMonth() || a.getDate() !== b.getDate();
}

function formatLocalDate(timestamp: number): string {
  return new Intl.DateTimeFormat("de-DE").format(timestamp);
}

function NibpHandle({
  part,
  cx,
  cy,
  radius,
  configured,
  onDragStart,
  onPreview,
  onCommit,
  onCancel,
  onTap,
}: {
  part: NibpPart;
  cx: number;
  cy: number;
  radius: number;
  configured: boolean;
  onDragStart: (event: ReactPointerEvent<Element>) => void;
  onPreview: (event: ReactPointerEvent<Element>) => void;
  onCommit: () => void;
  onCancel: () => void;
  onTap: () => void;
}) {
  const gesture = usePointerGesture({
    capture: true,
    threshold: POINTER_MOVE_THRESHOLD_PX.pen,
    onTap,
    onDragStart,
    onDragMove: onPreview,
    onDragEnd: onCommit,
    onCancel,
  });
  const label = part === "systolic" ? "Systolisch" : "Diastolisch";
  return (
    <g data-testid={`nibp-handle-${part}`}>
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="transparent"
        role="button"
        tabIndex={0}
        aria-label={`${label} bearbeiten oder ziehen`}
        style={{ touchAction: "none", cursor: "ns-resize" }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onTap();
          }
        }}
        {...gesture}
      />
      <circle cx={cx} cy={cy} r={4.5} className={`nibp-handle ${configured ? "" : "nibp-handle--unset"}`} pointerEvents="none" />
    </g>
  );
}
