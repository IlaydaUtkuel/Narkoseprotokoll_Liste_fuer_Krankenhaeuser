import {
  POINTER_MOVE_THRESHOLD_PX,
  PREVIEW_TTL_MS,
  SECOND_TAP_TOLERANCE_PX,
} from "./config";
import type { TimelineEventType, VitalKind } from "../../types/vitals";

/**
 * Gemeinsame, reine Logik der iPad-Zwei-Schritt-Interaktion. Erster Kontakt legt
 * eine fluechtige Vorschau ab (kein Formular, keine Persistenz), ein zweiter
 * Kontakt auf dieselbe Vorschau bestaetigt die Auswahl. Diese Funktionen kennen
 * kein DOM und sind vollstaendig unit-testbar.
 */

// Interaktionsband/-lane, in dem eine Vorschau lebt.
export type PreviewKind = "vital" | "medication" | "infusion" | "event";

export interface TimelinePreview {
  token: number;
  kind: PreviewKind;
  pointerType: string;
  band: VitalKind | null; // gesetzt bei kind === "vital"
  lane: "medication" | "infusion" | "event" | null;
  eventType: TimelineEventType | null; // gesetzt bei kind === "event"
  time: number;
  value: number | null; // Vital-Zeigerwert; null fuer Lanes/Ereignisse und NiBP
  unit: string | null;
  svgX: number;
  svgY: number;
  createdAt: number;
  expiresAt: number;
}

export type PreviewSeed = Omit<TimelinePreview, "token" | "createdAt" | "expiresAt">;

// Nur Stift und Finger verwenden die Zwei-Schritt-Interaktion. Die Maus behaelt
// das direkte Desktop-Verhalten (Klick oeffnet sofort).
export function usesTwoPhase(pointerType: string): boolean {
  return pointerType === "pen" || pointerType === "touch";
}

export function movementThreshold(pointerType: string): number {
  if (pointerType === "pen") return POINTER_MOVE_THRESHOLD_PX.pen;
  if (pointerType === "touch") return POINTER_MOVE_THRESHOLD_PX.touch;
  return POINTER_MOVE_THRESHOLD_PX.mouse;
}

export function secondTapTolerance(pointerType: string): number {
  if (pointerType === "pen") return SECOND_TAP_TOLERANCE_PX.pen;
  if (pointerType === "touch") return SECOND_TAP_TOLERANCE_PX.touch;
  return SECOND_TAP_TOLERANCE_PX.mouse;
}

// Klassifiziert eine Bewegung als Tap (unter Schwelle) oder Bewegung.
export function exceedsMovementThreshold(
  pointerType: string,
  dx: number,
  dy: number,
): boolean {
  return Math.hypot(dx, dy) > movementThreshold(pointerType);
}

export function isPreviewExpired(preview: TimelinePreview, now: number): boolean {
  return now >= preview.expiresAt;
}

interface SecondTapCandidate {
  kind: PreviewKind;
  band: VitalKind | null;
  lane: "medication" | "infusion" | "event" | null;
  svgX: number;
  svgY: number;
  pointerType: string;
}

/**
 * Prueft, ob ein neuer Kontakt die zuvor abgelegte Vorschau bestaetigt: gleiches
 * Band bzw. gleiche Lane, innerhalb der Toleranz und noch nicht abgelaufen.
 */
export function isSecondTap(
  preview: TimelinePreview | null,
  candidate: SecondTapCandidate,
  now: number,
): boolean {
  if (!preview) return false;
  if (isPreviewExpired(preview, now)) return false;
  if (preview.kind !== candidate.kind) return false;
  if (preview.kind === "vital" && preview.band !== candidate.band) return false;
  if (preview.kind !== "vital" && preview.lane !== candidate.lane) return false;
  const distance = Math.hypot(preview.svgX - candidate.svgX, preview.svgY - candidate.svgY);
  return distance <= secondTapTolerance(candidate.pointerType);
}

// Baut aus einem Seed die vollstaendige Vorschau inklusive Ablaufzeit.
export function createPreview(seed: PreviewSeed, token: number, createdAt: number): TimelinePreview {
  return { ...seed, token, createdAt, expiresAt: createdAt + PREVIEW_TTL_MS };
}

/**
 * Reiner Kreis-Treffertest fuer die abgelegte Vorschau. Der zweite Kontakt muss
 * weder die duenne Linie noch den exakten Mittelpunkt treffen – ein Punkt
 * irgendwo innerhalb des Trefferradius genuegt. Dadurch bleibt der beim ersten
 * Kontakt festgelegte Zeitstempel maßgeblich (nicht die zweite Kontaktposition).
 */
export function isPointInsidePinnedPreviewCircle(
  pointerX: number,
  pointerY: number,
  centerX: number,
  centerY: number,
  hitRadius: number,
): boolean {
  return Math.hypot(pointerX - centerX, pointerY - centerY) <= hitRadius;
}

/**
 * Entscheidet, ob ein neuer Kontakt die vorhandene Vorschau bestaetigt: gleiche
 * Art/Band/Lane, nicht abgelaufen und innerhalb des Kreis-Trefferradius. Wird
 * bereits beim pointerdown ausgewertet, damit bei einem neuen (nicht
 * bestaetigenden) Kontakt die alte Vorschau sofort entfernt werden kann.
 */
export function isPreviewConfirmHit(
  preview: TimelinePreview | null,
  candidate: {
    kind: PreviewKind;
    band: VitalKind | null;
    lane: "medication" | "infusion" | "event" | null;
    svgX: number;
    svgY: number;
  },
  hitRadius: number,
  now: number,
): boolean {
  if (!preview) return false;
  if (isPreviewExpired(preview, now)) return false;
  if (preview.kind !== candidate.kind) return false;
  if (preview.kind === "vital" && preview.band !== candidate.band) return false;
  if (preview.kind !== "vital" && preview.lane !== candidate.lane) return false;
  return isPointInsidePinnedPreviewCircle(candidate.svgX, candidate.svgY, preview.svgX, preview.svgY, hitRadius);
}
