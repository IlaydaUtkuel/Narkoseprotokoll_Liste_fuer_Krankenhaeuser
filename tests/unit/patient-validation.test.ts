import { describe, expect, it } from "vitest";
import { parsePatientData } from "@/lib/patient-validation";

describe("parsePatientData", () => {
  it("gibt null zurueck, wenn der Wert kein Objekt ist", () => {
    expect(parsePatientData(null)).toBeNull();
    expect(parsePatientData("kaputt")).toBeNull();
    expect(parsePatientData(42)).toBeNull();
    expect(parsePatientData([1, 2, 3])).toBeNull();
  });

  it("uebernimmt gueltige Werte unveraendert", () => {
    const input = {
      patientName: "Erika Musterfrau",
      birthDate: "1990-05-20",
      procedure: "Cholezystektomie",
      operationDate: "2026-07-01",
      bodyWeightKg: 64.5,
      asaClass: "III",
      mallampatiClass: "I",
      allergies: "Penicillin",
      updatedAt: "2026-06-01T08:00:00.000Z",
    };
    expect(parsePatientData(input)).toEqual(input);
  });

  it("setzt ungueltige Einzelfelder auf sichere Standardwerte zurueck", () => {
    const result = parsePatientData({
      patientName: 123, // ungueltig -> ""
      birthDate: "nicht-ein-datum", // ungueltig -> null
      procedure: undefined, // fehlt -> ""
      operationDate: "2026-13-40", // Format passt nicht der Realitaet, aber Regex? -> siehe unten
      bodyWeightKg: "schwer", // ungueltig -> null
      asaClass: "Z", // ungueltig -> null
      mallampatiClass: "II", // gueltig
      allergies: null, // ungueltig -> ""
    });

    expect(result).not.toBeNull();
    expect(result?.patientName).toBe("");
    expect(result?.birthDate).toBeNull();
    expect(result?.procedure).toBe("");
    expect(result?.bodyWeightKg).toBeNull();
    expect(result?.asaClass).toBeNull();
    expect(result?.mallampatiClass).toBe("II");
    expect(result?.allergies).toBe("");
    expect(result?.updatedAt).toBeNull();
  });
});
