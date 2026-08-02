"use client";

import { useState } from "react";
import { formatClock } from "../../lib/timeline/format";
import { checkpointTooltip, type VitalCheckpointWarning } from "../../lib/timeline/checkpoints";
import { timeToX, type XScale } from "../../lib/timeline/scales";
import type { TimelineLayout } from "../../lib/timeline/geometry";
import type { VitalKind } from "../../types/vitals";

interface Props {
  warnings: VitalCheckpointWarning[];
  layout: TimelineLayout;
  xScale: XScale;
  selectedTime: number | null;
  onSelectTime: (time: number) => void;
  onOpenBand: (kind: VitalKind, time: number, clientY?: number) => void;
}

export function CheckpointWarningLayer({ warnings, layout, xScale, selectedTime, onSelectTime, onOpenBand }: Props) {
  const [tooltipTime, setTooltipTime] = useState<number | null>(null);
  const projected = warnings.map((warning) => timeToX(xScale, warning.time));
  const minimumGap = projected.length > 1
    ? Math.min(...projected.slice(1).map((x, index) => x - projected[index]))
    : Number.POSITIVE_INFINITY;
  const dense = minimumGap < 12;
  const iconSize = dense ? Math.max(4, Math.min(7, minimumGap * 0.8)) : 22;
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
                x={x - 5}
                y={band.top}
                width={10}
                height={band.height}
                fill="transparent"
                role="button"
                tabIndex={0}
                aria-label={`${formatClock(warning.time)}: ${band.kind} nachtragen`}
                data-testid={`checkpoint-band-${band.kind}-${warning.time}`}
                className="checkpoint-band-hit"
                onClick={(event) => { event.stopPropagation(); onOpenBand(band.kind, warning.time, event.clientY); }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpenBand(band.kind, warning.time);
                  }
                }}
              />
            ))}
            <foreignObject x={x - iconSize / 2} y={layout.plotBottom + (dense ? 34 : 27)} width={iconSize} height={iconSize}>
              <button
                type="button"
                className={`checkpoint-warning-button ${dense ? "checkpoint-warning-button--dense" : ""}`}
                aria-label={`${formatClock(warning.time)}. ${tooltip}`}
                title={tooltip}
                data-testid={`checkpoint-warning-${warning.time}`}
                style={{ width: iconSize, height: iconSize }}
                onMouseEnter={() => setTooltipTime(warning.time)}
                onMouseLeave={() => setTooltipTime(null)}
                onFocus={() => setTooltipTime(warning.time)}
                onBlur={() => setTooltipTime(null)}
                onPointerDown={() => setTooltipTime(warning.time)}
                onClick={(event) => { event.stopPropagation(); onSelectTime(warning.time); }}
              >!</button>
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
