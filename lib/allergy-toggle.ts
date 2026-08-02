import type { PatientBaseData } from "../types/patient";

export const NO_KNOWN_ALLERGIES_TEXT = "Keine Allergien bekannt";

export function noKnownAllergiesPatch(
  data: Pick<PatientBaseData, "allergies" | "noKnownAllergies">,
  confirmedRemoval: boolean,
): Pick<PatientBaseData, "allergies" | "noKnownAllergies"> | null {
  if (data.noKnownAllergies) return { noKnownAllergies: false, allergies: "" };
  if (data.allergies.trim() && !confirmedRemoval) return null;
  return { noKnownAllergies: true, allergies: NO_KNOWN_ALLERGIES_TEXT };
}
