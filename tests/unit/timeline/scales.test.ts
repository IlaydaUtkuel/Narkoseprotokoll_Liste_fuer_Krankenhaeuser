import { describe, expect, it } from "vitest";
import {
  buildXScale,
  computeDomain,
  timeToX,
  xToTime,
} from "@/lib/timeline/scales";
import { computeTimelineLayout } from "@/lib/timeline/geometry";
import { relativeFiveMinuteTicks } from "@/lib/timeline/timeTicks";

const MIN = 60 * 1000;
const layout = computeTimelineLayout(900);

describe("computeDomain", () => {
  it("haelt domainStart fix und laesst domainEnd wachsen", () => {
    const start = new Date(2026, 6, 31, 19, 0, 0).getTime();
    const d1 = computeDomain(start, start + 5 * MIN);
    const d2 = computeDomain(start, start + 25 * MIN);

    expect(d1.start).toBe(start);
    expect(d2.start).toBe(start);
    expect(d2.end).toBeGreaterThan(d1.end);
  });

  it("laesst die 5-Minuten-Spalten mit der Zeit schmaler werden", () => {
    const start = new Date(2026, 6, 31, 19, 0, 0).getTime();
    const early = buildXScale(computeDomain(start, start + 2 * MIN), layout);
    const late = buildXScale(computeDomain(start, start + 40 * MIN), layout);
    const gapEarly = timeToX(early, start + 5 * MIN) - timeToX(early, start);
    const gapLate = timeToX(late, start + 5 * MIN) - timeToX(late, start);

    expect(gapLate).toBeLessThan(gapEarly);
    // Startpunkt bleibt links.
    expect(timeToX(early, start)).toBeCloseTo(layout.plotLeft, 5);
    expect(timeToX(late, start)).toBeCloseTo(layout.plotLeft, 5);
  });
});

describe("timeToX / xToTime", () => {
  it("sind zueinander invers", () => {
    const start = new Date(2026, 6, 31, 19, 0, 0).getTime();
    const scale = buildXScale(computeDomain(start, start + 10 * MIN), layout);
    const t = start + 7 * MIN + 12 * 1000;
    expect(xToTime(scale, timeToX(scale, t))).toBeCloseTo(t, -1);
  });

  it("aktueller Zeitpunkt liegt exakt auf dem zugehoerigen 5-Minuten-Tick", () => {
    const start = new Date(2026, 6, 31, 19, 0, 0).getTime();
    const now = start + 5 * MIN; // 19:05:00
    const scale = buildXScale(computeDomain(start, now), layout);
    const ticks = relativeFiveMinuteTicks(start, computeDomain(start, now).end);

    expect(ticks[1]).toBe(now);
    expect(timeToX(scale, now)).toBeCloseTo(timeToX(scale, ticks[1]), 6);
  });
});
