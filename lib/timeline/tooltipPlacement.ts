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

// Reine Überlappungsfläche zweier Rechtecke (0, wenn disjunkt).
export function tooltipOverlapArea(a: TooltipRect, b: TooltipRect): number {
  const dx = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const dy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return dx > 0 && dy > 0 ? dx * dy : 0;
}

/**
 * Platziert einen Tooltip so, dass er mehrere Hindernisse (z. B. Koordinaten-Tooltip
 * UND Warn-Ausrufezeichen) meidet. Reihenfolge der Kandidaten: rechts-oben, dann nach
 * links kippen (§7.1), dann vertikaler Versatz (§7.2). Immer innerhalb der Grenzen
 * (kein Viewport-Overflow, §7.5). Findet sich keine überlappungsfreie Position, wird
 * die mit der geringsten Überlappung gewählt.
 */
export function placeTooltipAvoidingAll(
  pointer: { x: number; y: number },
  size: { width: number; height: number },
  bounds: TooltipBounds,
  avoid: TooltipRect[] = [],
  gap = 12,
): TooltipRect {
  const rightX = pointer.x + gap;
  const leftX = pointer.x - size.width - gap;
  // Erst nahe am Zeiger: rechts-oben, dann links kippen (§7.1), dann vertikaler Versatz (§7.2).
  const positions = [
    { x: rightX, y: pointer.y - size.height - gap },
    { x: leftX, y: pointer.y - size.height - gap },
    { x: rightX, y: pointer.y + gap },
    { x: leftX, y: pointer.y + gap },
    { x: rightX, y: pointer.y - size.height / 2 },
    { x: leftX, y: pointer.y - size.height / 2 },
  ];
  // Reserve: direkt ober-/unterhalb jedes Hindernisses (klärt auch hohe Icons in
  // der Ecke, wo horizontal kein Platz bleibt).
  for (const rect of avoid) {
    const above = rect.y - size.height - gap;
    const below = rect.y + rect.height + gap;
    positions.push(
      { x: rightX, y: above },
      { x: leftX, y: above },
      { x: rightX, y: below },
      { x: leftX, y: below },
    );
  }
  const candidates = positions.map((position) => clampRect({ ...position, ...size }, bounds));
  // Abstand des Zeigers zum naechstgelegenen Punkt des Rechtecks (0 = innerhalb).
  const distanceToPointer = (rect: TooltipRect) => {
    const dx = Math.max(rect.x - pointer.x, 0, pointer.x - (rect.x + rect.width));
    const dy = Math.max(rect.y - pointer.y, 0, pointer.y - (rect.y + rect.height));
    return Math.hypot(dx, dy);
  };
  let best = candidates[0];
  let bestOverlap = Number.POSITIVE_INFINITY;
  let nearest: TooltipRect | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    let overlap = 0;
    for (const rect of avoid) overlap += tooltipOverlapArea(candidate, rect);
    if (overlap === 0) {
      // Unter allen kollisionsfreien Positionen die dem Zeiger naechste waehlen,
      // damit die Information direkt beim Stift steht und nicht weit entfernt.
      const distance = distanceToPointer(candidate);
      if (distance < nearestDistance) {
        nearest = candidate;
        nearestDistance = distance;
      }
      continue;
    }
    if (overlap < bestOverlap) {
      best = candidate;
      bestOverlap = overlap;
    }
  }
  return nearest ?? best;
}
