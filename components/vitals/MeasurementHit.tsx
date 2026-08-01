"use client";

import type { ReactNode } from "react";

interface Props {
  cx: number;
  cy: number;
  ariaLabel: string;
  testId?: string;
  onTap: () => void;
  children: ReactNode;
}

// Sichtbarer Marker + unsichtbare, mindestens 44x44 px grosse, fokussierbare
// Hit-Area. Tap oeffnet die Bearbeitung; Ziehen passt den Wert an (Live-Preview).
export function MeasurementHit({
  cx,
  cy,
  ariaLabel,
  testId,
  onTap,
  children,
}: Props) {
  return (
    <g>
      {children}
      <rect
        x={cx - 0.5}
        y={cy - 0.5}
        width={1}
        height={1}
        fill="transparent"
        className="vital-hit"
        data-testid={testId}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        pointerEvents="none"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onTap();
          }
        }}
      />
    </g>
  );
}
