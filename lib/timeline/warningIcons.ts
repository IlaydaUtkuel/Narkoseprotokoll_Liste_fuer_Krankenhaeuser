import { MIN_INTERACTIVE_TARGET_PX } from "./config";
import { placeTooltipAvoidingAll, type TooltipBounds, type TooltipRect } from "./tooltipPlacement";

/**
 * Reine Geometrie der Warn-Ausrufezeichen. Dieselben Funktionen positionieren die
 * sichtbaren Icons (CriticalWarningLayer/CheckpointWarningLayer) UND liefern die
 * Kollisions-Boxen für die Tooltip-Platzierung – so bleiben Darstellung und
 * Kollisionsvermeidung garantiert deckungsgleich (echte Bounding-Box, §6).
 */

// Kritisches Icon: rechts neben dem Messpunkt, innerhalb des Bandes, nie über den
// rechten Plotrand hinaus.
export function criticalIconRect(
  markerX: number,
  markerY: number,
  bandTop: number,
  plotRight: number,
  size: number = MIN_INTERACTIVE_TARGET_PX,
): TooltipRect {
  return {
    x: Math.min(plotRight - size, markerX + 7),
    y: Math.max(bandTop + 2, markerY - 25),
    width: size,
    height: size,
  };
}

/** Quadratische Belegtfläche rund um einen bedienbaren Messpunkt/Griff. */
export function occupiedSpot(x: number, y: number, size = 26): TooltipRect {
  return { x: x - size / 2, y: y - size / 2, width: size, height: size };
}

/**
 * Platziert das kritische Warnsymbol so, dass es KEINEN bedienbaren Messpunkt und
 * keinen NiBP-Griff überdeckt. Sonst ließe sich z. B. der Systolisch-Griff nicht
 * mehr antippen, weil das Ausrufezeichen darüber liegt. Bevorzugt wird die Position
 * dicht beim auslösenden Messwert; nur bei Kollision weicht das Symbol aus.
 */
export function placeCriticalIcon(
  marker: { x: number; y: number },
  occupied: TooltipRect[],
  bounds: TooltipBounds,
  size: number = MIN_INTERACTIVE_TARGET_PX,
): TooltipRect {
  return placeTooltipAvoidingAll(marker, { width: size, height: size }, bounds, occupied, 10);
}

// Checkpoint-Ausrufezeichen: mittig unter der Kontrollzeit, unterhalb des Plots.
export function checkpointIconRect(
  centerX: number,
  plotBottom: number,
  size: number = MIN_INTERACTIVE_TARGET_PX,
): TooltipRect {
  return {
    x: centerX - size / 2,
    y: plotBottom + 8,
    width: size,
    height: size,
  };
}
