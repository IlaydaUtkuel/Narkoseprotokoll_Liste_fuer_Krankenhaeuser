import { expect, test } from "@playwright/test";
import {
  beat,
  caseData,
  clickNibpMean,
  clickScalar,
  DEMO_DATE_DE,
  DEMO_PATIENT,
  dragNibpHandle,
  fillBasisdaten,
  measurementAt,
  prepareDemoPage,
  pressValueAtCheckpoint,
  startCaseAt,
  travelTo,
  ts,
} from "./demo-helpers";

/**
 * Kurzaufnahme 1: Basisdaten, Vitalwerte in der Grafik, Kontrollzeit-Modus und
 * Persistence nach einem echten Reload.
 *
 * Alle Messwerte entstehen aus der Zeigerposition, nicht aus getippten Zahlen.
 */
test("Demo 1: Basisdaten, Vitalwerte in der Grafik und Persistence nach Reload", async ({ page }) => {
  await prepareDemoPage(page);

  await test.step("Basisdaten des fiktiven Falls erfassen", async () => {
    await fillBasisdaten(page);
    await beat(page, 900);
    await page.getByTestId("weiter").click();
    await expect(page).toHaveURL(/\/dokumentation$/);
    await expect(page.getByTestId("case-header")).toContainText(DEMO_PATIENT.procedure);
  });

  await test.step("Dokumentation starten", async () => {
    // Vor dem Start weist die Anwendung auf den leeren Fall hin.
    await expect(page.getByTestId("timeline-empty-state")).toBeVisible();
    await startCaseAt(page, "10:00:00");
    await travelTo(page, "10:00:50");
    await beat(page);
  });

  await test.step("Temperatur und Blutdruck per Maus dokumentieren", async () => {
    const temperature = await clickScalar(page, "temperature", 36.7, { clock: "10:00:00" });
    expect(temperature.saved.time).toBe(ts("10:00:00"));
    // Der erste Eintrag laesst den Leerhinweis verschwinden.
    await expect(page.getByTestId("timeline-empty-state")).toHaveCount(0);

    const nibp = await clickNibpMean(page, 93, { clock: "10:00:00" });
    expect(nibp.time).toBe(ts("10:00:00"));

    // Systolisch und Diastolisch entstehen durch sichtbares Ziehen der Griffe.
    const systolic = await dragNibpHandle(page, nibp.id, "systolic", 122);
    const diastolic = await dragNibpHandle(page, nibp.id, "diastolic", 78);
    const stored = await measurementAt(page, "nibp", ts("10:00:00"));
    expect(stored.systolic).toBe(systolic);
    expect(stored.diastolic).toBe(diastolic);
    expect(stored.systolic!).toBeGreaterThan(stored.mean!);
    expect(stored.mean!).toBeGreaterThan(stored.diastolic!);

    await page.getByTestId(`nibp-time-handle-${nibp.id}`).hover();
    await expect(page.getByTestId(`nibp-values-${nibp.id}`)).toContainText(
      `S ${stored.systolic} · M ${stored.mean} · D ${stored.diastolic} mmHg`,
    );
    await beat(page);
  });

  await test.step("Kontrollzeit 10:05 vollstaendig dokumentieren", async () => {
    await travelTo(page, "10:05:40");
    const checkpoint = ts("10:05:00");
    const warning = page.getByTestId(`checkpoint-warning-${checkpoint}`);
    await expect(warning).toBeVisible();

    // Klick auf das Ausrufezeichen fixiert die X-Position auf die Kontrollzeit.
    await warning.click();
    await expect(warning).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("checkpoint-selection")).toContainText("Kontrollzeit 10:05:00");
    await beat(page);

    for (const [kind, target] of [["spo2", 97], ["heartRate", 78], ["temperature", 36.6]] as const) {
      const shown = await pressValueAtCheckpoint(page, kind, target);
      const saved = await measurementAt(page, kind, checkpoint);
      expect(saved.time).toBe(checkpoint);
      expect(saved.value).toBeCloseTo(shown.value, 5);
      expect(shown.clock).toBe("10:05:00");
    }

    // Blutdruck: je Komponente eine eigene Zeigerhoehe.
    for (const [component, target] of [["mean", 89], ["systolic", 118], ["diastolic", 75]] as const) {
      await page.getByTestId(`nibp-component-${component}`).click();
      await pressValueAtCheckpoint(page, "nibp", target);
    }

    const nibp = await measurementAt(page, "nibp", checkpoint);
    expect(nibp.systolic!).toBeGreaterThan(nibp.mean!);
    expect(nibp.mean!).toBeGreaterThan(nibp.diastolic!);
    expect((await caseData(page)).measurements.filter((m) => m.time === checkpoint)).toHaveLength(4);

    // Sind alle vier Parameter dokumentiert, endet der Modus von selbst und die
    // rote Kontrollzeit-Warnung verschwindet.
    await expect(page.getByTestId(`checkpoint-warning-${checkpoint}`)).toHaveCount(0);
    await expect(page.getByTestId("checkpoint-selection")).toHaveCount(0);
    await beat(page);
  });

  await test.step("Persistence nach Reload sichtbar pruefen", async () => {
    const before = await caseData(page);
    await page.reload();

    // Sichtbare Nachweise statt reiner Speicherabfrage.
    await expect(page.getByTestId("case-started")).toHaveText("Gestartet um 10:00:00");
    await expect(page.getByTestId("case-header")).toContainText(DEMO_PATIENT.name);
    await expect(page.getByTestId("case-header")).toContainText(DEMO_PATIENT.procedure);
    await expect(page.getByTestId("case-header")).toContainText(DEMO_DATE_DE);
    await expect(page.getByTestId("timeline-empty-state")).toHaveCount(0);

    await expect(page.locator('[data-testid="points-spo2"] circle')).toHaveCount(1);
    await expect(page.locator('[data-testid="points-heartRate"] circle')).toHaveCount(1);
    await expect(page.locator('[data-testid="points-nibp"] circle')).toHaveCount(2);
    await expect(page.locator('[data-testid="points-temperature"] circle')).toHaveCount(2);

    const first = before.measurements.find((m) => m.kind === "nibp" && m.time === ts("10:00:00"))!;
    await page.getByTestId(`nibp-time-handle-${first.id}`).hover();
    await expect(page.getByTestId(`nibp-values-${first.id}`)).toContainText(
      `S ${first.systolic} · M ${first.mean} · D ${first.diastolic} mmHg`,
    );

    expect((await caseData(page)).measurements).toEqual(before.measurements);
    await beat(page, 1200);
  });
});
