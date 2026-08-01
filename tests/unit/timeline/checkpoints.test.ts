import { describe, expect, it } from "vitest";
import { completedCheckpointTimes, deriveCheckpointWarnings } from "@/lib/timeline/checkpoints";
import type { Measurement } from "@/types/vitals";

const MIN = 60_000;
const START = 1_000_017;
const base = { createdAt: START, updatedAt: START };

function completeAt(time: number): Measurement[] {
  return [
    { id: `s-${time}`, kind: "spo2", time, value: 98, ...base },
    { id: `h-${time}`, kind: "heartRate", time, value: 70, ...base },
    { id: `t-${time}`, kind: "temperature", time, value: 36.7, ...base },
    { id: `n-${time}`, kind: "nibp", time, systolic: 120, mean: 90, diastolic: 70, ...base },
  ];
}

describe("relative 5-Minuten-Kontrollpunkte", () => {
  it("berechnet nur vollstaendig vergangene Punkte relativ zum Start", () => {
    expect(completedCheckpointTimes(START, START + 14 * MIN)).toEqual([START + 5 * MIN, START + 10 * MIN]);
    expect(completedCheckpointTimes(START, START + 4 * MIN)).toEqual([]);
  });

  it("erzeugt weder zukuenftige noch nach endedAt liegende Punkte", () => {
    expect(deriveCheckpointWarnings(START, null, START + 9 * MIN, [])).toHaveLength(1);
    expect(deriveCheckpointWarnings(START, START + 11 * MIN, START + 60 * MIN, [])).toHaveLength(2);
  });

  it("verschwindet bei vier vollstaendigen Baendern und erscheint nach Loeschung erneut", () => {
    const time = START + 5 * MIN;
    const complete = completeAt(time);
    expect(deriveCheckpointWarnings(START, null, time, complete)).toEqual([]);
    const afterDelete = complete.filter((measurement) => measurement.kind !== "temperature");
    expect(deriveCheckpointWarnings(START, null, time, afterDelete)[0].missing.map((item) => item.kind)).toEqual(["temperature"]);
  });

  it("wertet einen NIBP-Eintrag nur mit Mittel nicht als vollstaendig", () => {
    const time = START + 5 * MIN;
    const values = completeAt(time).map((measurement) => measurement.kind === "nibp" ? { ...measurement, systolic: null, diastolic: null } : measurement) as Measurement[];
    const warning = deriveCheckpointWarnings(START, null, time, values)[0];
    expect(warning.missing[0]).toMatchObject({ kind: "nibp", detail: "Systolisch und Diastolisch" });
  });
});
