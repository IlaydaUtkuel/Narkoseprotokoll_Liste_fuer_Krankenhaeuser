import { describe, expect, it } from "vitest";
import dayjs from "dayjs";
import {
  applyDateMask,
  isBirthDateDisabled,
  isOpDateDisabled,
  migrateDateValue,
  parseDeDate,
  validateBirthDate,
  validateOpDate,
} from "@/lib/date-utils";

function mask(raw: string, opts?: { enforceYearCentury?: boolean; isDeletion?: boolean }) {
  return applyDateMask(raw, raw.length, opts).value;
}

describe("applyDateMask (automatische Punkte)", () => {
  it("ergaenzt Punkte automatisch beim Tippen", () => {
    expect(mask("2")).toBe("2");
    expect(mask("21")).toBe("21.");
    expect(mask("211")).toBe("21.1");
    expect(mask("2112")).toBe("21.12.");
    expect(mask("21122026")).toBe("21.12.2026");
  });

  it("verhindert doppelte Punkte bei manueller Eingabe und beim Einfuegen", () => {
    expect(mask("21.12.2026")).toBe("21.12.2026");
    expect(mask("21122026")).toBe("21.12.2026");
  });

  it("fuegt beim Loeschen keinen Punkt erneut hinzu (natuerliches Backspace)", () => {
    expect(mask("21", { isDeletion: true })).toBe("21");
  });

  it("blockiert bei Geburtsdaten ein ungueltiges Jahrhundert (weder 19 noch 20)", () => {
    expect(mask("21121426", { enforceYearCentury: true })).toBe("21.12.14");
    expect(mask("21121985", { enforceYearCentury: true })).toBe("21.12.1985");
  });
});

describe("parseDeDate", () => {
  it("parst nur vollstaendige, gueltige Datumswerte", () => {
    expect(parseDeDate("21.12.2026")?.format("YYYY-MM-DD")).toBe("2026-12-21");
    expect(parseDeDate("21")).toBeNull();
    expect(parseDeDate("32.13.2020")).toBeNull();
  });
});

describe("migrateDateValue", () => {
  it("wandelt ISO in das DE-Format und bewahrt Teilangaben", () => {
    expect(migrateDateValue("1980-01-01")).toBe("01.01.1980");
    expect(migrateDateValue("21.12.")).toBe("21.12.");
    expect(migrateDateValue("21")).toBe("21");
    expect(migrateDateValue(null)).toBe("");
    expect(migrateDateValue("abc")).toBe("");
  });
});

describe("validateBirthDate", () => {
  const now = dayjs();

  it("erlaubt gueltige Jahre", () => {
    expect(validateBirthDate("01.01.1985", now)).toBeNull();
    expect(validateBirthDate("15.06.2000", now)).toBeNull();
  });

  it("gibt keine Meldung bei leerem Feld", () => {
    expect(validateBirthDate("", now)).toBeNull();
  });

  it("warnt bei unvollstaendiger Eingabe", () => {
    const incomplete = "Bitte das Datum vollständig eingeben (TT.MM.JJJJ).";
    expect(validateBirthDate("21", now)).toBe(incomplete);
    expect(validateBirthDate("21.12.", now)).toBe(incomplete);
  });

  it("verlangt ein Jahr mit 19 oder 20", () => {
    expect(validateBirthDate("01.01.1899", now)).toBe("Das Geburtsjahr muss mit 19 oder 20 beginnen.");
    expect(validateBirthDate("01.01.14", now)).toBe("Das Geburtsjahr muss mit 19 oder 20 beginnen.");
  });

  it("lehnt ein Jahr ausserhalb 1900..aktuelles Jahr ab", () => {
    const nextYear = now.add(1, "year").year();
    expect(validateBirthDate(`01.01.${nextYear}`, now)).toBe(
      "Das Geburtsjahr muss zwischen 1900 und dem aktuellen Jahr liegen.",
    );
  });

  it("lehnt ein zukuenftiges Geburtsdatum ab", () => {
    const future = now.add(1, "day");
    // Nur sinnvoll, wenn das Datum noch im aktuellen Jahr liegt.
    if (future.year() === now.year()) {
      expect(validateBirthDate(future.format("DD.MM.YYYY"), now)).toBe(
        "Das Geburtsdatum darf nicht in der Zukunft liegen.",
      );
    }
  });
});

describe("validateOpDate", () => {
  const now = dayjs();

  it("erlaubt heute, heute minus 7 Tage und zukuenftige Daten", () => {
    expect(validateOpDate(now.format("DD.MM.YYYY"), now)).toBeNull();
    expect(validateOpDate(now.subtract(7, "day").format("DD.MM.YYYY"), now)).toBeNull();
    expect(validateOpDate(now.add(30, "day").format("DD.MM.YYYY"), now)).toBeNull();
  });

  it("warnt bei leerem/unvollstaendigem OP-Datum korrekt", () => {
    expect(validateOpDate("", now)).toBeNull();
    expect(validateOpDate("21.12", now)).toBe("Bitte das Datum vollständig eingeben (TT.MM.JJJJ).");
  });

  it("lehnt Daten aelter als sieben Tage ab", () => {
    expect(validateOpDate(now.subtract(8, "day").format("DD.MM.YYYY"), now)).toBe(
      "Das OP-Datum darf höchstens sieben Tage zurückliegen.",
    );
    expect(validateOpDate(now.subtract(1, "month").format("DD.MM.YYYY"), now)).toBe(
      "Das OP-Datum darf höchstens sieben Tage zurückliegen.",
    );
  });
});

describe("disabledDate-Helfer", () => {
  const now = dayjs();

  it("Geburtsdatum: Zukunft deaktiviert", () => {
    expect(isBirthDateDisabled(now.add(1, "day"), now)).toBe(true);
    expect(isBirthDateDisabled(now.subtract(1, "day"), now)).toBe(false);
  });

  it("OP-Datum: aelter als heute minus 7 Tage deaktiviert", () => {
    expect(isOpDateDisabled(now.subtract(8, "day"), now)).toBe(true);
    expect(isOpDateDisabled(now.subtract(7, "day"), now)).toBe(false);
    expect(isOpDateDisabled(now.add(5, "day"), now)).toBe(false);
  });
});
