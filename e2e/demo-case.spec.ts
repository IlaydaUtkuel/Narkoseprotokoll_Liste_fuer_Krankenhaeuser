import { expect, test, type Page } from "@playwright/test";

async function clearStorage(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function loadFictionalDemo(page: Page) {
  await clearStorage(page);
  await page.getByTestId("load-fictional-demo").click();
  await expect(page).toHaveURL(/\/dokumentation$/);
  await expect(page.getByTestId("fictional-demo-banner")).toContainText("FIKTIVER DEMOFALL");
}

test("der fiktive Demofall zeigt echte Produktfunktionen und bleibt nach Reload erhalten", async ({ page }) => {
  await loadFictionalDemo(page);

  await expect(page.getByTestId("points-nibp").locator("circle")).not.toHaveCount(0);
  await expect(page.getByTestId("medication-demo-med-bolus")).toBeVisible();
  await expect(page.getByTestId("infusion-demo-infusion")).toBeVisible();
  await expect(page.getByTestId("event-hit-extra")).toBeVisible();
  await page.getByTestId("event-hit-extra").focus();
  await expect(page.getByTestId("event-comment-tooltip-demo-event-extra")).toContainText("Fiktiver unerwarteter Ablauf");
  await expect(page.locator('[data-testid^="critical-warning-"]:not([data-testid="critical-warning-layer"])')).not.toHaveCount(0);
  await expect(page.locator('[data-testid^="checkpoint-warning-"]')).not.toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId("fictional-demo-banner")).toBeVisible();
  await expect(page.getByTestId("event-hit-extra")).toBeVisible();
});

test("das Laden des Demofalls ersetzt vorhandene Angaben nur nach Bestätigung", async ({ page }) => {
  await clearStorage(page);
  await page.getByTestId("input-patientName").fill("Noch nicht gespeicherter Patient");
  await page.getByTestId("load-fictional-demo").click();
  const dialog = page.locator(".ant-modal-confirm");
  await expect(dialog).toContainText("Fiktiven Demofall laden?");
  await dialog.getByRole("button", { name: "Abbrechen" }).click();
  await expect(page.getByTestId("input-patientName")).toHaveValue("Noch nicht gespeicherter Patient");
  await expect(page).toHaveURL(/\/$/);

  await page.getByTestId("load-fictional-demo").click();
  await dialog.getByRole("button", { name: "Demo laden und Daten ersetzen" }).click();
  await expect(page.getByTestId("fictional-demo-banner")).toBeVisible();
});

test("die Vollständigkeitsprüfung blockiert bis zur Kenntnisnahme und der Download schließt erst danach", async ({ page }) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, "showDirectoryPicker");
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => false });
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  });
  await loadFictionalDemo(page);
  await page.goto("/abschluss");

  await expect(page.getByRole("heading", { name: "Kontrolle" })).toBeVisible();
  await expect(page.getByTestId("case-basis-summary")).toContainText("DEMO – Fiktive Person");
  await expect(page.getByTestId("case-timeline-preview")).toBeVisible();
  await expect(page.getByTestId("case-completeness")).toContainText("Demo-Perfusor");
  await expect(page.getByTestId("case-completeness")).toContainText("Kontrollpunkt");

  await page.getByTestId("archive-confirmation").click();
  await expect(page.getByTestId("archive-save")).toBeDisabled();
  await page.getByTestId("completeness-acknowledgement").click();
  await expect(page.getByTestId("archive-save")).toBeEnabled();

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("archive-save").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^Narkosefall_fiktiver-demo-fall-.*\.json$/);
  await expect(page.getByTestId("case-close-complete")).toBeVisible();

  await page.getByTestId("new-case-start").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("input-patientName")).toHaveValue("");
  expect(await page.evaluate(() => localStorage.getItem("sikant-anesthesia-demo-case:v1"))).toBeNull();
});
