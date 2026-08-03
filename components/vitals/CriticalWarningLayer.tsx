"use client";

import type { TimelineLayout } from "../../lib/timeline/geometry";
import { timeToX, type XScale, type YScale } from "../../lib/timeline/scales";
import type { CriticalWarning } from "../../lib/timeline/criticalValues";
import type { Measurement, VitalKind } from "../../types/vitals";
import { MIN_INTERACTIVE_TARGET_PX } from "../../lib/timeline/config";

export function CriticalWarningLayer({ warnings, measurements, layout, xScale, yScales }: {
  warnings: CriticalWarning[];
  measurements: Measurement[];
  layout: TimelineLayout;
  xScale: XScale;
  yScales: Record<VitalKind, YScale>;
}) {
  return (
    <g data-testid="critical-warning-layer">
      {warnings.map((warning) => {
        const measurement = measurements.find((item) => item.id === warning.measurementId);
        if (!measurement) return null;
        const value = measurement.kind === "nibp" ? measurement.mean : measurement.value;
        const markerX = timeToX(xScale, measurement.time);
        if (markerX < layout.plotLeft || markerX > layout.plotRight) return null;
        const markerY = yScales[measurement.kind](value);
        const x = Math.min(layout.plotRight - MIN_INTERACTIVE_TARGET_PX, markerX + 7);
        const y = Math.max(layout.bandByKind[measurement.kind].top + 2, markerY - 25);
        return (
          <g key={warning.measurementId}>
            <foreignObject x={x} y={y} width={MIN_INTERACTIVE_TARGET_PX} height={MIN_INTERACTIVE_TARGET_PX}>
              <button
                type="button"
                className="critical-warning-button"
                aria-label={`Kritischer Hinweis für ${warning.kind}. ${warning.tooltip.replace(/\n/g, " ")}`}
                title={warning.tooltip}
                data-testid={`critical-warning-${warning.measurementId}`}
              >
                <span aria-hidden className="critical-warning-icon">⚠</span>
              </button>
            </foreignObject>
          </g>
        );
      })}
    </g>
  );
}
