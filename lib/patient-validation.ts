import type { PatientBaseData, WeightUnit } from "../types/patient";
import { createEmptyPatientData } from "./constants";
import { migrateDateValue } from "./date-utils";

const ASA_VALUES = ["I", "II", "III", "IV"] as const;
type AsaValue = (typeof ASA_VALUES)[number];

function isAsaValue(value: unknown): value is AsaValue {
  return typeof value === "string" && (ASA_VALUES as readonly string[]).includes(value);
}

function isWeightUnit(value: unknown): value is WeightUnit {
  return value === "kg" || value === "lbs";
}

/**
 * Nimmt einen beliebigen (z.B. aus JSON geparsten) Wert entgegen und liefert ein
 * sauberes PatientBaseData-Objekt. Ungueltige Einzelfelder werden auf sichere
 * Standardwerte zurueckgesetzt. Ist der Wert ueberhaupt kein Objekt, wird null
 * zurueckgegeben. Diese Funktion wirft nie.
 *
 * Datenmigration:
 * - Datumsfelder werden ueber migrateDateValue geladen: bestehende ISO-Werte
 *   ("YYYY-MM-DD") werden in das sichtbare Format "TT.MM.JJJJ" umgewandelt,
 *   Teilangaben bleiben erhalten.
 * - Fehlt das neue Feld weightUnit (aeltere Daten), wird "kg" verwendet.
 */
export function parsePatientData(raw: unknown): PatientBaseData | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const base = createEmptyPatientData();

  return {
    patientName: typeof o.patientName === "string" ? o.patientName : base.patientName,
    birthDate: migrateDateValue(o.birthDate),
    procedure: typeof o.procedure === "string" ? o.procedure : base.procedure,
    operationDate: migrateDateValue(o.operationDate),
    bodyWeightKg:
      typeof o.bodyWeightKg === "number" && Number.isFinite(o.bodyWeightKg)
        ? o.bodyWeightKg
        : null,
    weightUnit: isWeightUnit(o.weightUnit) ? o.weightUnit : "kg",
    asaClass: isAsaValue(o.asaClass) ? o.asaClass : null,
    mallampatiClass: isAsaValue(o.mallampatiClass) ? o.mallampatiClass : null,
    allergies: typeof o.allergies === "string" ? o.allergies : base.allergies,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : null,
  };
}
