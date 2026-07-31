import type { PatientBaseData } from "../types/patient";
import { createEmptyPatientData } from "./constants";

const ASA_VALUES = ["I", "II", "III", "IV"] as const;
type AsaValue = (typeof ASA_VALUES)[number];

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isAsaValue(value: unknown): value is AsaValue {
  return typeof value === "string" && (ASA_VALUES as readonly string[]).includes(value);
}

/**
 * Nimmt einen beliebigen (z.B. aus JSON geparsten) Wert entgegen und liefert
 * ein sauberes PatientBaseData-Objekt. Ungueltige Einzelfelder werden auf ihren
 * leeren Standard zurueckgesetzt. Ist der Wert ueberhaupt kein Objekt, wird null
 * zurueckgegeben. Diese Funktion wirft nie.
 */
export function parsePatientData(raw: unknown): PatientBaseData | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const base = createEmptyPatientData();

  return {
    patientName: typeof o.patientName === "string" ? o.patientName : base.patientName,
    birthDate: isIsoDate(o.birthDate) ? o.birthDate : null,
    procedure: typeof o.procedure === "string" ? o.procedure : base.procedure,
    operationDate: isIsoDate(o.operationDate) ? o.operationDate : null,
    bodyWeightKg:
      typeof o.bodyWeightKg === "number" && Number.isFinite(o.bodyWeightKg)
        ? o.bodyWeightKg
        : null,
    asaClass: isAsaValue(o.asaClass) ? o.asaClass : null,
    mallampatiClass: isAsaValue(o.mallampatiClass) ? o.mallampatiClass : null,
    allergies: typeof o.allergies === "string" ? o.allergies : base.allergies,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : null,
  };
}
