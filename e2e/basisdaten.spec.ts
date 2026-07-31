import { test, expect, type Page } from "@playwright/test";
import { TEXT } from "../lib/constants";

// Ausschliesslich fiktive Demodaten.
const DEMO = {
  patientName: "Max Mustermann",
  birthDate: "01.01.1980",
  procedure: "Appendektomie",
  operationDate: "15.06.2026",
  bodyWeight: "72,5",
  asaLabel: "ASA II",
  mallampatiLabel: "Klasse II",
  allergies: "Keine bekannt",
};

const FIELD_ORDER = [
  "patientName",
  "birthDate",
  "procedure",
  "operationDate",
  "bodyWeightKg",
  "asaClass",
  "mallampatiClass",
  "allergies",
];

async function fillDate(page: Page, field: string, value: string) {
  const input = page.getByTestId(`field-${field}`).locator("input");
  await input.click();
  await input.fill(value);
  await input.press("Enter");
  await page.keyboard.press("Escape");
}

async function selectOption(page: Page, field: string, label: string) {
  // Auswahlfeld oeffnen und die sichtbare Option ueber ihr exaktes title-Attribut waehlen.
  await page.getByTestId(`field-${field}`).getByRole("combobox").click();
  await page.locator(`.ant-select-item-option[title="${label}"]`).click();
}

async function fillAllFields(page: Page) {
  await page.getByTestId("input-patientName").fill(DEMO.patientName);
  await fillDate(page, "birthDate", DEMO.birthDate);
  await page.getByTestId("input-procedure").fill(DEMO.procedure);
  await fillDate(page, "operationDate", DEMO.operationDate);
  await page.getByTestId("field-bodyWeightKg").locator("input").fill(DEMO.bodyWeight);
  await selectOption(page, "asaClass", DEMO.asaLabel);
  await selectOption(page, "mallampatiClass", DEMO.mallampatiLabel);
  await page.getByTestId("field-allergies").locator("textarea").fill(DEMO.allergies);
}

async function expectValuesPresent(page: Page) {
  await expect(page.getByTestId("input-patientName")).toHaveValue(DEMO.patientName);
  await expect(page.getByTestId("field-birthDate").locator("input")).toHaveValue(DEMO.birthDate);
  await expect(page.getByTestId("input-procedure")).toHaveValue(DEMO.procedure);
  await expect(page.getByTestId("field-operationDate").locator("input")).toHaveValue(
    DEMO.operationDate,
  );
  await expect(page.getByTestId("field-bodyWeightKg").locator("input")).toHaveValue(DEMO.bodyWeight);
  await expect(page.getByTestId("field-asaClass")).toContainText(DEMO.asaLabel);
  await expect(page.getByTestId("field-mallampatiClass")).toContainText(DEMO.mallampatiLabel);
  await expect(page.getByTestId("field-allergies").locator("textarea")).toHaveValue(DEMO.allergies);
}

test("Basisdaten: eingeben, speichern, wiederherstellen, navigieren und entfernen", async ({
  page,
  context,
}) => {
  await page.goto("/");

  // 2: Alle acht Felder in der richtigen Reihenfolge sichtbar.
  const positions: number[] = [];
  for (const field of FIELD_ORDER) {
    const locator = page.getByTestId(`field-${field}`);
    await expect(locator).toBeVisible();
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    positions.push(box!.y);
  }
  for (let i = 1; i < positions.length; i++) {
    expect(positions[i]).toBeGreaterThan(positions[i - 1]);
  }

  // 3: Felder mit fiktiven Daten ausfuellen.
  await fillAllFields(page);

  // 4: Zunaechst erscheint "Wird gespeichert …" (zuletzt geaendertes Feld).
  await expect(page.getByTestId("status-allergies")).toHaveText(TEXT.fieldSaving);

  // 5-6: Nach 2,5 Sekunden erscheint bei den Feldern "✓ Gespeichert".
  await expect(page.getByTestId("status-allergies")).toHaveText(TEXT.fieldSaved, {
    timeout: 8000,
  });
  await expect(page.getByTestId("status-patientName")).toHaveText(TEXT.fieldSaved);

  // 7: Gesamtstatus unten.
  await expect(page.getByTestId("global-status")).toHaveText(TEXT.globalSaved);

  // 8-9: Seite neu laden -> Werte weiterhin vorhanden.
  await page.reload();
  await expectValuesPresent(page);

  // 10-11: Seite schliessen und im selben Kontext neu oeffnen -> Werte bleiben.
  await page.close();
  const page2 = await context.newPage();
  await page2.goto("/");
  await expectValuesPresent(page2);

  // 12-13: "Okay und Weiter" -> Route /dokumentation.
  await page2.getByTestId("weiter").click();
  await expect(page2).toHaveURL(/\/dokumentation$/);

  // 14-15: Zurueck zur Startseite -> Daten weiterhin vorhanden.
  await page2.goto("/");
  await expectValuesPresent(page2);

  // 16-18: "Alle Angaben entfernen" -> Dialog zunaechst abbrechen.
  await page2.getByTestId("remove-all").click();
  await page2.getByRole("button", { name: TEXT.removeConfirmCancel }).click();
  await expect(page2.getByTestId("input-patientName")).toHaveValue(DEMO.patientName);

  // 19: Erneut entfernen und bestaetigen.
  await page2.getByTestId("remove-all").click();
  await page2.getByRole("button", { name: TEXT.removeConfirmOk }).click();

  // 20: Alle Felder leer.
  await expect(page2.getByTestId("input-patientName")).toHaveValue("");
  await expect(page2.getByTestId("field-birthDate").locator("input")).toHaveValue("");
  await expect(page2.getByTestId("input-procedure")).toHaveValue("");
  await expect(page2.getByTestId("field-operationDate").locator("input")).toHaveValue("");
  await expect(page2.getByTestId("field-bodyWeightKg").locator("input")).toHaveValue("");
  await expect(page2.getByTestId("field-allergies").locator("textarea")).toHaveValue("");
  await expect(page2.getByTestId("field-asaClass")).not.toContainText(DEMO.asaLabel);
  await expect(page2.getByTestId("field-mallampatiClass")).not.toContainText(DEMO.mallampatiLabel);
});
