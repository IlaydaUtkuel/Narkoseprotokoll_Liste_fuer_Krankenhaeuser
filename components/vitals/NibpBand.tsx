"use client";

import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { VITAL_COLOR_VAR } from "../../lib/timeline/config";
import { formatClock } from "../../lib/timeline/format";
import { clampValue, roundToPrecision } from "../../lib/timeline/measurementUtils";
import { timeToX } from "../../lib/timeline/scales";
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
  const [active, setActive] = useState(false);
  const cx = timeToX(ctx.xScale, measurement.time);
  const yScale = ctx.yScales.nibp;
  const shownSystolic = preview?.part === "systolic" ? preview.value : measurement.systolic;
  const shownDiastolic = preview?.part === "diastolic" ? preview.value : measurement.diastolic;
  const shownMeasurement = { ...measurement, systolic: shownSystolic, diastolic: shownDiastolic };
  const ySys = endpointY(shownMeasurement, "systolic", ctx);
  const yDia = endpointY(shownMeasurement, "diastolic", ctx);
  const tooltipX = cx > ctx.layout.plotRight - 252 ? cx - 246 : cx + 12;
  const tooltipY = clampValue(yScale(measurement.mean) - 42, ctx.layout.bandByKind.nibp.top + 3, ctx.layout.bandByKind.nibp.bottom - 39);

  const valueFromPointer = (part: NibpPart, event: ReactPointerEvent<Element>) => {
    const owner = event.currentTarget as SVGGraphicsElement;
    const rect = owner.ownerSVGElement?.getBoundingClientRect();
    if (!rect) return measurement.mean;
    const raw = yScale.invert(event.clientY - rect.top);
    const [scaleMin, scaleMax] = yScale.domain();
    const min = part === "systolic" ? measurement.mean : scaleMin;
    const max = part === "systolic" ? scaleMax : measurement.mean;
    return roundToPrecision(clampValue(raw, min, max), 0);
  };

  const commit = (part: NibpPart) => {
    if (!preview || preview.part !== part) return;
    onUpdate(
      measurement.id,
      measurement.time,
      part === "systolic" ? preview.value : measurement.systolic,
      measurement.mean,
      part === "diastolic" ? preview.value : measurement.diastolic,
    );
    setPreview(null);
  };

  return (
    <g onPointerEnter={() => setActive(true)} onPointerLeave={() => { if (!preview) setActive(false); }}>
      <NibpHandle
        part="systolic"
        cx={cx}
        cy={ySys}
        configured={shownSystolic !== null}
        onPreview={(event) => { setActive(true); setPreview({ part: "systolic", value: valueFromPointer("systolic", event) }); }}
        onCommit={() => commit("systolic")}
        onCancel={() => setPreview(null)}
        onTap={() => onEdit(measurement, "systolic")}
      />
      <NibpHandle
        part="diastolic"
        cx={cx}
        cy={yDia}
        configured={shownDiastolic !== null}
        onPreview={(event) => { setActive(true); setPreview({ part: "diastolic", value: valueFromPointer("diastolic", event) }); }}
        onCommit={() => commit("diastolic")}
        onCancel={() => setPreview(null)}
        onTap={() => onEdit(measurement, "diastolic")}
      />
      {active || preview ? (
        <g pointerEvents="none" data-testid={`nibp-values-${measurement.id}`}>
          <rect x={tooltipX} y={tooltipY} width={240} height={36} rx={6} className="nibp-value-tooltip" />
          <text x={tooltipX + 8} y={tooltipY + 15} className="nibp-value-tooltip__values">
            S {shownSystolic ?? "–"} · M {measurement.mean} · D {shownDiastolic ?? "–"}
          </text>
          <text x={tooltipX + 8} y={tooltipY + 29} className="nibp-value-tooltip__unit">mmHg · Klicken zum Eingeben · Ziehen</text>
        </g>
      ) : null}
    </g>
  );
}

function NibpHandle({
  part,
  cx,
  cy,
  configured,
  onPreview,
  onCommit,
  onCancel,
  onTap,
}: {
  part: NibpPart;
  cx: number;
  cy: number;
  configured: boolean;
  onPreview: (event: ReactPointerEvent<Element>) => void;
  onCommit: () => void;
  onCancel: () => void;
  onTap: () => void;
}) {
  const gesture = usePointerGesture({
    capture: true,
    threshold: 3,
    onTap,
    onDragStart: onPreview,
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
        r={9}
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
