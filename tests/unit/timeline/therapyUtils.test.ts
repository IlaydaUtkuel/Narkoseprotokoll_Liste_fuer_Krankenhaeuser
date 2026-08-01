import { describe, expect, it } from "vitest";
import { displayEndTime, explicitEndTime } from "@/lib/timeline/therapyUtils";

const START = 1_700_000_000_000;

describe("Therapie-Darstellungsdauer", () => {
  it("berechnet das Ende ausschliesslich aus expliziter Dauer", () => {
    expect(explicitEndTime({ startTime: START, durationMinutes: 20, endTime: null, ongoing: false }))
      .toBe(START + 20 * 60_000);
  });

  it("erzeugt ohne Dauer oder Endzeit keinen Bolus-Hintergrund", () => {
    expect(displayEndTime({ startTime: START, durationMinutes: null, endTime: null, ongoing: false }, START + 60_000, null))
      .toBeNull();
  });

  it("begrenzt laufende Gaben auf currentTime beziehungsweise endedAt", () => {
    const ongoing = { startTime: START, durationMinutes: null, endTime: null, ongoing: true };
    expect(displayEndTime(ongoing, START + 30_000, null)).toBe(START + 30_000);
    expect(displayEndTime(ongoing, START + 60_000, START + 45_000)).toBe(START + 45_000);
  });
});
