import { describe, expect, it } from "vitest";
import { computeTimelineLayout } from "@/lib/timeline/geometry";
import { buildXScale, buildYScales, computeDomain, timeToX } from "@/lib/timeline/scales";
import { mapPointerToTimeline } from "@/lib/timeline/pointerMapping";
import { normalizeVitalPointerValue } from "@/lib/timeline/measurementUtils";
import type { VitalKind } from "@/types/vitals";

const MIN = 60 * 1000;
const START = new Date(2026, 6, 31, 19, 0, 0).getTime();
const NOW = START + 20 * MIN;

const layout = computeTimelineLayout(1000);
const domain = computeDomain(START, NOW);
const xScale = buildXScale(domain, layout);
const yScales = buildYScales(layout);

function mapAt(kind: VitalKind, time: number, value: number) {
  const svgX = timeToX(xScale, time);
  const svgY = yScales[kind](value);
  return mapPointerToTimeline({
    clientX: svgX,
    clientY: svgY,
    rect: { left: 0, top: 0 },
    layout,
    xScale,
    yScales,
    startedAt: START,
    now: NOW,
  });
}

describe("mapPointerToTimeline", () => {
  it("ordnet einen Punkt korrekt Zeit, Band und Wert zu (alle skalaren Baender)", () => {
    const targetTime = START + 10 * MIN;

    const spo2 = mapAt("spo2", targetTime, 90);
    expect(spo2.ok).toBe(true);
    if (spo2.ok) {
      expect(spo2.kind).toBe("spo2");
      expect(spo2.value).toBe(90);
      expect(Math.abs(spo2.time - targetTime)).toBeLessThan(2000);
    }

    const hr = mapAt("heartRate", targetTime, 80);
    expect(hr.ok && hr.kind === "heartRate" && hr.value === 80).toBe(true);

    const temp = mapAt("temperature", targetTime, 37);
    expect(temp.ok && temp.kind === "temperature" && temp.value === 37).toBe(true);
  });

  it("liefert bei NiBP kein Wert (Formulareingabe), aber Zeit und Band", () => {
    const result = mapAt("nibp", START + 8 * MIN, 120);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe("nibp");
      expect(result.value).toBeNull();
      expect(result.pointerValue).toBe(120);
    }
  });

  it("liefert nach endedAt einen koordinatenhaltigen afterEnd-Fehler", () => {
    const time = START + 12 * MIN;
    const svgX = timeToX(xScale, time);
    const svgY = yScales.spo2(95);
    const result = mapPointerToTimeline({
      clientX: svgX,
      clientY: svgY,
      rect: { left: 0, top: 0 },
      layout,
      xScale,
      yScales,
      startedAt: START,
      now: NOW,
      endedAt: START + 10 * MIN,
    });
    expect(result).toMatchObject({ ok: false, reason: "afterEnd", kind: "spo2", pointerValue: 95 });
  });

  it("lehnt Zukunft ab", () => {
    const result = mapAt("spo2", NOW + 5 * MIN, 95);
    expect(result).toMatchObject({ ok: false, reason: "future", kind: "spo2", value: 95 });
  });

  it("lehnt Positionen ausserhalb der Plotflaeche ab", () => {
    const result = mapPointerToTimeline({
      clientX: layout.plotLeft - 6,
      clientY: yScales.spo2(95),
      rect: { left: 0, top: 0 },
      layout,
      xScale,
      yScales,
      startedAt: START,
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: "outside" });
  });

  it("rundet Werte gemaess Precision (Temperatur eine Nachkommastelle)", () => {
    const svgY = yScales.temperature(37.34);
    const result = mapPointerToTimeline({
      clientX: timeToX(xScale, START + 5 * MIN),
      clientY: svgY,
      rect: { left: 0, top: 0 },
      layout,
      xScale,
      yScales,
      startedAt: START,
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(37.3);
  });

  it("normalisiert Checkpoint-Y für Herzfrequenz, Temperatur, NIBP und SpO₂", () => {
    expect(normalizeVitalPointerValue("heartRate", 114.6)).toBe(115);
    expect(normalizeVitalPointerValue("temperature", 36.67)).toBe(36.7);
    expect(normalizeVitalPointerValue("nibp", 91.6)).toBe(92);
    expect(normalizeVitalPointerValue("spo2", 101.2)).toBe(100);
    expect(normalizeVitalPointerValue("spo2", -2)).toBe(0);
  });
});
