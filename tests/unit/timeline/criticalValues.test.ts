import { describe, expect, it } from "vitest";
import {
  ADULT_CRITICAL_THRESHOLDS,
  EMPTY_CRITICAL_THRESHOLDS,
  ageDefaults,
  ageGroupFor,
  calculatePatientAge,
  deriveCriticalWarnings,
  validateCriticalThresholds,
} from "@/lib/timeline/criticalValues";
import type { Measurement, NibpMeasurement, ScalarKind, ScalarMeasurement } from "@/types/vitals";

const NOW = new Date(2026, 7, 2, 12, 0, 0);
const T0 = NOW.getTime();

function scalar(kind: ScalarKind, value: number, time = T0, id = `${kind}-${value}`): ScalarMeasurement {
  return { id, kind, value, time, createdAt: time, updatedAt: time };
}

function nibp(systolic: number | null, mean: number, diastolic: number | null, id = "nibp"): NibpMeasurement {
  return { id, kind: "nibp", systolic, mean, diastolic, time: T0, createdAt: T0, updatedAt: T0 };
}

function isCritical(measurement: Measurement) {
  return deriveCriticalWarnings([measurement], ADULT_CRITICAL_THRESHOLDS).length > 0;
}

describe("altersabhängige kritische Werte", () => {
  it("berechnet das Alter vor dem diesjährigen Geburtstag", () => {
    expect(calculatePatientAge("03.08.2008", NOW)).toBe(17);
  });

  it("berechnet am Geburtstag bereits das neue Alter", () => {
    expect(calculatePatientAge("02.08.2008", NOW)).toBe(18);
  });

  it.each(["", "31.02.2000", "03.08.2030", "abc"])("liefert bei ungültigem Geburtsdatum %s kein Alter", (birthDate) => {
    expect(calculatePatientAge(birthDate, NOW)).toBeNull();
    expect(ageDefaults(calculatePatientAge(birthDate, NOW))).toEqual(EMPTY_CRITICAL_THRESHOLDS);
  });

  it("startet mit 17 Jahren ohne vorbelegte Schwellen", () => {
    const age = calculatePatientAge("03.08.2008", NOW);
    expect(ageGroupFor(age)).toBe("minor");
    expect(ageDefaults(age)).toEqual(EMPTY_CRITICAL_THRESHOLDS);
  });

  it("verwendet ab dem 18. Geburtstag die Erwachsenen-Ausgangswerte", () => {
    const age = calculatePatientAge("02.08.2008", NOW);
    expect(ageGroupFor(age)).toBe("adult");
    expect(ageDefaults(age)).toEqual(ADULT_CRITICAL_THRESHOLDS);
  });

  it("ordnet 65 Jahre der 65+-Gruppe mit Erwachsenenwerten zu", () => {
    const age = calculatePatientAge("02.08.1961", NOW);
    expect(ageGroupFor(age)).toBe("older-adult");
    expect(ageDefaults(age)).toEqual(ADULT_CRITICAL_THRESHOLDS);
  });
});

describe("exakte kritische Grenzvergleiche", () => {
  it("wertet SpO₂ 89 kritisch und 90 nicht kritisch", () => {
    expect(isCritical(scalar("spo2", 89))).toBe(true);
    expect(isCritical(scalar("spo2", 90))).toBe(false);
  });

  it("wertet MAP 64 kritisch und 65 nicht kritisch", () => {
    expect(isCritical(nibp(120, 64, 70))).toBe(true);
    expect(isCritical(nibp(120, 65, 70))).toBe(false);
  });

  it("wertet Systolisch 89 kritisch und 90 nicht kritisch", () => {
    expect(isCritical(nibp(89, 70, 60))).toBe(true);
    expect(isCritical(nibp(90, 70, 60))).toBe(false);
  });

  it("wertet Systolisch 181 kritisch und 180 nicht kritisch", () => {
    expect(isCritical(nibp(181, 100, 80))).toBe(true);
    expect(isCritical(nibp(180, 100, 80))).toBe(false);
  });

  it("wertet Diastolisch 121 kritisch und 120 nicht kritisch", () => {
    expect(isCritical(nibp(130, 100, 121))).toBe(true);
    expect(isCritical(nibp(130, 100, 120))).toBe(false);
  });

  it("wertet Herzfrequenz 49 kritisch und 50 nicht kritisch", () => {
    expect(isCritical(scalar("heartRate", 49))).toBe(true);
    expect(isCritical(scalar("heartRate", 50))).toBe(false);
  });

  it("wertet Herzfrequenz 150 bereits kritisch", () => {
    expect(isCritical(scalar("heartRate", 150))).toBe(true);
    expect(isCritical(scalar("heartRate", 149))).toBe(false);
  });

  it("wertet Temperatur 35,9 kritisch", () => {
    expect(isCritical(scalar("temperature", 35.9))).toBe(true);
  });

  it("wertet Temperatur 38,5 bereits kritisch", () => {
    expect(isCritical(scalar("temperature", 38.5))).toBe(true);
    expect(isCritical(scalar("temperature", 38.4))).toBe(false);
  });
});

describe("Temperaturtrend und optionale Regeln", () => {
  it("warnt bei genau 0,5 °C Anstieg nicht", () => {
    const measurements = [scalar("temperature", 36.5, T0, "base"), scalar("temperature", 37, T0 + 10 * 60_000, "current")];
    expect(deriveCriticalWarnings(measurements, { ...EMPTY_CRITICAL_THRESHOLDS, temperatureRiseDelta: 0.5, temperatureRiseWindowMinutes: 15 })).toHaveLength(0);
  });

  it("warnt bei 0,6 °C Anstieg innerhalb von 15 Minuten", () => {
    const measurements = [scalar("temperature", 36.5, T0, "base"), scalar("temperature", 37.1, T0 + 10 * 60_000, "current")];
    expect(deriveCriticalWarnings(measurements, { ...EMPTY_CRITICAL_THRESHOLDS, temperatureRiseDelta: 0.5, temperatureRiseWindowMinutes: 15 })).toEqual([
      expect.objectContaining({ measurementId: "current", reasons: [expect.stringContaining("mehr als 0,5")] }),
    ]);
  });

  it("warnt ohne ältere Messung im Zeitfenster nicht", () => {
    const measurements = [scalar("temperature", 36.5, T0, "old"), scalar("temperature", 39, T0 + 16 * 60_000, "current")];
    expect(deriveCriticalWarnings(measurements, { ...EMPTY_CRITICAL_THRESHOLDS, temperatureRiseDelta: 0.5, temperatureRiseWindowMinutes: 15 })).toHaveLength(0);
  });

  it("verwendet im Zeitfenster die chronologisch früheste Messung", () => {
    const measurements = [
      scalar("temperature", 36.5, T0, "early"),
      scalar("temperature", 37, T0 + 5 * 60_000, "later"),
      scalar("temperature", 37.2, T0 + 10 * 60_000, "current"),
    ];
    expect(deriveCriticalWarnings(measurements, { ...EMPTY_CRITICAL_THRESHOLDS, temperatureRiseDelta: 0.5, temperatureRiseWindowMinutes: 15 }).at(-1)?.measurementId).toBe("current");
  });

  it("deaktiviert eine einzelne leere Schwelle unabhängig", () => {
    const thresholds = { ...ADULT_CRITICAL_THRESHOLDS, spo2Lower: null };
    expect(deriveCriticalWarnings([scalar("spo2", 10), scalar("heartRate", 150)], thresholds)).toEqual([
      expect.objectContaining({ kind: "heartRate" }),
    ]);
  });

  it("erzeugt bei vollständig leeren Schwellen keine Hinweise", () => {
    expect(deriveCriticalWarnings([scalar("spo2", 1), nibp(1, 1, 999), scalar("heartRate", 999), scalar("temperature", 99)], EMPTY_CRITICAL_THRESHOLDS)).toHaveLength(0);
  });

  it("reagiert unmittelbar auf benutzerdefinierte Schwellen", () => {
    const measurement = scalar("spo2", 92);
    expect(deriveCriticalWarnings([measurement], ADULT_CRITICAL_THRESHOLDS)).toHaveLength(0);
    expect(deriveCriticalWarnings([measurement], { ...ADULT_CRITICAL_THRESHOLDS, spo2Lower: 93 })).toHaveLength(1);
  });

  it("listet bei NIBP alle gleichzeitig ausgelösten Gründe", () => {
    const warning = deriveCriticalWarnings([nibp(85, 60, 130)], ADULT_CRITICAL_THRESHOLDS)[0];
    expect(warning.reasons).toHaveLength(3);
    expect(warning.tooltip).toContain("MAP");
    expect(warning.tooltip).toContain("Systolischer");
    expect(warning.tooltip).toContain("Diastolischer");
  });

  it("validiert logische Wertebereiche, ohne leere Felder zu beanstanden", () => {
    expect(validateCriticalThresholds(EMPTY_CRITICAL_THRESHOLDS)).toEqual({});
    expect(validateCriticalThresholds({ ...ADULT_CRITICAL_THRESHOLDS, systolicLower: 181 })).toHaveProperty("systolicUpper");
    expect(validateCriticalThresholds({ ...ADULT_CRITICAL_THRESHOLDS, temperatureRiseDelta: 0 })).toHaveProperty("temperatureRiseDelta");
    expect(validateCriticalThresholds({ ...ADULT_CRITICAL_THRESHOLDS, temperatureRiseWindowMinutes: -1 })).toHaveProperty("temperatureRiseWindowMinutes");
  });
});
