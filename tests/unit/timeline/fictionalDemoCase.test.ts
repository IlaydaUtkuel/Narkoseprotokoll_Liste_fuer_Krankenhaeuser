import { describe, expect, it } from "vitest";
import { createFictionalDemoCase, isFictionalDemoCase } from "@/lib/timeline/fictionalDemoCase";
import { CASE_SCHEMA_VERSION } from "@/lib/timeline/config";
import { evaluateCaseCompleteness } from "@/lib/timeline/caseCompleteness";
import { buildCaseExportSnapshot } from "@/lib/timeline/caseExport";

const NOW = new Date(2026, 7, 2, 15, 0, 0).getTime();

describe("fiktiver Demofall", () => {
  it("liefert ausschließlich klar markierte fiktive Basis- und Falldaten im normalen Schema", () => {
    const demo = createFictionalDemoCase(NOW);
    expect(demo.patient.patientName).toContain("DEMO");
    expect(demo.patient.procedure).toContain("Fiktive");
    expect(demo.caseData.schemaVersion).toBe(CASE_SCHEMA_VERSION);
    expect(isFictionalDemoCase(demo.caseData.caseId)).toBe(true);
    expect(demo.caseData.startedAt).not.toBeNull();
    expect(demo.caseData.endedAt).not.toBeNull();
  });

  it("enthält NIBP-Dreierwerte, Medikamente, Infusion und kommentiertes Extra-Ereignis", () => {
    const { caseData } = createFictionalDemoCase(NOW);
    const nibp = caseData.measurements.find((measurement) => measurement.kind === "nibp");
    expect(nibp).toMatchObject({ kind: "nibp", systolic: expect.any(Number), mean: expect.any(Number), diastolic: expect.any(Number) });
    expect(caseData.medications.length).toBeGreaterThan(0);
    expect(caseData.infusions.length).toBeGreaterThan(0);
    expect(caseData.events).toContainEqual(expect.objectContaining({ eventType: "extra", comment: expect.stringContaining("Fiktiver") }));
  });

  it("demonstriert kontrolliert offene Dokumentation, ohne die abgeleiteten Hinweise zu persistieren", () => {
    const demo = createFictionalDemoCase(NOW);
    const before = JSON.stringify(demo.caseData);
    const result = evaluateCaseCompleteness(demo.caseData, demo.patient, undefined, demo.caseData.endedAt ?? NOW);
    expect(result.issues).toContainEqual(expect.objectContaining({ id: "therapien-offen" }));
    expect(result.issues).toContainEqual(expect.objectContaining({ id: "vitals-checkpoints-offen" }));
    expect(JSON.stringify(demo.caseData)).toBe(before);
  });

  it("wird unverändert über den normalen Fall-Export serialisiert", () => {
    const demo = createFictionalDemoCase(NOW);
    const exported = buildCaseExportSnapshot(demo.caseData, demo.patient, "2026-08-02T13:30:00.000Z");
    const json = JSON.stringify(exported);
    expect(json).toContain("DEMO – Fiktive Person");
    expect(exported.caseId).toBe(demo.caseData.caseId);
    expect(exported.measurements).toHaveLength(demo.caseData.measurements.length);
    expect(exported).not.toHaveProperty("completeness");
  });
});
