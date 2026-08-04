"use client";

import type { TimelineLayout } from "../../lib/timeline/geometry";
import { timeToX, type XScale, type YScale } from "../../lib/timeline/scales";
import type { CriticalWarning } from "../../lib/timeline/criticalValues";
import type { Measurement, VitalKind } from "../../types/vitals";
import { criticalIconRect } from "../../lib/timeline/warningIcons";
import type { TooltipRect } from "../../lib/timeline/tooltipPlacement";

export function CriticalWarningLayer({ warnings, measurements, layout, xScale, yScales, iconRects }: {
  warnings: CriticalWarning[];
  measurements: Measurement[];
  layout: TimelineLayout;
  xScale: XScale;
  yScales: Record<VitalKind, YScale>;
  /** Vorab kollisionsfrei berechnete Position je Warnsymbol (siehe VitalTimeline). */
  iconRects?: Record<string, TooltipRect>;
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
        const iconRect = iconRects?.[warning.measurementId]
          ?? criticalIconRect(markerX, markerY, layout.bandByKind[measurement.kind].top, layout.plotRight);
        return (
          <g key={warning.measurementId}>
            <foreignObject x={iconRect.x} y={iconRect.y} width={iconRect.width} height={iconRect.height}>
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
