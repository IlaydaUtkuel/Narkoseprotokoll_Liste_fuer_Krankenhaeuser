import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDebouncedFieldSave } from "@/hooks/useDebouncedFieldSave";

// Der Hook steuert nur die beruhigende Anzeige. Das eigentliche Speichern
// geschieht sofort im Formular (siehe patient-storage / PatientBaseDataForm).
describe("useDebouncedFieldSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("zeigt sofort 'saving' und erst nach 2,5 Sekunden 'saved'", () => {
    const { result } = renderHook(() => useDebouncedFieldSave());

    act(() => {
      result.current.reportSaving("patientName");
    });
    expect(result.current.statuses.patientName).toBe("saving");

    act(() => {
      vi.advanceTimersByTime(2499);
    });
    expect(result.current.statuses.patientName).toBe("saving");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.statuses.patientName).toBe("saved");
  });

  it("startet die Anzeige-Wartezeit bei weiterer Aenderung neu", () => {
    const { result } = renderHook(() => useDebouncedFieldSave());

    act(() => {
      result.current.reportSaving("procedure");
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    act(() => {
      result.current.reportSaving("procedure");
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.statuses.procedure).toBe("saving");

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.statuses.procedure).toBe("saved");
  });

  it("meldet einen Speicherfehler als Fehlerzustand", () => {
    const { result } = renderHook(() => useDebouncedFieldSave());

    act(() => {
      result.current.reportSaving("allergies");
    });
    act(() => {
      result.current.reportError("allergies");
    });
    expect(result.current.statuses.allergies).toBe("error");

    // Der Fehlerzustand darf nicht durch einen laufenden Timer ueberschrieben werden.
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.statuses.allergies).toBe("error");
  });

  it("separate Timer: ein Feld beeinflusst die Anzeige eines anderen nicht", () => {
    const { result } = renderHook(() => useDebouncedFieldSave());

    act(() => {
      result.current.reportSaving("patientName");
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    act(() => {
      result.current.reportSaving("procedure");
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.statuses.patientName).toBe("saved");
    expect(result.current.statuses.procedure).toBe("saving");
  });
});
