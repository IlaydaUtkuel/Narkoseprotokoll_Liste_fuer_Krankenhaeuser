import { describe, expect, it } from "vitest";
import { checkpointIconRect, criticalIconRect } from "@/lib/timeline/warningIcons";
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
