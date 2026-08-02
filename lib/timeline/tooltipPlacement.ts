export interface TooltipRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TooltipBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function tooltipRectsOverlap(a: TooltipRect, b: TooltipRect, gap = 4): boolean {
  return !(
    a.x + a.width + gap <= b.x ||
    b.x + b.width + gap <= a.x ||
    a.y + a.height + gap <= b.y ||
    b.y + b.height + gap <= a.y
  );
}

function clampRect(rect: TooltipRect, bounds: TooltipBounds): TooltipRect {
  return {
    ...rect,
    x: Math.max(bounds.left, Math.min(rect.x, bounds.right - rect.width)),
    y: Math.max(bounds.top, Math.min(rect.y, bounds.bottom - rect.height)),
  };
}

export function placeTooltipAvoiding(
  pointer: { x: number; y: number },
  size: { width: number; height: number },
  bounds: TooltipBounds,
  avoid?: TooltipRect | null,
): TooltipRect {
  const gap = 12;
  const candidates = [
    { x: pointer.x + gap, y: pointer.y - size.height - gap },
    { x: pointer.x - size.width - gap, y: pointer.y - size.height - gap },
    { x: pointer.x + gap, y: pointer.y + gap },
    { x: pointer.x - size.width - gap, y: pointer.y + gap },
  ].map((position) => clampRect({ ...position, ...size }, bounds));
  return candidates.find((candidate) => !avoid || !tooltipRectsOverlap(candidate, avoid)) ?? candidates[0];
}
