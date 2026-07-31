// Zentrales, klar typisiertes Datenmodell fuer die Basisdaten des Narkosefalls.

export interface PatientBaseData {
  patientName: string;
  birthDate: string | null; // ISO-Datum "YYYY-MM-DD"
  procedure: string;
  operationDate: string | null; // ISO-Datum "YYYY-MM-DD"
  bodyWeightKg: number | null;
  asaClass: "I" | "II" | "III" | "IV" | null;
  mallampatiClass: "I" | "II" | "III" | "IV" | null;
  allergies: string;
  updatedAt: string | null; // ISO-Zeitstempel des letzten erfolgreichen Speicherns
}

// Die acht bearbeitbaren Felder (ohne den technischen Zeitstempel).
export type PatientField = Exclude<keyof PatientBaseData, "updatedAt">;

// Speicherstatus eines einzelnen Feldes.
export type FieldSaveStatus = "idle" | "saving" | "saved" | "error";
