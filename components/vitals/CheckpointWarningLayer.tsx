"use client";

import { useState } from "react";
import { formatClock } from "../../lib/timeline/format";
import { checkpointTooltip, nearestCheckpointTime, type VitalCheckpointWarning } from "../../lib/timeline/checkpoints";
import { MIN_INTERACTIVE_TARGET_PX } from "../../lib/timeline/config";
import { checkpointIconRect } from "../../lib/timeline/warningIcons";
import { timeToX, type XScale } from "../../lib/timeline/scales";
import type { TimelineLayout } from "../../lib/timeline/geometry";
import type { VitalKind } from "../../types/vitals";

interface Props {
  warnings: VitalCheckpointWarning[];
  layout: TimelineLayout;
  xScale: XScale;
  selectedTime: number | null;
  interactionDisabled?: boolean;
  // Zeit des aktiven Checkpoint-Modus (null = normaler Modus).
  checkpointModeTime?: number | null;
  // Tippen auf das Ausrufezeichen schaltet den Checkpoint-Modus für diese Zeit um.
  onToggleMode: (time: number) => void;
  onOpenBand: (kind: VitalKind, time: number, clientY?: number) => void;
}

export function CheckpointWarningLayer({ warnings, layout, xScale, selectedTime, interactionDisabled = false, checkpointModeTime = null, onToggleMode, onOpenBand }: Props) {
  const [tooltipTime, setTooltipTime] = useState<number | null>(null);
  const projected = warnings.map((warning) => timeToX(xScale, warning.time));
  const minimumGap = projected.length > 1
    ? Math.min(...projected.slice(1).map((x, index) => x - projected[index]))
    : Number.POSITIVE_INFINITY;
  const dense = minimumGap < 12;
  const iconSize = dense ? Math.max(10, Math.min(14, minimumGap * 0.9)) : 22;
  const nearestTimeAtClientX = (clientX: number, svg: SVGSVGElement | null) => {
    if (!svg) return null;
    return nearestCheckpointTime(warnings, projected, clientX - svg.getBoundingClientRect().left);
  };
  return (
    <g data-testid="checkpoint-warnings">
      {warnings.map((warning) => {
        const x = timeToX(xScale, warning.time);
        if (x < layout.plotLeft || x > layout.plotRight) return null;
        const tooltip = checkpointTooltip(warning);
        return (
          <g key={warning.time}>
            <line
              x1={x}
              y1={layout.plotTop}
              x2={x}
              y2={layout.plotBottom}
              className="checkpoint-warning-line"
              strokeWidth={dense ? 0.55 : 1.25}
              strokeDasharray={dense ? "none" : "4 4"}
              opacity={dense ? 0.16 : 0.82}
              pointerEvents="none"
              data-testid={`checkpoint-line-${warning.time}`}
            />
            {layout.bands.map((band) => (
              <rect
                key={band.kind}
                x={x - MIN_INTERACTIVE_TARGET_PX / 2}
                y={band.top}
                width={MIN_INTERACTIVE_TARGET_PX}
                height={band.height}
                fill="transparent"
                // Im Checkpoint-Modus übernimmt die darunterliegende Plot-Fläche die
                // direkte Y-Eingabe; die Band-Trefferfläche gibt Pointer-Events frei.
                pointerEvents={interactionDisabled || checkpointModeTime !== null ? "none" : undefined}
                role="button"
                tabIndex={interactionDisabled || checkpointModeTime !== null ? -1 : 0}
                aria-label={`${formatClock(warning.time)}: ${band.kind} nachtragen`}
                data-testid={`checkpoint-band-${band.kind}-${warning.time}`}
                className="checkpoint-band-hit"
                onClick={(event) => {
                  event.stopPropagation();
                  const nearest = nearestTimeAtClientX(event.clientX, event.currentTarget.closest("svg") as SVGSVGElement | null);
                  if (nearest !== null) onOpenBand(band.kind, nearest, event.clientY);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpenBand(band.kind, warning.time);
                  }
                }}
              />
            ))}
            <foreignObject
              x={checkpointIconRect(x, layout.plotBottom).x}
              y={checkpointIconRect(x, layout.plotBottom).y}
              width={MIN_INTERACTIVE_TARGET_PX}
              height={MIN_INTERACTIVE_TARGET_PX}
              pointerEvents={interactionDisabled ? "none" : undefined}
            >
              <button
                type="button"
                disabled={interactionDisabled}
                aria-pressed={checkpointModeTime === warning.time}
                className={`checkpoint-warning-button ${dense ? "checkpoint-warning-button--dense" : ""}`}
                aria-label={checkpointModeTime === warning.time
                  ? `Kontrollzeit ${formatClock(warning.time)} aktiv. Zum Beenden erneut tippen.`
                  : `${formatClock(warning.time)}. ${tooltip}. Zum direkten Nachtragen tippen.`}
                data-testid={`checkpoint-warning-${warning.time}`}
                style={{ width: MIN_INTERACTIVE_TARGET_PX, height: MIN_INTERACTIVE_TARGET_PX }}
                onMouseEnter={() => setTooltipTime(warning.time)}
                onMouseLeave={() => setTooltipTime(null)}
                onFocus={() => setTooltipTime(warning.time)}
                onBlur={() => setTooltipTime(null)}
                onPointerMove={(event) => {
                  const nearest = nearestTimeAtClientX(event.clientX, event.currentTarget.closest("svg") as SVGSVGElement | null);
                  if (nearest !== null) setTooltipTime(nearest);
                }}
                onPointerDown={(event) => {
                  const nearest = nearestTimeAtClientX(event.clientX, event.currentTarget.closest("svg") as SVGSVGElement | null);
                  setTooltipTime(nearest ?? warning.time);
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  const nearest = nearestTimeAtClientX(event.clientX, event.currentTarget.closest("svg") as SVGSVGElement | null);
                  onToggleMode(nearest ?? warning.time);
                }}
              >
                <span
                  aria-hidden
                  className="checkpoint-warning-icon"
                  style={{ width: iconSize, height: iconSize, fontSize: dense ? 0 : 13 }}
                >!</span>
              </button>
            </foreignObject>
            {tooltipTime === warning.time ? (
              <g pointerEvents="none">
                <rect x={Math.max(layout.plotLeft, Math.min(x - 135, layout.plotRight - 270))} y={layout.plotBottom - 49} width={270} height={42} rx={6} className="checkpoint-tooltip" />
                <text x={Math.max(layout.plotLeft, Math.min(x - 135, layout.plotRight - 270)) + 7} y={layout.plotBottom - 31} className="checkpoint-tooltip-text">
                  {warning.recordedBandCount === 0 ? "Hier wurde kein Wert eingetragen." : "Hier fehlen noch Vitalwerte."}
                </text>
                <text x={Math.max(layout.plotLeft, Math.min(x - 135, layout.plotRight - 270)) + 7} y={layout.plotBottom - 15} className="checkpoint-tooltip-detail">
                  {`Fehlend: ${warning.missing.map((item) => item.label).join(", ")}`}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}
      {selectedTime !== null ? (
        <g pointerEvents="none" data-testid="checkpoint-selection">
          <line x1={timeToX(xScale, selectedTime)} y1={layout.contentTop} x2={timeToX(xScale, selectedTime)} y2={layout.plotBottom} className="checkpoint-selection-line" />
          <rect x={Math.max(layout.plotLeft, Math.min(timeToX(xScale, selectedTime) + 7, layout.plotRight - 160))} y={layout.plotTop + 5} width={153} height={24} rx={5} className="checkpoint-selection-label" />
          <text x={Math.max(layout.plotLeft, Math.min(timeToX(xScale, selectedTime) + 7, layout.plotRight - 160)) + 7} y={layout.plotTop + 21} className="checkpoint-selection-text">Kontrollzeit {formatClock(selectedTime)}</text>
        </g>
      ) : null}
    </g>
  );
}
