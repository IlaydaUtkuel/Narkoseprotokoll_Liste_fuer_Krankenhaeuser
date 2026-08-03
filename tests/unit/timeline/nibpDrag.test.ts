import { describe, expect, it } from "vitest";
import {
  applyNibpDrag,
  clampDiastolic,
  clampMean,
  clampSystolic,
  nearestNibpHandle,
  nonOverlappingRadius,
} from "@/lib/timeline/nibpDrag";

const SNAPSHOT = { systolic: 120, mean: 90, diastolic: 60 };
const SCALE_MIN = 30;
const SCALE_MAX = 220;

describe("nibpDrag", () => {
  it("aendert beim Systolisch-Drag nur Systolisch; Mittel und Diastolisch bleiben", () => {
    const result = applyNibpDrag(SNAPSHOT, "systolic", 140, SCALE_MIN, SCALE_MAX);
    expect(result).toEqual({ systolic: 140, mean: 90, diastolic: 60 });
  });

  it("aendert beim Diastolisch-Drag nur Diastolisch; Systolisch und Mittel bleiben", () => {
    const result = applyNibpDrag(SNAPSHOT, "diastolic", 55, SCALE_MIN, SCALE_MAX);
    expect(result).toEqual({ systolic: 120, mean: 90, diastolic: 55 });
  });

  it("aendert beim Mittel-Drag nur das Mittel; Systolisch und Diastolisch bleiben", () => {
    const result = applyNibpDrag(SNAPSHOT, "mean", 100, SCALE_MIN, SCALE_MAX);
    expect(result).toEqual({ systolic: 120, mean: 100, diastolic: 60 });
  });

  it("haelt die Reihenfolge ein: Systolisch bleibt oberhalb des Mittels", () => {
    // Versuch, Systolisch unter das Mittel (90) zu ziehen -> Clamp auf mean + Abstand.
    expect(clampSystolic(70, 90, SCALE_MIN, SCALE_MAX)).toBe(91);
  });

  it("haelt die Reihenfolge ein: Diastolisch bleibt unterhalb des Mittels", () => {
    expect(clampDiastolic(110, 90, SCALE_MIN, SCALE_MAX)).toBe(89);
  });

  it("begrenzt das Mittel zwischen Diastolisch und Systolisch", () => {
    expect(clampMean(200, 120, 60, SCALE_MIN, SCALE_MAX)).toBe(119);
    expect(clampMean(10, 120, 60, SCALE_MIN, SCALE_MAX)).toBe(61);
  });

  it("erlaubt volle Skalengrenzen fuer das Mittel, wenn Endpunkte fehlen", () => {
    expect(clampMean(500, null, null, SCALE_MIN, SCALE_MAX)).toBe(SCALE_MAX);
    expect(clampMean(-500, null, null, SCALE_MIN, SCALE_MAX)).toBe(SCALE_MIN);
  });

  it("waehlt den naechsten Griff anhand der Y-Position", () => {
    const ys = { systolic: 100, mean: 150, diastolic: 200 };
    expect(nearestNibpHandle(102, ys)).toBe("systolic");
    expect(nearestNibpHandle(151, ys)).toBe("mean");
    expect(nearestNibpHandle(198, ys)).toBe("diastolic");
    // Genau auf der Grenze zwischen Systolisch und Mittel -> Systolisch (<=).
    expect(nearestNibpHandle(125, ys)).toBe("systolic");
  });

  it("begrenzt den Trefferradius auf den halben Abstand zum Nachbarn", () => {
    // Nachbar 10 px entfernt -> maximal 5 px Radius.
    expect(nonOverlappingRadius(100, [110], 9, 3)).toBe(5);
    // Weit entfernte Nachbarn -> Wunschradius.
    expect(nonOverlappingRadius(100, [200], 9, 3)).toBe(9);
    // Nie unter das Minimum.
    expect(nonOverlappingRadius(100, [101], 9, 3)).toBe(3);
  });
});
