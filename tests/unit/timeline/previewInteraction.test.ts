import { describe, expect, it } from "vitest";
import {
  createPreview,
  exceedsMovementThreshold,
  isPointInsidePinnedPreviewCircle,
  isPreviewConfirmHit,
  isPreviewExpired,
  isSecondTap,
  movementThreshold,
  secondTapTolerance,
  usesTwoPhase,
  type PreviewSeed,
} from "@/lib/timeline/previewInteraction";
import { PREVIEW_HIT_RADIUS_PX, PREVIEW_TTL_MS } from "@/lib/timeline/config";

function vitalSeed(overrides: Partial<PreviewSeed> = {}): PreviewSeed {
  return {
    kind: "vital",
    pointerType: "touch",
    band: "spo2",
    lane: null,
    eventType: null,
    time: 1_000,
    value: 96,
    unit: "%",
    svgX: 400,
    svgY: 200,
    ...overrides,
  };
}

describe("previewInteraction", () => {
  it("nutzt die Zwei-Schritt-Interaktion nur fuer Stift und Finger", () => {
    expect(usesTwoPhase("pen")).toBe(true);
    expect(usesTwoPhase("touch")).toBe(true);
    expect(usesTwoPhase("mouse")).toBe(false);
  });

  it("liefert pointerabhaengige Schwellen und Toleranzen", () => {
    expect(movementThreshold("pen")).toBe(4);
    expect(movementThreshold("touch")).toBe(8);
    expect(movementThreshold("mouse")).toBe(3);
    expect(secondTapTolerance("pen")).toBe(14);
    expect(secondTapTolerance("touch")).toBe(20);
  });

  it("erkennt Bewegungen oberhalb der Schwelle", () => {
    expect(exceedsMovementThreshold("pen", 3, 0)).toBe(false);
    expect(exceedsMovementThreshold("pen", 5, 0)).toBe(true);
    expect(exceedsMovementThreshold("touch", 6, 0)).toBe(false);
    expect(exceedsMovementThreshold("touch", 9, 0)).toBe(true);
  });

  it("laeuft nach der TTL ab", () => {
    const preview = createPreview(vitalSeed(), 1, 10_000);
    expect(preview.expiresAt).toBe(10_000 + PREVIEW_TTL_MS);
    expect(isPreviewExpired(preview, 10_000 + PREVIEW_TTL_MS - 1)).toBe(false);
    expect(isPreviewExpired(preview, 10_000 + PREVIEW_TTL_MS)).toBe(true);
  });

  it("bestaetigt eine zweite Beruehrung nur im selben Band, in Toleranz und vor Ablauf", () => {
    const preview = createPreview(vitalSeed(), 1, 0);
    // gleiche Stelle, gleiches Band -> Auswahl
    expect(isSecondTap(preview, { kind: "vital", band: "spo2", lane: null, svgX: 405, svgY: 205, pointerType: "touch" }, 500)).toBe(true);
    // zu weit weg -> keine Auswahl
    expect(isSecondTap(preview, { kind: "vital", band: "spo2", lane: null, svgX: 460, svgY: 205, pointerType: "touch" }, 500)).toBe(false);
    // anderes Band -> keine Auswahl
    expect(isSecondTap(preview, { kind: "vital", band: "heartRate", lane: null, svgX: 405, svgY: 205, pointerType: "touch" }, 500)).toBe(false);
    // abgelaufen -> keine Auswahl
    expect(isSecondTap(preview, { kind: "vital", band: "spo2", lane: null, svgX: 405, svgY: 205, pointerType: "touch" }, PREVIEW_TTL_MS + 1)).toBe(false);
  });

  it("trennt Lanes: eine Medikamenten-Vorschau wird nicht durch die Infusions-Lane bestaetigt", () => {
    const preview = createPreview(vitalSeed({ kind: "medication", band: null, lane: "medication", value: null, unit: null }), 2, 0);
    expect(isSecondTap(preview, { kind: "medication", band: null, lane: "medication", svgX: 401, svgY: 201, pointerType: "touch" }, 100)).toBe(true);
    expect(isSecondTap(preview, { kind: "infusion", band: null, lane: "infusion", svgX: 401, svgY: 201, pointerType: "touch" }, 100)).toBe(false);
    expect(isSecondTap(preview, { kind: "medication", band: null, lane: "infusion", svgX: 401, svgY: 201, pointerType: "touch" }, 100)).toBe(false);
  });

  it("liefert null-Vorschau als kein zweiter Tap", () => {
    expect(isSecondTap(null, { kind: "vital", band: "spo2", lane: null, svgX: 0, svgY: 0, pointerType: "pen" }, 0)).toBe(false);
  });

  it("Kreis-Treffertest: jeder Punkt innerhalb des Radius zählt", () => {
    expect(isPointInsidePinnedPreviewCircle(400, 200, 400, 200, 22)).toBe(true);
    expect(isPointInsidePinnedPreviewCircle(418, 200, 400, 200, 22)).toBe(true); // 18 px seitlich
    expect(isPointInsidePinnedPreviewCircle(400, 220, 400, 200, 22)).toBe(true); // 20 px vertikal
    expect(isPointInsidePinnedPreviewCircle(430, 200, 400, 200, 22)).toBe(false); // 30 px zu weit
  });

  it("Bestätigungs-Treffer: Kreis um die abgelegte Lane-Vorschau, unabhängig vom exakten X", () => {
    const preview = createPreview(
      vitalSeed({ kind: "medication", band: null, lane: "medication", value: null, unit: null, svgX: 400, svgY: 60 }),
      3,
      0,
    );
    const cand = (x: number, y: number, lane: "medication" | "infusion") => ({ kind: lane, band: null, lane, svgX: x, svgY: y });
    // Innerhalb des 22-px-Kreises, aber NICHT exakt auf der Linie -> bestätigt.
    expect(isPreviewConfirmHit(preview, cand(415, 70, "medication"), PREVIEW_HIT_RADIUS_PX, 500)).toBe(true);
    // Zu weit weg -> neue Vorschau, keine Bestätigung.
    expect(isPreviewConfirmHit(preview, cand(460, 60, "medication"), PREVIEW_HIT_RADIUS_PX, 500)).toBe(false);
    // Andere Lane -> keine Bestätigung.
    expect(isPreviewConfirmHit(preview, cand(400, 60, "infusion"), PREVIEW_HIT_RADIUS_PX, 500)).toBe(false);
    // Abgelaufen -> keine Bestätigung.
    expect(isPreviewConfirmHit(preview, cand(400, 60, "medication"), PREVIEW_HIT_RADIUS_PX, PREVIEW_TTL_MS + 1)).toBe(false);
    // Keine Vorschau -> keine Bestätigung.
    expect(isPreviewConfirmHit(null, cand(400, 60, "medication"), PREVIEW_HIT_RADIUS_PX, 0)).toBe(false);
  });
});
