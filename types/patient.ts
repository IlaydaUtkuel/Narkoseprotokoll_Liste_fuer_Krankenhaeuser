// Zentrales, klar typisiertes Datenmodell fuer die Basisdaten des Narkosefalls.

export type WeightUnit = "kg" | "lbs";

export interface PatientBaseData {
  patientName: string;
  // Roh-String im Format "TT.MM.JJJJ" (auch unvollstaendig, z.B. "21."), "" wenn leer.
  birthDate: string;
  procedure: string;
  // Roh-String im Format "TT.MM.JJJJ" (auch unvollstaendig), "" wenn leer.
  operationDate: string;
  bodyWeightKg: number | null;
  // Einheit fuer das Koerpergewicht (Standard "kg"). Keine automatische Umrechnung.
  weightUnit: WeightUnit;
  asaClass: "I" | "II" | "III" | "IV" | null;
  mallampatiClass: "I" | "II" | "III" | "IV" | null;
  allergies: string;
  // Expliziter Zustand; darf nicht nur aus dem sichtbaren Text abgeleitet werden.
  noKnownAllergies: boolean;
  updatedAt: string | null; // ISO-Zeitstempel des letzten erfolgreichen Speicherns
}

// Die acht bearbeitbaren Formularfelder (ohne Zeitstempel und ohne die Einheit,
// die visuell zum Gewichtsfeld gehoert).
export type PatientField = Exclude<
  keyof PatientBaseData,
  "updatedAt" | "weightUnit" | "noKnownAllergies"
>;

// Speicherstatus eines einzelnen Feldes.
export type FieldSaveStatus = "idle" | "saving" | "saved" | "error";
