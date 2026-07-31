import { test, expect, type Page } from "@playwright/test";
import { TEXT } from "../lib/constants";

// Ausschliesslich fiktive Demodaten. Das OP-Datum wird dynamisch (heute) berechnet,
// damit es nie aelter als sieben Tage und damit ungueltig wird.
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

const DEMO = {
  patientName: "Max Mustermann",
  birthDate: "01.01.1980",
  procedure: "Appendektomie",
  operationDate: today(),
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

async function selectOption(page: Page, field: string, label: string) {
  await page.getByTestId(`field-${field}`).getByRole("combobox").click();
  await page.locator(`.ant-select-item-option[title="${label}"]`).click();
}

async function fillAllFields(page: Page) {
  await page.getByTestId("input-patientName").fill(DEMO.patientName);
  await page.getByTestId("input-birthDate").fill(DEMO.birthDate);
  await page.getByTestId("input-procedure").fill(DEMO.procedure);
  await page.getByTestId("input-operationDate").fill(DEMO.operationDate);
  await page.locator("#bodyWeightKg").fill(DEMO.bodyWeight);
  await selectOption(page, "asaClass", DEMO.asaLabel);
  await selectOption(page, "mallampatiClass", DEMO.mallampatiLabel);
  await page.getByTestId("input-allergies").fill(DEMO.allergies);
}

async function expectValuesPresent(page: Page) {
  await expect(page.getByTestId("input-patientName")).toHaveValue(DEMO.patientName);
  await expect(page.getByTestId("input-birthDate")).toHaveValue(DEMO.birthDate);
  await expect(page.getByTestId("input-procedure")).toHaveValue(DEMO.procedure);
  await expect(page.getByTestId("input-operationDate")).toHaveValue(DEMO.operationDate);
  await expect(page.locator("#bodyWeightKg")).toHaveValue(DEMO.bodyWeight);
  await expect(page.getByTestId("field-asaClass")).toContainText(DEMO.asaLabel);
  await expect(page.getByTestId("field-mallampatiClass")).toContainText(DEMO.mallampatiLabel);
  await expect(page.getByTestId("input-allergies")).toHaveValue(DEMO.allergies);
}

test("Basisdaten: eingeben, speichern, wiederherstellen, navigieren und entfernen", async ({
  page,
  context,
}) => {
  await page.goto("/");

  // Alle acht Felder in der richtigen Reihenfolge sichtbar.
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

  await fillAllFields(page);

  // Zunaechst erscheint "Wird gespeichert …" (zuletzt geaendertes Feld).
  await expect(page.getByTestId("status-allergies")).toHaveText(TEXT.fieldSaving);

  // Nach ca. 2,5 Sekunden erscheint "✓ Gespeichert".
  await expect(page.getByTestId("status-allergies")).toHaveText(TEXT.fieldSaved, { timeout: 8000 });
  await expect(page.getByTestId("status-patientName")).toHaveText(TEXT.fieldSaved);

  // Gesamtstatus unten.
  await expect(page.getByTestId("global-status")).toHaveText(TEXT.globalSaved);

  // Seite neu laden -> Werte weiterhin vorhanden.
  await page.reload();
  await expectValuesPresent(page);

  // Seite schliessen und im selben Kontext neu oeffnen -> Werte bleiben.
  await page.close();
  const page2 = await context.newPage();
  await page2.goto("/");
  await expectValuesPresent(page2);

  // "Okay und Weiter" -> Route /dokumentation.
  await page2.getByTestId("weiter").click();
  await expect(page2).toHaveURL(/\/dokumentation$/);

  // Zurueck zur Startseite -> Daten weiterhin vorhanden.
  await page2.goto("/");
  await expectValuesPresent(page2);

  // "Alle Angaben entfernen" -> Dialog zunaechst abbrechen.
  await page2.getByTestId("remove-all").click();
  await page2.getByRole("button", { name: TEXT.removeConfirmCancel }).click();
  await expect(page2.getByTestId("input-patientName")).toHaveValue(DEMO.patientName);

  // Erneut entfernen und bestaetigen.
  await page2.getByTestId("remove-all").click();
  await page2.getByRole("button", { name: TEXT.removeConfirmOk }).click();

  // Alle Felder leer.
  await expect(page2.getByTestId("input-patientName")).toHaveValue("");
  await expect(page2.getByTestId("input-birthDate")).toHaveValue("");
  await expect(page2.getByTestId("input-procedure")).toHaveValue("");
  await expect(page2.getByTestId("input-operationDate")).toHaveValue("");
  await expect(page2.locator("#bodyWeightKg")).toHaveValue("");
  await expect(page2.getByTestId("input-allergies")).toHaveValue("");
  await expect(page2.getByTestId("field-asaClass")).not.toContainText(DEMO.asaLabel);
  await expect(page2.getByTestId("field-mallampatiClass")).not.toContainText(DEMO.mallampatiLabel);
});
