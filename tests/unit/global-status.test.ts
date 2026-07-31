import { describe, expect, it } from "vitest";
import { computeGlobalStatus } from "@/components/GlobalSaveStatus";

describe("computeGlobalStatus", () => {
  it("gilt ohne Feldstatus als gespeichert", () => {
    expect(computeGlobalStatus({})).toBe("saved");
  });

  it("zeigt 'pending', solange ein Feld noch speichert", () => {
    expect(computeGlobalStatus({ patientName: "saving" })).toBe("pending");
    expect(computeGlobalStatus({ patientName: "saved", procedure: "saving" })).toBe("pending");
  });

  it("ein Fehler ueberwiegt alles", () => {
    expect(computeGlobalStatus({ patientName: "saving", procedure: "error" })).toBe("error");
    expect(computeGlobalStatus({ patientName: "error" })).toBe("error");
  });

  it("gilt als gespeichert, wenn alle Felder gespeichert sind", () => {
    expect(computeGlobalStatus({ patientName: "saved", procedure: "saved" })).toBe("saved");
  });
});
