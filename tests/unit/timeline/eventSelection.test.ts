import { describe, expect, it } from "vitest";
import { toggleEventSelection } from "@/lib/timeline/eventSelection";

describe("Ereignissymbol-Auswahl", () => {
  it("waehlt beim ersten Klick und entfernt dieselbe Auswahl beim zweiten", () => {
    expect(toggleEventSelection(null, "incision")).toBe("incision");
    expect(toggleEventSelection("incision", "incision")).toBeNull();
  });

  it("wechselt atomar auf ein anderes Symbol", () => {
    expect(toggleEventSelection("incision", "suture")).toBe("suture");
  });
});
