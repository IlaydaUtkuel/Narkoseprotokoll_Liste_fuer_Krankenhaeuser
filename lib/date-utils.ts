import dayjs, { type Dayjs } from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { DATE_FORMAT, TEXT } from "./constants";

dayjs.extend(customParseFormat);

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Baut aus reinen Ziffern das deutsche Format "TT.MM.JJJJ". `trailingDot` ergaenzt
 * nach einem vollstaendigen Tag bzw. Monat automatisch einen Punkt (nur beim Tippen,
 * nicht beim Loeschen, damit Backspace natuerlich funktioniert).
 */
export function formatDeDate(digits: string, trailingDot: boolean): string {
  const d = digits.slice(0, 8);
  const day = d.slice(0, 2);
  const month = d.slice(2, 4);
  const year = d.slice(4, 8);
  let out = day;
  if (d.length > 2 || (d.length === 2 && trailingDot)) out += ".";
  out += month;
  if (d.length > 4 || (d.length === 4 && trailingDot)) out += ".";
  out += year;
  return out;
}

/**
 * Fuer Geburtsdaten: sind zwei Jahresziffern vorhanden und weder 19 noch 20, werden
 * weitere Ziffern blockiert. Tag und Monat sowie die zwei Jahresziffern bleiben erhalten.
 */
export function clampCentury(digits: string, enforce: boolean): string {
  if (enforce && digits.length >= 6) {
    const prefix = digits.slice(4, 6);
    if (prefix !== "19" && prefix !== "20") return digits.slice(0, 6);
  }
  return digits;
}

interface MaskOptions {
  enforceYearCentury?: boolean;
  isDeletion?: boolean;
}

/**
 * Wendet die Datumsmaske auf eine Eingabe an und berechnet die neue Cursor-Position,
 * damit der Cursor beim Bearbeiten nicht unkontrolliert ans Ende springt.
 */
export function applyDateMask(
  rawInput: string,
  cursor: number,
  { enforceYearCentury = false, isDeletion = false }: MaskOptions = {},
): { value: string; cursor: number } {
  const digitsBeforeCursor = onlyDigits(rawInput.slice(0, cursor)).length;
  const digits = clampCentury(onlyDigits(rawInput).slice(0, 8), enforceYearCentury);
  const value = formatDeDate(digits, !isDeletion);

  let seen = 0;
  let newCursor = value.length;
  for (let i = 0; i < value.length; i += 1) {
    if (seen === digitsBeforeCursor) {
      newCursor = i;
      break;
    }
    if (/\d/.test(value[i])) seen += 1;
  }
  if (value[newCursor] === ".") newCursor += 1;
  return { value, cursor: Math.min(newCursor, value.length) };
}

/** Vollstaendiges, gueltiges Datum -> Dayjs, sonst null. */
export function parseDeDate(raw: string): Dayjs | null {
  if (onlyDigits(raw).length !== 8) return null;
  const parsed = dayjs(raw, DATE_FORMAT, true);
  return parsed.isValid() ? parsed : null;
}

export function isCompleteDate(raw: string): boolean {
  return onlyDigits(raw).length === 8;
}

/** Prueft den Monat getrennt, damit auch importierte Rohwerte streng bleiben. */
export function validateDateMonth(raw: string): string | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length > 3) return TEXT.errorDateMonth;
  if (parts.length < 2 || parts[1] === "") return null;
  const month = parts[1];
  if (!/^\d{1,2}$/.test(month)) return TEXT.errorDateMonth;
  const numericMonth = Number(month);
  return Number.isInteger(numericMonth) && numericMonth >= 1 && numericMonth <= 12
    ? null
    : TEXT.errorDateMonth;
}

export function toDeDate(value: Dayjs): string {
  return value.format(DATE_FORMAT);
}

/** Lokales Kalenderdatum ohne UTC-Konvertierung (verhindert Tagesverschiebungen). */
export function localTodayDeDate(now: Date = new Date()): string {
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${now.getFullYear()}`;
}

/**
 * Migriert einen gespeicherten Datumswert in das sichtbare Raw-Format "TT.MM.JJJJ".
 * Unterstuetzt Alt-Werte im ISO-Format "YYYY-MM-DD" und bewahrt Teilangaben.
 */
export function migrateDateValue(value: unknown): string {
  if (typeof value !== "string") return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  return value.replace(/[^\d.]/g, "").slice(0, 10);
}

/**
 * Validierung Geburtsdatum: Jahr 1900..aktuelles Jahr, Praefix 19/20, nicht in der
 * Zukunft. Unvollstaendige Eingaben liefern keinen Fehler.
 */
export function validateBirthDate(raw: string, now: Dayjs = dayjs()): string | null {
  const monthError = validateDateMonth(raw);
  if (monthError) return monthError;
  const digits = onlyDigits(raw);
  if (digits.length === 0) return null;
  if (digits.length >= 6) {
    const prefix = digits.slice(4, 6);
    if (prefix !== "19" && prefix !== "20") return TEXT.errorBirthYearPrefix;
  }
  if (digits.length < 8) return TEXT.errorDateIncomplete;
  const parsed = parseDeDate(raw);
  if (!parsed) return TEXT.errorDateInvalid;
  const year = parsed.year();
  if (year < 1900 || year > now.year()) return TEXT.errorBirthYearRange;
  if (parsed.isAfter(now, "day")) return TEXT.errorBirthFuture;
  return null;
}

/**
 * Validierung OP-Datum: fruehestens heute minus sieben Tage, Zukunft erlaubt.
 * Unvollstaendige Eingaben liefern keinen Fehler.
 */
export function validateOpDate(raw: string, now: Dayjs = dayjs()): string | null {
  const monthError = validateDateMonth(raw);
  if (monthError) return monthError;
  const digits = onlyDigits(raw);
  if (digits.length === 0) return null;
  if (digits.length < 8) return TEXT.errorDateIncomplete;
  const parsed = parseDeDate(raw);
  if (!parsed) return TEXT.errorDateInvalid;
  const earliest = now.subtract(7, "day").startOf("day");
  if (parsed.startOf("day").isBefore(earliest)) return TEXT.errorOpDatePast;
  return null;
}

/** disabledDate-Helfer fuer den Geburtsdatum-Kalender. */
export function isBirthDateDisabled(current: Dayjs, now: Dayjs = dayjs()): boolean {
  return current.isAfter(now, "day") || current.year() < 1900;
}

/** disabledDate-Helfer fuer den OP-Datum-Kalender (aelter als heute minus 7 Tage). */
export function isOpDateDisabled(current: Dayjs, now: Dayjs = dayjs()): boolean {
  return current.isBefore(now.subtract(7, "day").startOf("day"), "day");
}
