import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useDebouncedFieldSave } from "@/hooks/useDebouncedFieldSave";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("Sofortiger Speicherstatus", () => {
  it("zeigt bei reportSaved ohne Wartezeit 'saved'", () => {
    const { result } = renderHook(() => useDebouncedFieldSave());
    act(() => result.current.reportSaved("allergies"));
    expect(result.current.statuses.allergies).toBe("saved");
  });

  it("zeigt bei reportSaving weiterhin erst 'saving' und spaeter 'saved'", () => {
    const { result } = renderHook(() => useDebouncedFieldSave({ delay: 1000 }));
    act(() => result.current.reportSaving("patientName"));
    expect(result.current.statuses.patientName).toBe("saving");
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.statuses.patientName).toBe("saved");
  });

  it("bricht einen laufenden Wartetimer ab, wenn sofort gespeichert gemeldet wird", () => {
    const { result } = renderHook(() => useDebouncedFieldSave({ delay: 1000 }));
    act(() => result.current.reportSaving("allergies"));
    act(() => result.current.reportSaved("allergies"));
    expect(result.current.statuses.allergies).toBe("saved");
    // Der alte Timer darf den Status nicht mehr veraendern.
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.statuses.allergies).toBe("saved");
  });
});
