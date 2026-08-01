"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { DatePicker, Input } from "antd";
import type { GetRef, InputRef } from "antd";
import { CalendarOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { DATE_PLACEHOLDER } from "../lib/constants";
import { applyDateMask, parseDeDate, toDeDate } from "../lib/date-utils";
import styles from "./DateField.module.css";

type PickerRef = GetRef<typeof DatePicker>;

interface Props {
  id: string;
  value: string; // Roh-String "TT.MM.JJJJ" (auch unvollstaendig)
  onChange: (raw: string) => void;
  enforceYearCentury?: boolean;
  disabledDate?: (current: Dayjs) => boolean;
  ariaInvalid?: boolean;
  testId?: string;
  showTodayShortcut?: boolean;
}

/**
 * Datumsfeld mit maskierter Texteingabe (automatische Punkte, Teilangaben bleiben
 * erhalten) und einem Kalender-Popup ueber das Kalendersymbol. Das eigentliche
 * AntD-DatePicker dient nur dem Kalender; das sichtbare Feld ist ein normales Input.
 */
export function DateField({
  id,
  value,
  onChange,
  enforceYearCentury = false,
  disabledDate,
  ariaInvalid,
  testId,
  showTodayShortcut = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<InputRef>(null);
  const pickerRef = useRef<PickerRef>(null);
  const pendingCursor = useRef<number | null>(null);

  // Das versteckte Kalender-Input aus der Tab-Reihenfolge nehmen.
  useEffect(() => {
    const inner = pickerRef.current?.nativeElement?.querySelector("input");
    if (inner) inner.setAttribute("tabindex", "-1");
  }, []);

  // Cursor nach dem Maskieren wiederherstellen (kein Springen ans Ende).
  useLayoutEffect(() => {
    if (pendingCursor.current !== null && inputRef.current?.input) {
      const pos = pendingCursor.current;
      inputRef.current.input.setSelectionRange(pos, pos);
      pendingCursor.current = null;
    }
  }, [value]);

  const handleInput = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const cursor = e.target.selectionStart ?? raw.length;
    const isDeletion = raw.length < value.length;
    const masked = applyDateMask(raw, cursor, { enforceYearCentury, isDeletion });
    pendingCursor.current = masked.cursor;
    onChange(masked.value);
  };

  const handlePick = (picked: Dayjs | null) => {
    onChange(picked ? toDeDate(picked) : "");
    setOpen(false);
  };

  const openCalendar = () => setOpen(true);
  const onIconKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  };
  const keepFocus = (e: MouseEvent<HTMLSpanElement>) => e.preventDefault();

  return (
    <div className={styles.dateField} ref={containerRef}>
      <Input
        id={id}
        ref={inputRef}
        data-testid={testId}
        value={value}
        onChange={handleInput}
        placeholder={DATE_PLACEHOLDER}
        inputMode="numeric"
        maxLength={10}
        autoComplete="off"
        aria-invalid={ariaInvalid || undefined}
        suffix={
          <span
            role="button"
            aria-label="Kalender öffnen"
            tabIndex={0}
            className={styles.calendarIcon}
            onMouseDown={keepFocus}
            onClick={openCalendar}
            onKeyDown={onIconKeyDown}
          >
            <CalendarOutlined />
          </span>
        }
      />
      <DatePicker
        ref={pickerRef}
        className={styles.hiddenPicker}
        open={open}
        onOpenChange={setOpen}
        value={parseDeDate(value)}
        defaultPickerValue={showTodayShortcut ? dayjs() : undefined}
        onChange={handlePick}
        // Nur das Datum weiterreichen – rc-picker uebergibt einen zweiten Info-Parameter,
        // der sonst faelschlich als "now" der Helfer interpretiert wuerde.
        disabledDate={disabledDate ? (current) => disabledDate(current) : undefined}
        allowClear={false}
        inputReadOnly
        aria-hidden
      />
    </div>
  );
}
