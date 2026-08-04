import { describe, expect, it } from "vitest";
import { checkpointIconRect, criticalIconRect, occupiedSpot, placeCriticalIcon } from "@/lib/timeline/warningIcons";
import { tooltipOverlapArea } from "@/lib/timeline/tooltipPlacement";
import { MIN_INTERACTIVE_TARGET_PX } from "@/lib/timeline/config";

const SIZE = MIN_INTERACTIVE_TARGET_PX;

describe("warningIcons", () => {
  it("kritisches Icon: rechts neben dem Messpunkt, oberhalb per Band-Top begrenzt", () => {
    const rect = criticalIconRect(400, 300, 250, 980);
    expect(rect).toEqual({ x: 407, y: 275, width: SIZE, height: SIZE });
  });

  it("kritisches Icon: am rechten Plotrand geclampt (kein Overflow)", () => {
    const rect = criticalIconRect(970, 300, 250, 980);
    expect(rect.x).toBe(980 - SIZE);
    expect(rect.x + rect.width).toBeLessThanOrEqual(980);
  });

  it("kritisches Icon: nahe Band-Oberkante nach unten begrenzt", () => {
    const rect = criticalIconRect(400, 255, 250, 980);
    expect(rect.y).toBe(252); // bandTop + 2
  });

  it("Checkpoint-Icon: mittig unter der Kontrollzeit, unterhalb des Plots", () => {
    const rect = checkpointIconRect(500, 1000);
    expect(rect).toEqual({ x: 500 - SIZE / 2, y: 1008, width: SIZE, height: SIZE });
  });
});

describe("placeCriticalIcon: verdeckt niemals bedienbare Messwerte", () => {
  const bounds = { left: 176, top: 500, right: 980, bottom: 670 };

  it("weicht den drei NiBP-Griffen derselben Messung aus", () => {
    // Mittel bei 585, Systolisch dicht darueber (565), Diastolisch darunter (605).
    const marker = { x: 500, y: 585 };
    const occupied = [occupiedSpot(500, 585), occupiedSpot(500, 565), occupiedSpot(500, 605)];
    const icon = placeCriticalIcon(marker, occupied, bounds);
    for (const spot of occupied) expect(tooltipOverlapArea(icon, spot)).toBe(0);
    expect(icon.x).toBeGreaterThanOrEqual(bounds.left);
    expect(icon.x + icon.width).toBeLessThanOrEqual(bounds.right);
  });

  it("weicht auch benachbarten Messpunkten aus", () => {
    const marker = { x: 500, y: 585 };
    // Nachbarpunkte links und rechts sowie darueber.
    const occupied = [occupiedSpot(500, 585), occupiedSpot(540, 585), occupiedSpot(460, 585), occupiedSpot(500, 545)];
    const icon = placeCriticalIcon(marker, occupied, bounds);
    for (const spot of occupied) expect(tooltipOverlapArea(icon, spot)).toBe(0);
  });

  it("bleibt am rechten Rand vollstaendig im Band", () => {
    const icon = placeCriticalIcon({ x: 975, y: 660 }, [occupiedSpot(975, 660)], bounds);
    expect(icon.x).toBeGreaterThanOrEqual(bounds.left);
    expect(icon.x + icon.width).toBeLessThanOrEqual(bounds.right);
    expect(icon.y).toBeGreaterThanOrEqual(bounds.top);
    expect(icon.y + icon.height).toBeLessThanOrEqual(bounds.bottom);
  });

  it("bleibt ohne Kollision dicht beim ausloesenden Messwert", () => {
    const icon = placeCriticalIcon({ x: 500, y: 585 }, [occupiedSpot(500, 585)], bounds);
    const dx = Math.max(icon.x - 500, 0, 500 - (icon.x + icon.width));
    const dy = Math.max(icon.y - 585, 0, 585 - (icon.y + icon.height));
    expect(Math.hypot(dx, dy)).toBeLessThan(40);
  });
});
