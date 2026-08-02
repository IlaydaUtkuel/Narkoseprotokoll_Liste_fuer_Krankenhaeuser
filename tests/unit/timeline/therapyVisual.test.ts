import { describe, expect, it } from "vitest";
import { therapyIntervalsAtTime, therapyVisual } from "@/components/vitals/TherapyLayers";
import type { InfusionEntry, MedicationEntry } from "@/types/vitals";

const START = 1_700_000_000_000;

const medication: MedicationEntry = {
  id: "med-1",
  kind: "medication",
  administrationType: "bolus",
  name: "Demo",
  startedAt: START,
  dose: 1,
  unit: { label: "mg", code: "mg", system: "UCUM", isCustom: false },
  concentration: null,
  endedAt: START + 20 * 60_000,
  ongoing: false,
  createdAt: START,
  updatedAt: START,
};

const infusion: InfusionEntry = {
  id: "inf-1",
  kind: "infusion",
  name: "Ringer",
  startedAt: START + 5 * 60_000,
  amount: 500,
  unit: { label: "mL", code: "mL", system: "UCUM", isCustom: false },
  concentration: null,
  endedAt: START + 35 * 60_000,
  ongoing: false,
  createdAt: START,
  updatedAt: START,
};

describe("Therapie-Hatch-Darstellung", () => {
  it("unterscheidet Medikamente und Infusionen nicht nur über Farbe", () => {
    const med = therapyVisual("medication", 0);
    const inf = therapyVisual("infusion", 0);
    const secondMedication = therapyVisual("medication", 1);
    expect(med.angle).not.toBe(inf.angle);
    expect(secondMedication.spacing).not.toBe(med.spacing);
    expect(secondMedication.strokeWidth).not.toBe(med.strokeWidth);
  });

  it("liefert für einen Zeitpunkt alle überlappenden expliziten Intervalle", () => {
    const items = therapyIntervalsAtTime(
      START + 10 * 60_000,
      [medication],
      [infusion],
      START + 40 * 60_000,
      null,
    );
    expect(items.map((item) => item.entry.id)).toEqual(["med-1", "inf-1"]);
  });
});
