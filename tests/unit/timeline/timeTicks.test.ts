import { describe, expect, it } from "vitest";
import { relativeFiveMinuteTicks, relativeTimelineTicks } from "@/lib/timeline/timeTicks";
import { formatHm } from "@/lib/timeline/format";

const MIN = 60 * 1000;

describe("relativeFiveMinuteTicks", () => {
  it("erzeugt 5-Minuten-Ticks relativ zur Startzeit (nicht zur Wanduhr)", () => {
    const start = new Date(2026, 6, 31, 19, 3, 27).getTime(); // 19:03:27
    const end = start + 30 * MIN;
    const ticks = relativeFiveMinuteTicks(start, end);
    const labels = ticks.map(formatHm);

    expect(labels.slice(0, 4)).toEqual(["19:03", "19:08", "19:13", "19:18"]);
    expect(labels).not.toContain("19:05");
    expect(labels).not.toContain("19:10");
  });

  it("jeder Tick ist startedAt + n * 5min", () => {
    const start = new Date(2026, 6, 31, 8, 0, 0).getTime();
    const ticks = relativeFiveMinuteTicks(start, start + 20 * MIN);
    expect(ticks).toEqual([
      start,
      start + 5 * MIN,
      start + 10 * MIN,
      start + 15 * MIN,
      start + 20 * MIN,
    ]);
  });

  it("liefert bei ungueltigen Eingaben eine leere Liste", () => {
    expect(relativeFiveMinuteTicks(100, 50)).toEqual([]);
  });

  it("erzeugt relative 1-Minuten-Minor- und 5-Minuten-Major-Ticks ohne Duplikate", () => {
    const start = new Date(2026, 6, 31, 19, 3, 27).getTime();
    const ticks = relativeTimelineTicks(start, start + 12 * MIN);
    expect(ticks.major).toEqual([start, start + 5 * MIN, start + 10 * MIN]);
    expect(ticks.minor).toContain(start + MIN);
    expect(ticks.minor).toContain(start + 6 * MIN);
    expect(ticks.minor.some((tick) => ticks.major.includes(tick))).toBe(false);
  });
});
