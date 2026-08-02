import { describe, expect, it } from "vitest";
import { displayEndTime, explicitEndTime } from "@/lib/timeline/therapyUtils";

const START = 1_700_000_000_000;

describe("Therapie-Darstellungsdauer", () => {
  it("verwendet das einzige persistierte explizite Ende", () => {
    expect(explicitEndTime({ startedAt: START, endedAt: START + 20 * 60_000, ongoing: false }))
      .toBe(START + 20 * 60_000);
  });

  it("zeigt eine explizit eingegebene Dauer vollständig, auch wenn ihr Ende nach currentTime liegt", () => {
    const entry = { startedAt: START, endedAt: START + 20 * 60_000, ongoing: false };
    expect(displayEndTime(entry, START + 1_000, null)).toBe(START + 20 * 60_000);
  });

  it("erzeugt ohne Dauer oder Endzeit keinen Bolus-Hintergrund", () => {
    expect(displayEndTime({ startedAt: START, endedAt: null, ongoing: false }, START + 60_000, null))
      .toBeNull();
  });

  it("begrenzt laufende Gaben auf currentTime beziehungsweise endedAt", () => {
    const ongoing = { startedAt: START, endedAt: null, ongoing: true };
    expect(displayEndTime(ongoing, START + 30_000, null)).toBe(START + 30_000);
    expect(displayEndTime(ongoing, START + 60_000, START + 45_000)).toBe(START + 45_000);
  });
});
