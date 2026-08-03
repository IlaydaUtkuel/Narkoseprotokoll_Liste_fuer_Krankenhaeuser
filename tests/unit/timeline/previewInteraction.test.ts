import { describe, expect, it } from "vitest";
import {
  createPreview,
  exceedsMovementThreshold,
  isPreviewExpired,
  isSecondTap,
  movementThreshold,
  secondTapTolerance,
  usesTwoPhase,
  type PreviewSeed,
} from "@/lib/timeline/previewInteraction";
import { PREVIEW_TTL_MS } from "@/lib/timeline/config";

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
});
