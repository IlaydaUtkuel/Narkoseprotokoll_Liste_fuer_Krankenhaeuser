import { describe, expect, it } from "vitest";
import { clientToSvgPoint } from "@/lib/timeline/svgCoords";

describe("clientToSvgPoint", () => {
  it("verwendet getScreenCTM().inverse() wenn verfügbar (Safari-genau)", () => {
    // CTM mit Verschiebung (20, 40) und Skalierung 0.5: screen = local*0.5 + offset.
    const inverse = {
      // matrixTransform-Ersatz: local = (client - offset) / scale
      transform: (x: number, y: number) => ({ x: (x - 20) / 0.5, y: (y - 40) / 0.5 }),
    };
    const point = { x: 0, y: 0, matrixTransform: (m: typeof inverse) => m.transform(point.x, point.y) };
    const svg = {
      getScreenCTM: () => ({ inverse: () => inverse }),
      createSVGPoint: () => point,
    } as unknown as SVGSVGElement;
    const result = clientToSvgPoint(svg, 120, 140);
    expect(result).toEqual({ x: (120 - 20) / 0.5, y: (140 - 40) / 0.5 });
  });

  it("fällt auf getBoundingClientRect zurück, wenn getScreenCTM fehlt (jsdom)", () => {
    const svg = {
      getBoundingClientRect: () => ({ left: 10, top: 30 }),
    } as unknown as SVGSVGElement;
    expect(clientToSvgPoint(svg, 60, 130)).toEqual({ x: 50, y: 100 });
  });

  it("ist robust gegen null-SVG", () => {
    expect(clientToSvgPoint(null, 5, 7)).toEqual({ x: 5, y: 7 });
  });
});
