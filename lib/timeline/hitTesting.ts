import { HIT_RADIUS_PX } from "./config";

export type HitTarget =
  | { id: string; shape: "point"; x: number; y: number }
  | { id: string; shape: "nibp"; x: number; y1: number; y2: number; meanY: number };

export interface HitTestPoint {
  x: number;
  y: number;
}

function pointDistance(a: HitTestPoint, b: HitTestPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function segmentDistance(point: HitTestPoint, target: Extract<HitTarget, { shape: "nibp" }>): number {
  const top = Math.min(target.y1, target.y2);
  const bottom = Math.max(target.y1, target.y2);
  const nearestY = Math.min(bottom, Math.max(top, point.y));
  return Math.min(
    Math.hypot(point.x - target.x, point.y - nearestY),
    pointDistance(point, { x: target.x, y: target.meanY }),
  );
}

export function hitRadius(pointerType: string): number {
  if (pointerType === "touch") return HIT_RADIUS_PX.touch;
  if (pointerType === "pen") return HIT_RADIUS_PX.pen;
  return HIT_RADIUS_PX.mouse;
}

export function distanceToHitTarget(point: HitTestPoint, target: HitTarget): number {
  return target.shape === "point" ? pointDistance(point, target) : segmentDistance(point, target);
}

export function findNearestHit(
  point: HitTestPoint,
  targets: HitTarget[],
  pointerType: string,
): { id: string; distance: number } | null {
  const tolerance = hitRadius(pointerType);
  let nearest: { id: string; distance: number } | null = null;
  for (const target of targets) {
    const distance = distanceToHitTarget(point, target);
    if (distance <= tolerance && (!nearest || distance < nearest.distance)) {
      nearest = { id: target.id, distance };
    }
  }
  return nearest;
}
