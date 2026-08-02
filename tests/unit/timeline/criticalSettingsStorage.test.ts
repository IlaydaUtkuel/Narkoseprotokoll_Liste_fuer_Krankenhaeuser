import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ADULT_CRITICAL_THRESHOLDS, EMPTY_CRITICAL_THRESHOLDS } from "@/lib/timeline/criticalValues";
import {
  CRITICAL_SETTINGS_PREFIX,
  clearCriticalSettings,
  createAutomaticCriticalSettings,
  loadCriticalSettings,
  saveCriticalSettings,
  syncCriticalSettingsBirthDate,
} from "@/lib/timeline/criticalSettingsStorage";

const TODAY = new Date(2026, 7, 2);

describe("separater Critical-UI-Support-Speicher", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("legt Erwachsenenwerte case-ID-bezogen an und lädt sie nach Reload", () => {
    const created = createAutomaticCriticalSettings("case-a", "02.08.2000", TODAY);
    saveCriticalSettings(created);
    expect(loadCriticalSettings("case-a", "02.08.2000", TODAY)).toEqual(created);
    expect(localStorage.getItem(`${CRITICAL_SETTINGS_PREFIX}case-a`)).toContain("spo2Lower");
  });

  it("legt bei 17 Jahren leere Werte an", () => {
    expect(createAutomaticCriticalSettings("case-a", "03.08.2008", TODAY).thresholds).toEqual(EMPTY_CRITICAL_THRESHOLDS);
  });

  it("legt bei 18 und 65 Jahren Erwachsenenwerte an", () => {
    expect(createAutomaticCriticalSettings("case-a", "02.08.2008", TODAY).thresholds).toEqual(ADULT_CRITICAL_THRESHOLDS);
    expect(createAutomaticCriticalSettings("case-b", "02.08.1961", TODAY)).toMatchObject({ ageGroup: "older-adult", thresholds: ADULT_CRITICAL_THRESHOLDS });
  });

  it("passt automatische Werte beim Altersgruppenwechsel an", () => {
    saveCriticalSettings(createAutomaticCriticalSettings("case-a", "03.08.2008", TODAY));
    expect(syncCriticalSettingsBirthDate("case-a", "03.08.2008", "02.08.2008", TODAY)).toMatchObject({ source: "automatic", thresholds: ADULT_CRITICAL_THRESHOLDS, ageChangedNotice: false });
  });

  it("überschreibt benutzerdefinierte Werte bei Geburtsdatumkorrektur nicht", () => {
    saveCriticalSettings({ ...createAutomaticCriticalSettings("case-a", "03.08.2008", TODAY), source: "custom", thresholds: { ...EMPTY_CRITICAL_THRESHOLDS, spo2Lower: 88 } });
    expect(syncCriticalSettingsBirthDate("case-a", "03.08.2008", "02.08.2008", TODAY)).toMatchObject({ source: "custom", thresholds: { spo2Lower: 88 }, ageChangedNotice: true });
  });

  it("verwendet für eine neue case ID keine alten Custom-Werte", () => {
    saveCriticalSettings({ ...createAutomaticCriticalSettings("old", "02.08.2000", TODAY), source: "custom", thresholds: { ...ADULT_CRITICAL_THRESHOLDS, spo2Lower: 77 } });
    expect(loadCriticalSettings("new", "02.08.2000", TODAY)).toMatchObject({ source: "automatic", thresholds: { spo2Lower: 90 } });
  });

  it("entfernt beim Fallabschluss nur die zum alten Fall gehörenden Werte", () => {
    saveCriticalSettings(createAutomaticCriticalSettings("old", "02.08.2000", TODAY));
    saveCriticalSettings(createAutomaticCriticalSettings("new", "02.08.2000", TODAY));
    clearCriticalSettings("old");
    expect(localStorage.getItem(`${CRITICAL_SETTINGS_PREFIX}old`)).toBeNull();
    expect(localStorage.getItem(`${CRITICAL_SETTINGS_PREFIX}new`)).not.toBeNull();
  });
});
