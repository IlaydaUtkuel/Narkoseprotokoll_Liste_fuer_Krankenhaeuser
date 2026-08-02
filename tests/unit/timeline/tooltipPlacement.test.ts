import { describe, expect, it } from "vitest";
import { placeTooltipAvoiding, tooltipRectsOverlap } from "@/lib/timeline/tooltipPlacement";

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
