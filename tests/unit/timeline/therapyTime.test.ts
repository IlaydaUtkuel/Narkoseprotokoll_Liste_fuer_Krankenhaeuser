import { describe, expect, it } from "vitest";
import {
  durationMinutesBetween,
  endFromDuration,
  isNextLocalDay,
  resolveEndFromClock,
  validateTherapyEnd,
} from "@/lib/timeline/therapyTime";

describe("Therapie-Zeitmodell", () => {
  const start = new Date(2026, 7, 1, 23, 45, 0).getTime();

  it("interpretiert 23:45 → 00:32 sichtbar als nächsten lokalen Tag", () => {
    const end = resolveEndFromClock(start, { hour: 0, minute: 32 });
    expect(new Date(end).getDate()).toBe(2);
    expect(isNextLocalDay(start, end)).toBe(true);
    expect(durationMinutesBetween(start, end)).toBe(47);
  });

  it("berechnet Ende im Dauer-Modus", () => {
    expect(endFromDuration(start, 47)).toBe(resolveEndFromClock(start, { hour: 0, minute: 32 }));
  });

  it("unterstützt ein manuell ausgewähltes Ende mehrere Tage später", () => {
    const end = resolveEndFromClock(start, { hour: 9, minute: 15 }, { year: 2026, month: 7, day: 4 });
    expect(new Date(end).getDate()).toBe(4);
    expect(end).toBeGreaterThan(start);
  });

  it("akzeptiert ongoing nur ohne festes Ende und lehnt Ende vor Beginn ab", () => {
    expect(validateTherapyEnd(start, null, true)).toBe(true);
    expect(validateTherapyEnd(start, start - 1, false)).toBe(false);
    expect(validateTherapyEnd(start, start + 1, false)).toBe(true);
  });
});
