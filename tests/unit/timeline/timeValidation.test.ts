import { describe, expect, it } from "vitest";
import { timestampFromClockParts, validateTimelineTime } from "@/lib/timeline/timeValidation";

const START = new Date(2026, 7, 1, 19, 3, 27).getTime();
const NOW = START + 20 * 60_000;

describe("Zeitbearbeitung", () => {
  it("kombiniert die Fallzeit mit HH:mm:ss", () => {
    const value = timestampFromClockParts(START, 19, 12, 24);
    expect(new Date(value).getHours()).toBe(19);
    expect(new Date(value).getMinutes()).toBe(12);
    expect(new Date(value).getSeconds()).toBe(24);
  });

  it("akzeptiert Zeiten im dokumentierbaren Bereich", () => {
    expect(validateTimelineTime(START + 1000, START, NOW, null)).toBeNull();
  });

  it("lehnt Zeit vor dem Start ab", () => {
    expect(validateTimelineTime(START - 1, START, NOW, null)).toBe("beforeStart");
  });

  it("lehnt Zukunft ab", () => {
    expect(validateTimelineTime(NOW + 1, START, NOW, null)).toBe("future");
  });

  it("lehnt Zeit nach endedAt ab", () => {
    expect(validateTimelineTime(START + 11_000, START, NOW, START + 10_000)).toBe("afterEnd");
  });
});
