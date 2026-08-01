import { describe, expect, it } from "vitest";
import { computeVitalScaleDomains, scaleDomainForValues } from "@/lib/timeline/dynamicYScale";
import type { Measurement } from "@/types/vitals";

const base = { createdAt: 1, updatedAt: 1 };

describe("dynamische Y-Skalierung", () => {
  it("umfasst sehr kleine und sehr grosse endliche Werte mit Padding", () => {
    const domain = scaleDomainForValues("heartRate", [-1000, 250000]);
    expect(domain.min).toBeLessThan(-1000);
    expect(domain.max).toBeGreaterThan(250000);
    expect(domain.ticks.length).toBeGreaterThan(2);
  });

  it("zentriert eine einzelne Messung mit sichtbarem Padding", () => {
    const domain = scaleDomainForValues("temperature", [12.5]);
    expect(domain.min).toBeLessThan(12.5);
    expect(domain.max).toBeGreaterThan(12.5);
  });

  it("bezieht bei NIBP alle drei Werte gemeinsam ein", () => {
    const measurements: Measurement[] = [{ id: "n", kind: "nibp", time: 100, systolic: 500, mean: 40, diastolic: -20, ...base }];
    const domain = computeVitalScaleDomains(measurements, 0, 200).nibp;
    expect(domain.min).toBeLessThan(-20);
    expect(domain.max).toBeGreaterThan(500);
  });
});
