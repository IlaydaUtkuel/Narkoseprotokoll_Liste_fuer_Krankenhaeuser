import type {
  MedicationAdministrationType,
  TherapyUnit,
  TherapyUnitSystem,
} from "../../types/vitals";

export interface TherapyUnitOption extends TherapyUnit {
  category: "amount" | "weight" | "rate" | "count" | "concentration" | "custom";
  displayLabel: string;
}

function unit(
  code: string,
  displayLabel: string,
  category: TherapyUnitOption["category"],
  system: TherapyUnitSystem = "UCUM",
): TherapyUnitOption {
  return { label: code, code, system, isCustom: false, category, displayLabel };
}

const MEDICATION_AMOUNT = [
  unit("ng", "Nanogramm (ng)", "amount"),
  unit("µg", "Mikrogramm (µg)", "amount"),
  unit("mg", "Milligramm (mg)", "amount"),
  unit("g", "Gramm (g)", "amount"),
  unit("mmol", "Millimol (mmol)", "amount"),
  unit("mEq", "Milliäquivalent (mEq)", "amount"),
  unit("I.E.", "Internationale Einheit (I.E.)", "amount"),
  unit("mL", "Milliliter (mL)", "amount"),
  unit("L", "Liter (L)", "amount"),
];

const MEDICATION_COUNT = [
  "Tablette", "Kapsel", "Ampulle", "Durchstechflasche", "Hub", "Tropfen", "Zäpfchen",
].map((code) => unit(code, code, "count", "clinical-count"));

const WEIGHT_AMOUNT = ["ng/kg", "µg/kg", "mg/kg", "g/kg", "mmol/kg", "mEq/kg", "I.E./kg", "mL/kg"]
  .map((code) => unit(code, code, "weight"));

const MEDICATION_RATE = [
  "ng/min", "µg/min", "mg/min", "g/min", "I.E./min",
  "ng/h", "µg/h", "mg/h", "g/h", "I.E./h",
  "ng/kg/min", "µg/kg/min", "mg/kg/min",
  "ng/kg/h", "µg/kg/h", "mg/kg/h", "I.E./kg/h",
  "mL/min", "mL/h", "mL/kg/min", "mL/kg/h",
  "mmol/min", "mmol/h", "mEq/h",
].map((code) => unit(code, code, "rate"));

const INFUSION_AMOUNT = ["mL", "L", "mL/kg"].map((code) => unit(code, code, "amount"));
const INFUSION_RATE = ["mL/min", "mL/h", "mL/kg/min", "mL/kg/h", "L/h", "Tropfen/min"]
  .map((code) => unit(code, code, "rate", code === "Tropfen/min" ? "clinical-count" : "UCUM"));

export const CONCENTRATION_UNITS = [
  "ng/mL", "µg/mL", "mg/mL", "g/L", "mmol/mL", "mmol/L", "mEq/mL", "I.E./mL",
].map((code) => unit(code, code, "concentration"));

export const CUSTOM_UNIT_VALUE = "__custom__";

export function therapyUnitOptions(
  kind: "medication" | "infusion",
  administrationType: MedicationAdministrationType = "bolus",
): TherapyUnitOption[] {
  const standard = kind === "infusion"
    ? [...INFUSION_AMOUNT, ...INFUSION_RATE]
    : administrationType === "continuous"
      ? MEDICATION_RATE
      : [...MEDICATION_AMOUNT, ...WEIGHT_AMOUNT, ...MEDICATION_COUNT];
  return [
    ...standard,
    { label: "Andere Einheit", code: CUSTOM_UNIT_VALUE, system: "custom", isCustom: true, category: "custom", displayLabel: "Andere Einheit" },
  ];
}

export function standardUnitByCode(code: string): TherapyUnitOption | null {
  const normalized = code.trim().replace(/^ml$/i, "mL");
  const all = [
    ...MEDICATION_AMOUNT, ...MEDICATION_COUNT, ...WEIGHT_AMOUNT, ...MEDICATION_RATE,
    ...INFUSION_AMOUNT, ...INFUSION_RATE, ...CONCENTRATION_UNITS,
  ];
  return all.find((option) => option.code.toLocaleLowerCase("de-DE") === normalized.toLocaleLowerCase("de-DE")) ?? null;
}

export function migrateTherapyUnit(raw: unknown): TherapyUnit | null {
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    const value = raw as Record<string, unknown>;
    if (typeof value.label === "string" && typeof value.code === "string") {
      const system: TherapyUnitSystem = value.system === "UCUM" || value.system === "clinical-count" || value.system === "custom"
        ? value.system
        : "custom";
      return { label: value.label, code: value.code, system, isCustom: value.isCustom === true || system === "custom" };
    }
  }
  if (typeof raw !== "string" || !raw.trim()) return null;
  const match = standardUnitByCode(raw);
  return match
    ? { label: match.label, code: match.code, system: match.system, isCustom: false }
    : { label: raw.trim(), code: raw.trim(), system: "custom", isCustom: true };
}

export function createTherapyUnit(code: string, customLabel?: string): TherapyUnit | null {
  if (code === CUSTOM_UNIT_VALUE) {
    const label = customLabel?.trim();
    return label ? { label, code: label, system: "custom", isCustom: true } : null;
  }
  const match = standardUnitByCode(code);
  return match ? { label: match.label, code: match.code, system: match.system, isCustom: false } : null;
}
