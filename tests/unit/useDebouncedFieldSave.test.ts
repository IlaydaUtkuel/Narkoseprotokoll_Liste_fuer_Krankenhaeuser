import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDebouncedFieldSave } from "@/hooks/useDebouncedFieldSave";

describe("useDebouncedFieldSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("speichert eine Feldaenderung erst nach 2,5 Sekunden", () => {
    const persist = vi.fn();
    const { result } = renderHook(() => useDebouncedFieldSave({ persist }));

    act(() => {
      result.current.scheduleSave("patientName");
    });
    expect(result.current.statuses.patientName).toBe("saving");

    act(() => {
      vi.advanceTimersByTime(2499);
    });
    expect(persist).not.toHaveBeenCalled();
    expect(result.current.statuses.patientName).toBe("saving");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(persist).toHaveBeenCalledTimes(1);
    expect(result.current.statuses.patientName).toBe("saved");
  });

  it("startet die Wartezeit bei weiterer Eingabe innerhalb der 2,5 Sekunden neu", () => {
    const persist = vi.fn();
    const { result } = renderHook(() => useDebouncedFieldSave({ persist }));

    act(() => {
      result.current.scheduleSave("procedure");
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    // Erneute Eingabe -> Timer beginnt von vorn.
    act(() => {
      result.current.scheduleSave("procedure");
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(persist).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(persist).toHaveBeenCalledTimes(1);
    expect(result.current.statuses.procedure).toBe("saved");
  });

  it("meldet einen Speicherfehler als Fehlerzustand", () => {
    const persist = vi.fn(() => {
      throw new Error("Speicher voll");
    });
    const { result } = renderHook(() => useDebouncedFieldSave({ persist }));

    act(() => {
      result.current.scheduleSave("allergies");
    });
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(result.current.statuses.allergies).toBe("error");
  });

  it("separate Timer: ein Feld beeinflusst den Timer eines anderen nicht", () => {
    const persist = vi.fn();
    const { result } = renderHook(() => useDebouncedFieldSave({ persist }));

    act(() => {
      result.current.scheduleSave("patientName");
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    // Zweites Feld aendern; darf den Timer des ersten nicht zuruecksetzen.
    act(() => {
      result.current.scheduleSave("procedure");
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    // patientName ist jetzt bei 2500 -> gespeichert; procedure noch nicht.
    expect(result.current.statuses.patientName).toBe("saved");
    expect(result.current.statuses.procedure).toBe("saving");
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
