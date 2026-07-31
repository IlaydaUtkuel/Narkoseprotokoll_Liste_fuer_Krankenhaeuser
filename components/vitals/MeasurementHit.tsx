"use client";

import type { ReactNode } from "react";
import { usePointerGesture } from "../../hooks/useTimelinePointer";

interface Props {
  cx: number;
  cy: number;
  size?: number;
  ariaLabel: string;
  testId?: string;
  onTap: () => void;
  onDragStart?: (clientX: number, clientY: number) => void;
  onDragMove?: (clientX: number, clientY: number) => void;
  onDragEnd?: () => void;
  onDragCancel?: () => void;
  children: ReactNode;
}

// Sichtbarer Marker + unsichtbare, mindestens 44x44 px grosse, fokussierbare
// Hit-Area. Tap oeffnet die Bearbeitung; Ziehen passt den Wert an (Live-Preview).
export function MeasurementHit({
  cx,
  cy,
  size = 44,
  ariaLabel,
  testId,
  onTap,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  children,
}: Props) {
  const gesture = usePointerGesture({
    capture: true,
    onTap: () => onTap(),
    onDragStart: (e) => onDragStart?.(e.clientX, e.clientY),
    onDragMove: (e) => onDragMove?.(e.clientX, e.clientY),
    onDragEnd: () => onDragEnd?.(),
    onCancel: () => onDragCancel?.(),
  });
  const half = size / 2;

  return (
    <g>
      {children}
      <rect
        x={cx - half}
        y={cy - half}
        width={size}
        height={size}
        fill="transparent"
        className="vital-hit"
        data-testid={testId}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        style={{ touchAction: "none", cursor: "pointer" }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onTap();
          }
        }}
        {...gesture}
      />
    </g>
  );
}
