import { describe, expect, it } from "vitest";
import { buildStepPoints, spo2ValueAt } from "@/lib/timeline/spo2Path";

const MIN = 60 * 1000;
const START = new Date(2026, 6, 31, 19, 0, 0).getTime();
const t04 = START + 4 * MIN;
const t11 = START + 11 * MIN;
const t18 = START + 18 * MIN;

describe("SpO2 Step-After-Verhalten", () => {
  it("haelt jeden Wert bis zur naechsten Messung bzw. bis jetzt", () => {
    const now = START + 15 * MIN;
    const points = buildStepPoints(
      [
        { time: t04, value: 95 },
        { time: t11, value: 98 },
      ],
      now,
    );

    // 19:04–19:11 -> 95, 19:11–jetzt -> 98
    expect(spo2ValueAt(points, START + 6 * MIN)).toBe(95);
    expect(spo2ValueAt(points, START + 10 * MIN)).toBe(95);
    expect(spo2ValueAt(points, START + 12 * MIN)).toBe(98);
    expect(spo2ValueAt(points, now)).toBe(98);
    // Vor der ersten Messung: kein Wert.
    expect(spo2ValueAt(points, START + 2 * MIN)).toBeNull();
  });

  it("verlaengert den letzten Wert nur bis jetzt, nicht in die Zukunft", () => {
    const now = t18 + 3 * MIN;
    const points = buildStepPoints(
      [
        { time: t04, value: 95 },
        { time: t11, value: 98 },
        { time: t18, value: 96 },
      ],
      now,
    );
    const last = points[points.length - 1];
    expect(last.time).toBe(now);
    expect(last.value).toBe(96);
    expect(points.every((p) => p.time <= now)).toBe(true);
  });

  it("ergibt ohne Messungen keine Punkte", () => {
    expect(buildStepPoints([], START)).toEqual([]);
  });
});
