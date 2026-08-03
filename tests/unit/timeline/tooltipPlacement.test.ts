import { describe, expect, it } from "vitest";
import {
  placeTooltipAvoiding,
  placeTooltipAvoidingAll,
  tooltipOverlapArea,
  tooltipRectsOverlap,
} from "@/lib/timeline/tooltipPlacement";

const BOUNDS = { left: 180, top: 100, right: 980, bottom: 700 };

describe("Tooltip-Kollisionsvermeidung", () => {
  it("verschiebt die Therapiebox auf die freie Pointer-Seite", () => {
    const avoid = { x: 510, y: 180, width: 214, height: 28 };
    const placed = placeTooltipAvoiding(
      { x: 500, y: 220 },
      { width: 300, height: 100 },
      { left: 180, top: 100, right: 980, bottom: 700 },
      avoid,
    );
    expect(tooltipRectsOverlap(placed, avoid)).toBe(false);
  });

  it("hält die Box vollständig innerhalb des SVG-Viewports", () => {
    const placed = placeTooltipAvoiding(
      { x: 975, y: 695 },
      { width: 300, height: 120 },
      { left: 180, top: 100, right: 980, bottom: 700 },
    );
    expect(placed.x).toBeGreaterThanOrEqual(180);
    expect(placed.x + placed.width).toBeLessThanOrEqual(980);
    expect(placed.y + placed.height).toBeLessThanOrEqual(700);
  });
});

describe("tooltipOverlapArea", () => {
  it("berechnet die Schnittfläche und 0 bei disjunkten Boxen", () => {
    expect(tooltipOverlapArea({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 })).toBe(25);
    expect(tooltipOverlapArea({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 0, width: 10, height: 10 })).toBe(0);
  });
});

describe("placeTooltipAvoidingAll (Warn-Icon-Kollision)", () => {
  it("kippt bei einem Ausrufezeichen rechts nach links (§7.1)", () => {
    const warnRight = { x: 505, y: 190, width: 46, height: 46 };
    const placed = placeTooltipAvoidingAll({ x: 500, y: 220 }, { width: 214, height: 28 }, BOUNDS, [warnRight]);
    expect(placed.x).toBeLessThan(500);
    expect(tooltipOverlapArea(placed, warnRight)).toBe(0);
  });

  it("weicht mehreren Hindernissen aus (Koordinaten-Tooltip + Ausrufezeichen)", () => {
    const avoid = [
      { x: 505, y: 190, width: 46, height: 46 },
      { x: 250, y: 190, width: 46, height: 46 },
    ];
    const placed = placeTooltipAvoidingAll({ x: 500, y: 220 }, { width: 120, height: 28 }, BOUNDS, avoid);
    for (const rect of avoid) expect(tooltipOverlapArea(placed, rect)).toBe(0);
  });

  it("bleibt am Rand vollständig im Viewport (§7.5)", () => {
    const placed = placeTooltipAvoidingAll({ x: 975, y: 695 }, { width: 300, height: 120 }, BOUNDS, []);
    expect(placed.x).toBeGreaterThanOrEqual(BOUNDS.left);
    expect(placed.x + placed.width).toBeLessThanOrEqual(BOUNDS.right);
    expect(placed.y).toBeGreaterThanOrEqual(BOUNDS.top);
    expect(placed.y + placed.height).toBeLessThanOrEqual(BOUNDS.bottom);
  });

  it("liefert die überlappungsärmste Position, wenn keine völlig frei ist", () => {
    // Ein sehr breites Hindernis über der ganzen Breite: keine kollisionsfreie Position,
    // aber das Ergebnis bleibt in den Grenzen.
    const wall = { x: 180, y: 100, width: 800, height: 600 };
    const placed = placeTooltipAvoidingAll({ x: 500, y: 400 }, { width: 100, height: 28 }, BOUNDS, [wall]);
    expect(placed.x).toBeGreaterThanOrEqual(BOUNDS.left);
    expect(placed.x + placed.width).toBeLessThanOrEqual(BOUNDS.right);
  });
});
