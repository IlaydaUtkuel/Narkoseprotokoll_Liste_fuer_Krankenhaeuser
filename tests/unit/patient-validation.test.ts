import { describe, expect, it } from "vitest";
import { parsePatientData } from "@/lib/patient-validation";

describe("parsePatientData", () => {
  it("gibt null zurueck, wenn der Wert kein Objekt ist", () => {
    expect(parsePatientData(null)).toBeNull();
    expect(parsePatientData("kaputt")).toBeNull();
    expect(parsePatientData(42)).toBeNull();
    expect(parsePatientData([1, 2, 3])).toBeNull();
  });

  it("uebernimmt gueltige Werte (Datum im Raw-Format) unveraendert", () => {
    const input = {
      patientName: "Erika Musterfrau",
      birthDate: "20.05.1990",
      procedure: "Cholezystektomie",
      operationDate: "01.07.2026",
      bodyWeightKg: 64.5,
      weightUnit: "kg",
      asaClass: "III",
      mallampatiClass: "I",
      allergies: "Penicillin",
      updatedAt: "2026-06-01T08:00:00.000Z",
    };
    expect(parsePatientData(input)).toEqual(input);
  });

  it("migriert ISO-Datumswerte und ergaenzt fehlendes weightUnit", () => {
    const result = parsePatientData({
      patientName: "Max",
      birthDate: "1985-03-10",
      operationDate: "2026-06-15",
      bodyWeightKg: 70,
    });
    expect(result?.birthDate).toBe("10.03.1985");
    expect(result?.operationDate).toBe("15.06.2026");
    expect(result?.weightUnit).toBe("kg");
  });

  it("bewahrt unvollstaendige Datums-Teilangaben", () => {
    const result = parsePatientData({ birthDate: "21", operationDate: "21.12." });
    expect(result?.birthDate).toBe("21");
    expect(result?.operationDate).toBe("21.12.");
  });

  it("setzt ungueltige Einzelfelder auf sichere Standardwerte zurueck", () => {
    const result = parsePatientData({
      patientName: 123, // ungueltig -> ""
      birthDate: "nicht-ein-datum", // keine Ziffern -> ""
      procedure: undefined, // fehlt -> ""
      bodyWeightKg: "schwer", // ungueltig -> null
      weightUnit: "stone", // ungueltig -> "kg"
      asaClass: "Z", // ungueltig -> null
      mallampatiClass: "II", // gueltig
      allergies: null, // ungueltig -> ""
    });

    expect(result).not.toBeNull();
    expect(result?.patientName).toBe("");
    expect(result?.birthDate).toBe("");
    expect(result?.procedure).toBe("");
    expect(result?.bodyWeightKg).toBeNull();
    expect(result?.weightUnit).toBe("kg");
    expect(result?.asaClass).toBeNull();
    expect(result?.mallampatiClass).toBe("II");
    expect(result?.allergies).toBe("");
    expect(result?.updatedAt).toBeNull();
  });
});
