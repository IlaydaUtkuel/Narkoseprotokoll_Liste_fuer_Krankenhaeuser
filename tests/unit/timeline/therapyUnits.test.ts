import { describe, expect, it } from "vitest";
import {
  CUSTOM_UNIT_VALUE,
  createTherapyUnit,
  migrateTherapyUnit,
  therapyUnitOptions,
} from "@/lib/timeline/therapyUnits";

describe("Therapie-Einheiten", () => {
  it("filtert Bolus, kontinuierliche Gabe und Infusion kontextabhängig", () => {
    const bolus = therapyUnitOptions("medication", "bolus").map((item) => item.code);
    const continuous = therapyUnitOptions("medication", "continuous").map((item) => item.code);
    const infusion = therapyUnitOptions("infusion").map((item) => item.code);
    expect(bolus).toContain("mg");
    expect(bolus).not.toContain("mg/h");
    expect(continuous).toContain("mg/h");
    expect(continuous).not.toContain("mg");
    expect(infusion).toContain("mL/h");
  });

  it("migriert bekannte Alttexte zu UCUM und bewahrt unbekannte als custom", () => {
    expect(migrateTherapyUnit("ml")).toMatchObject({ code: "mL", system: "UCUM", isCustom: false });
    expect(migrateTherapyUnit("klinische Spezialdosis")).toMatchObject({ label: "klinische Spezialdosis", system: "custom", isCustom: true });
  });

  it("erfordert bei Andere Einheit einen nichtleeren Text", () => {
    expect(createTherapyUnit(CUSTOM_UNIT_VALUE, "")).toBeNull();
    expect(createTherapyUnit(CUSTOM_UNIT_VALUE, "Pumpenhub")).toMatchObject({ label: "Pumpenhub", isCustom: true });
  });
});
