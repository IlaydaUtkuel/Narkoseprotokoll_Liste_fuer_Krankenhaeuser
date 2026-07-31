import { describe, expect, it } from "vitest";
import {
  clampValue,
  findNearestSameKind,
  roundToPrecision,
  sortByTime,
} from "@/lib/timeline/measurementUtils";
import type { Measurement } from "@/types/vitals";

const START = 1_700_000_000_000;

function scalar(id: string, kind: "spo2" | "heartRate" | "temperature", time: number): Measurement {
  return { id, kind, time, value: 90, createdAt: time, updatedAt: time };
}

describe("measurementUtils", () => {
  it("roundToPrecision rundet gemaess Nachkommastellen", () => {
    expect(roundToPrecision(37.34, 1)).toBe(37.3);
    expect(roundToPrecision(94.6, 0)).toBe(95);
  });

  it("clampValue haelt Werte im Bereich", () => {
    expect(clampValue(5, 0, 3)).toBe(3);
    expect(clampValue(-1, 0, 3)).toBe(0);
    expect(clampValue(2, 0, 3)).toBe(2);
  });

  it("sortByTime sortiert aufsteigend", () => {
    const arr = [{ time: 3 }, { time: 1 }, { time: 2 }];
    expect(sortByTime(arr).map((x) => x.time)).toEqual([1, 2, 3]);
  });

  it("findNearestSameKind: gleicher Parameter innerhalb der Toleranz", () => {
    const list = [scalar("a", "spo2", START), scalar("hr", "heartRate", START + 10_000)];
    expect(findNearestSameKind(list, "spo2", START + 20_000, 30_000)?.id).toBe("a");
    expect(findNearestSameKind(list, "spo2", START + 40_000, 30_000)).toBeNull();
    expect(findNearestSameKind(list, "heartRate", START + 10_000, 30_000)?.id).toBe("hr");
    // Anderer Parameter zaehlt nicht als Duplikat.
    expect(findNearestSameKind(list, "spo2", START + 20_000, 30_000)?.id).not.toBe("hr");
  });
});
