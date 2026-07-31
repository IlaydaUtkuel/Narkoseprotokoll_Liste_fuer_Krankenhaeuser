import type { PatientBaseData, PatientField } from "../types/patient";

// Eindeutiger, versionierter localStorage-Schluessel.
export const STORAGE_KEY = "sikant-anesthesia-demo.patient-base-data.v1";

// Debounce-Dauer pro Feld in Millisekunden (Anforderung: 2,5 Sekunden).
export const AUTOSAVE_DELAY_MS = 2500;

// Alle sichtbaren Texte zentral gehalten, damit UI und Tests exakt uebereinstimmen.
export const TEXT = {
  pageTitle: "Basisdaten des Narkosefalls",
  subtitle: "Demonstration – bitte ausschließlich fiktive Daten eingeben.",
  fieldSaving: "Wird gespeichert …",
  fieldSaved: "✓ Gespeichert",
  fieldError: "Speichern fehlgeschlagen",
  globalSaved: "✓ Alles dauerhaft automatisch gespeichert",
  globalPending: "Änderungen werden automatisch gespeichert …",
  globalError: "Speichern fehlgeschlagen – bitte erneut versuchen.",
  offline: "Offline – Änderungen werden lokal gespeichert",
  removeButton: "Alle Angaben entfernen",
  removeConfirmTitle: "Möchtest du wirklich alle gespeicherten Angaben entfernen?",
  removeConfirmBody:
    "Diese Aktion entfernt alle lokal in diesem Browser gespeicherten Angaben dauerhaft. Sie kann nicht rückgängig gemacht werden.",
  removeConfirmOk: "Endgültig entfernen",
  removeConfirmCancel: "Abbrechen",
  removedSuccess: "Alle Angaben wurden entfernt.",
  weiterButton: "Okay und Weiter",
  // Datumsvalidierung.
  errorBirthYearPrefix: "Das Geburtsjahr muss mit 19 oder 20 beginnen.",
  errorBirthYearRange: "Das Geburtsjahr muss zwischen 1900 und dem aktuellen Jahr liegen.",
  errorBirthFuture: "Das Geburtsdatum darf nicht in der Zukunft liegen.",
  errorOpDatePast: "Das OP-Datum darf höchstens sieben Tage zurückliegen.",
  errorDateInvalid: "Bitte ein gültiges Datum eingeben.",
} as const;

// Auswahlwerte fuer die Gewichtseinheit.
export const WEIGHT_UNIT_OPTIONS = [
  { label: "kg", value: "kg" },
  { label: "lbs", value: "lbs" },
] as const;

// Platzhalter fuer die Datumsfelder.
export const DATE_PLACEHOLDER = "TT.MM.JJJJ";

// Auswahlwerte fuer die ASA-Klasse: Anzeige "ASA I", gespeicherter Wert "I".
export const ASA_OPTIONS = [
  { label: "ASA I", value: "I" },
  { label: "ASA II", value: "II" },
  { label: "ASA III", value: "III" },
  { label: "ASA IV", value: "IV" },
] as const;

// Auswahlwerte fuer die Mallampati-Klasse: Anzeige "Klasse I", gespeicherter Wert "I".
export const MALLAMPATI_OPTIONS = [
  { label: "Klasse I", value: "I" },
  { label: "Klasse II", value: "II" },
  { label: "Klasse III", value: "III" },
  { label: "Klasse IV", value: "IV" },
] as const;

// Beschriftungen exakt in der geforderten Reihenfolge.
export const FIELD_LABELS: Record<PatientField, string> = {
  patientName: "Patient/-in:",
  birthDate: "Geburtsdatum:",
  procedure: "Eingriff:",
  operationDate: "OP-Datum:",
  bodyWeightKg: "Körpergewicht:",
  asaClass: "ASA-Klasse:",
  mallampatiClass: "Mallampati-Klasse:",
  allergies: "Allergien:",
};

// Reihenfolge der Felder als stabile Liste.
export const FIELD_ORDER: PatientField[] = [
  "patientName",
  "birthDate",
  "procedure",
  "operationDate",
  "bodyWeightKg",
  "asaClass",
  "mallampatiClass",
  "allergies",
];

// Anzeigeformat fuer Datumsfelder (deutsches Format).
export const DATE_FORMAT = "DD.MM.YYYY";

// Leeres, gueltiges Datenobjekt.
export function createEmptyPatientData(): PatientBaseData {
  return {
    patientName: "",
    birthDate: "",
    procedure: "",
    operationDate: "",
    bodyWeightKg: null,
    weightUnit: "kg",
    asaClass: null,
    mallampatiClass: null,
    allergies: "",
    updatedAt: null,
  };
}
