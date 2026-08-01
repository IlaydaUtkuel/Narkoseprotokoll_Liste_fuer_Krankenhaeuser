import { describe, expect, it } from "vitest";
import { findNearestHit, hitRadius, type HitTarget } from "@/lib/timeline/hitTesting";

const targets: HitTarget[] = [
  { id: "near", shape: "point", x: 100, y: 100 },
  { id: "far", shape: "point", x: 112, y: 100 },
];

describe("pixelgenaues Hit-Testing", () => {
  it("verwendet 12 px fuer Maus, 16 px fuer Pen und 18 px fuer Touch", () => {
    expect(hitRadius("mouse")).toBe(12);
    expect(hitRadius("pen")).toBe(16);
    expect(hitRadius("touch")).toBe(18);
  });

  it("waehlt mit der Maus innerhalb von 12 px den naechsten Punkt", () => {
    expect(findNearestHit({ x: 104, y: 100 }, targets, "mouse")?.id).toBe("near");
  });

  it("liefert ausserhalb der Toleranz null, sodass ein neuer Eintrag geoeffnet wird", () => {
    expect(findNearestHit({ x: 140, y: 100 }, targets, "mouse")).toBeNull();
  });

  it("nutzt die groessere Touch-Toleranz ohne eine 44x44-Flaeche", () => {
    expect(findNearestHit({ x: 117, y: 100 }, [{ id: "p", shape: "point", x: 100, y: 100 }], "touch")?.id).toBe("p");
    expect(findNearestHit({ x: 119, y: 100 }, [{ id: "p", shape: "point", x: 100, y: 100 }], "touch")).toBeNull();
  });

  it("waehlt bei mehreren Treffern den geometrisch naechsten", () => {
    expect(findNearestHit({ x: 109, y: 100 }, targets, "mouse")?.id).toBe("far");
  });

  it("testet NiBP nur gegen vertikale Linie und Mittelwertpunkt", () => {
    const nibp: HitTarget[] = [{ id: "bp", shape: "nibp", x: 80, y1: 50, y2: 120, meanY: 84 }];
    expect(findNearestHit({ x: 90, y: 70 }, nibp, "mouse")?.id).toBe("bp");
    expect(findNearestHit({ x: 100, y: 84 }, nibp, "mouse")).toBeNull();
  });
});
