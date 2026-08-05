import { expect, test, type Page } from "@playwright/test";
import {
  beat,
  boxOf,
  caseData,
  DEMO_PATIENT,
  documentEvent,
  prepareDemoPage,
  selectTherapyUnit,
  setTimePicker,
  startCaseAt,
  travelTo,
  ts,
} from "./demo-helpers";

/**
 * Kurzaufnahme 2: Medikament, Infusion und Ereignis anlegen, einen Eintrag
 * bearbeiten, einen Ereigniszeitpunkt auf der Zeitachse verschieben, einen
 * Eintrag loeschen und die Therapieinformation in den Vitalbaendern abrufen.
 */

/** Oeffnet eine Therapie-Lane am linken Rand der Zeitachse (Startzeit des Falls). */
async function openLaneAtStart(page: Page, kind: "medication" | "infusion") {
  const lane = page.getByTestId(`lane-create-${kind}`);
  await lane.scrollIntoViewIfNeeded();
  const box = await lane.boundingBox();
  expect(box).not.toBeNull();
  await lane.click({ position: { x: 1, y: box!.height / 2 } });
}

test("Demo 2: Medikamente, Infusionen und Ereignisse anlegen, bearbeiten und loeschen", async ({ page }) => {
  await prepareDemoPage(page);

  await test.step("Fiktiven Fall anlegen und starten", async () => {
    await page.getByTestId("input-patientName").fill(DEMO_PATIENT.name);
    await page.getByTestId("input-procedure").fill(DEMO_PATIENT.procedure);
    await page.getByTestId("operation-date-today").click();
    await page.getByTestId("weiter").click();
    await expect(page).toHaveURL(/\/dokumentation$/);
    await startCaseAt(page, "10:00:00");
    await travelTo(page, "10:00:50");
    await beat(page);
  });

  await test.step("Medikament dokumentieren", async () => {
    await openLaneAtStart(page, "medication");
    await expect(page.getByTestId("medication-name")).toBeVisible();
    await expect(page.getByRole("radio", { name: "Bolus" })).toBeChecked();
    await page.getByTestId("medication-name").fill("Propofol");
    await setTimePicker(page, "therapy-time", "10:00:00");
    await page.getByTestId("medication-dose").fill("40");
    await selectTherapyUnit(page, "medication-unit", "Milligramm (mg)");
    // Wirkdauer: dadurch entsteht die Schraffur in allen Vitalbaendern.
    await page.getByTestId("therapy-duration").fill("5");
    await page.getByTestId("therapy-save").click();
    await expect(page.getByTestId("therapy-save")).toHaveCount(0);

    await expect.poll(async () => (await caseData(page)).medications.length).toBe(1);
    const medication = (await caseData(page)).medications[0];
    expect(medication.startedAt).toBe(ts("10:00:00"));
    await expect(page.getByTestId(`medication-${medication.id}`)).toContainText("Propofol · 40 mg");
    await beat(page);
  });

  await test.step("Infusion dokumentieren", async () => {
    await travelTo(page, "10:01:40");
    await openLaneAtStart(page, "infusion");
    await expect(page.getByTestId("infusion-name")).toBeVisible();
    await page.getByTestId("infusion-name").fill("Ringer");
    await setTimePicker(page, "therapy-time", "10:01:00");
    await page.getByTestId("infusion-amount").fill("500");
    await selectTherapyUnit(page, "infusion-unit", "mL");
    await page.getByTestId("therapy-duration").fill("20");
    await page.getByTestId("therapy-save").click();
    await expect(page.getByTestId("therapy-save")).toHaveCount(0);

    await expect.poll(async () => (await caseData(page)).infusions.length).toBe(1);
    const infusion = (await caseData(page)).infusions[0];
    expect(infusion.startedAt).toBe(ts("10:01:00"));
    await expect(page.getByTestId(`infusion-${infusion.id}`)).toContainText("Ringer · 500 mL");
    await beat(page);
  });

  await test.step("Ereignis dokumentieren", async () => {
    await travelTo(page, "10:02:40");
    await documentEvent(page, "incision", "10:02:00");
  });

  await test.step("Medikament bearbeiten", async () => {
    const medication = (await caseData(page)).medications[0];
    await page.getByTestId(`therapy-hit-medication-${medication.id}`).click();
    await expect(page.getByTestId("medication-dose")).toBeVisible();
    await page.getByTestId("medication-dose").fill("60");
    await page.getByTestId("therapy-save").click();
    await expect(page.getByTestId("therapy-save")).toHaveCount(0);

    await expect.poll(async () => (await caseData(page)).medications[0].dose).toBe(60);
    // Die geaenderte Dosis steht direkt am Marker in der Grafik.
    await expect(page.getByTestId(`medication-${medication.id}`)).toContainText("Propofol · 60 mg");
    await beat(page);
  });

  await test.step("Ereigniszeitpunkt auf der Zeitachse verschieben", async () => {
    const before = (await caseData(page)).events.find((event) => event.eventType === "incision")!;
    const marker = page.getByTestId("event-hit-incision");
    await marker.scrollIntoViewIfNeeded();
    const box = await marker.boundingBox();
    expect(box).not.toBeNull();
    const startX = box!.x + box!.width / 2;
    const y = box!.y + box!.height / 2;

    await page.mouse.move(startX, y, { steps: 8 });
    await page.mouse.down();
    await page.mouse.move(startX - 60, y, { steps: 12 });
    await expect(page.getByTestId("event-drag-tooltip")).toBeVisible();
    await page.mouse.up();

    await expect
      .poll(async () => (await caseData(page)).events.find((event) => event.eventType === "incision")!.time)
      .not.toBe(before.time);
    // Sichtbarer Nachweis: der Marker steht jetzt weiter links.
    const moved = await boxOf(page.getByTestId("event-incision"));
    expect(moved.left).toBeLessThan(box!.x);
    await beat(page);
  });

  await test.step("Infusion loeschen", async () => {
    const infusion = (await caseData(page)).infusions[0];
    await page.getByTestId(`therapy-hit-infusion-${infusion.id}`).click();
    await expect(page.getByTestId("infusion-name")).toBeVisible();
    await page.getByTestId("therapy-delete").click();
    await page.locator(".ant-popconfirm").getByRole("button", { name: "Entfernen", exact: true }).click();
    await expect(page.getByTestId("therapy-save")).toHaveCount(0);

    await expect.poll(async () => (await caseData(page)).infusions.length).toBe(0);
    await expect(page.getByTestId(`infusion-${infusion.id}`)).toHaveCount(0);
    await beat(page);
  });

  await test.step("Therapieinformation in den Vitalbaendern abrufen", async () => {
    // Die Erfolgsmeldung von Ant Design liegt kurzzeitig ueber dem oberen Rand
    // der Grafik und wuerde den Zeiger abfangen.
    await expect(page.locator(".ant-message-notice")).toHaveCount(0);

    const medication = (await caseData(page)).medications[0];
    for (const band of ["spo2", "heartRate", "temperature"] as const) {
      // Das Band zuerst in den sichtbaren Bereich holen: die Schraffur des
      // untersten Bandes liegt sonst unterhalb des Fensters.
      await page.getByTestId(`band-${band}`).scrollIntoViewIfNeeded();
      const hatch = page.getByTestId(`medication-hatch-${medication.id}-${band}`);
      await expect(hatch).toBeAttached();
      const rect = await boxOf(hatch);
      await page.mouse.move((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2, { steps: 10 });
      const tooltip = page.getByTestId("therapy-interval-tooltip");
      await expect(tooltip).toContainText("Propofol");
      await expect(tooltip).toContainText("Medikament · 60 mg");
      await expect(tooltip).toContainText("Dauer: 5 Minuten");
      await beat(page, 800);
    }

    // Endstand: Medikament vorhanden, Infusion entfernt, Ereignis verschoben.
    const stored = await caseData(page);
    expect(stored.medications).toHaveLength(1);
    expect(stored.infusions).toHaveLength(0);
    expect(stored.events).toHaveLength(1);
    await beat(page, 900);
  });
});
