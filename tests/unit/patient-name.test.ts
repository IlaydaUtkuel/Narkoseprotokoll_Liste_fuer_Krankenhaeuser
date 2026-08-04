import { describe, expect, it } from "vitest";
import { formatPersonName } from "@/lib/patient-name";

describe("formatPersonName", () => {
  it("schreibt jeden Namensteil gross und den Rest klein", () => {
    expect(formatPersonName("ilayda utkuel")).toBe("Ilayda Utkuel");
    expect(formatPersonName("ilayda utkuel sema narin")).toBe("Ilayda Utkuel Sema Narin");
  });

  it("korrigiert durchgehende Grossschreibung", () => {
    expect(formatPersonName("ILAYDA UTKUEL")).toBe("Ilayda Utkuel");
  });

  it("gross nach dem Leerzeichen bereits beim ersten Buchstaben des zweiten Namens", () => {
    // Genau der Tippverlauf: "Ilayda" + Leerzeichen + "u"
    expect(formatPersonName("Ilayda u")).toBe("Ilayda U");
    expect(formatPersonName("Ilayda ut")).toBe("Ilayda Ut");
    expect(formatPersonName("Ilayda utkuel")).toBe("Ilayda Utkuel");
  });

  it("beachtet Bindestrich und Apostroph als Trenner", () => {
    expect(formatPersonName("anna-maria o'brien")).toBe("Anna-Maria O'Brien");
  });

  it("laesst Laenge, Leerzeichen und Umlaute unveraendert", () => {
    expect(formatPersonName("özlem  şahin")).toBe("Özlem  Şahin");
    expect(formatPersonName("max ")).toBe("Max ");
    expect(formatPersonName("")).toBe("");
    const value = "mehmet can öz";
    expect(formatPersonName(value)).toHaveLength(value.length);
  });
});
