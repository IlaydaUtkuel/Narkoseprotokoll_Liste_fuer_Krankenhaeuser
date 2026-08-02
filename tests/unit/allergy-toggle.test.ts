import { describe, expect, it } from "vitest";
import { noKnownAllergiesPatch } from "@/lib/allergy-toggle";
import { localTodayDeDate } from "@/lib/date-utils";

describe("Basisdaten-Helfer", () => {
  it("schaltet Keine beim ersten und zweiten Auslösen eindeutig um", () => {
    const enabled = noKnownAllergiesPatch({ allergies: "", noKnownAllergies: false }, false);
    expect(enabled).toEqual({ allergies: "Keine Allergien bekannt", noKnownAllergies: true });
    expect(noKnownAllergiesPatch(enabled!, false)).toEqual({ allergies: "", noKnownAllergies: false });
  });

  it("löscht geschriebene Allergien nicht ohne Bestätigung", () => {
    expect(noKnownAllergiesPatch({ allergies: "Penicillin", noKnownAllergies: false }, false)).toBeNull();
    expect(noKnownAllergiesPatch({ allergies: "Penicillin", noKnownAllergies: false }, true))
      .toEqual({ allergies: "Keine Allergien bekannt", noKnownAllergies: true });
  });

  it("formatiert Heute aus lokalen Kalenderteilen statt über UTC", () => {
    expect(localTodayDeDate(new Date(2026, 7, 2, 0, 5, 0))).toBe("02.08.2026");
  });
});
