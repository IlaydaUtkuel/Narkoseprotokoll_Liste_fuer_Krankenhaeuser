import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function clearStorage(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function loadDemo(page: Page) {
  await clearStorage(page);
  await page.getByTestId("load-fictional-demo").click();
  await expect(page).toHaveURL(/\/dokumentation$/);
  await expect(page.getByTestId("fictional-demo-banner")).toBeVisible();
}

async function expectNoSeriousAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = result.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("Basisdaten-Seite enthält keine schwerwiegenden automatischen Barrierefreiheitsverstöße", async ({ page }) => {
  await clearStorage(page);
  await expectNoSeriousAxeViolations(page);
});

test("Dokumentation enthält keine schwerwiegenden automatischen Barrierefreiheitsverstöße", async ({ page }) => {
  await loadDemo(page);
  await expectNoSeriousAxeViolations(page);
});

test("Abschluss und Vollständigkeitsprüfung enthalten keine schwerwiegenden automatischen Barrierefreiheitsverstöße", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/abschluss");
  await expect(page.getByTestId("case-completeness")).toBeVisible();
  await expectNoSeriousAxeViolations(page);
});

test("Event-, Warn- und Timeline-Ziele sind mindestens 44 mal 44 CSS-Pixel groß", async ({ page }) => {
  await loadDemo(page);
  const eventTools = page.locator(".event-tool");
  const toolCount = await eventTools.count();
  expect(toolCount).toBe(6);
  for (let index = 0; index < toolCount; index += 1) {
    const box = await eventTools.nth(index).boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  const checkpointButtons = page.locator('[data-testid^="checkpoint-warning-"]');
  const warningCount = await checkpointButtons.count();
  expect(warningCount).toBeGreaterThan(0);
  const warningBox = await checkpointButtons.first().boundingBox();
  expect(warningBox?.width).toBeGreaterThanOrEqual(44);
  expect(warningBox?.height).toBeGreaterThanOrEqual(44);

  const checkpointBand = page.locator('[data-testid^="checkpoint-band-temperature-"]').first();
  const bandBox = await checkpointBand.boundingBox();
  expect(bandBox?.width).toBeGreaterThanOrEqual(44);
  expect(bandBox?.height).toBeGreaterThanOrEqual(44);

  const eventHit = page.getByTestId("event-hit-extra");
  const eventBox = await eventHit.boundingBox();
  expect(eventBox?.width).toBeGreaterThanOrEqual(44);
  expect(eventBox?.height).toBeGreaterThanOrEqual(44);
  await eventHit.focus();
  await expect(page.locator('[data-testid^="event-comment-tooltip-"]')).toBeVisible();

  const criticalButton = page.locator('[data-testid^="critical-warning-"]:not([data-testid="critical-warning-layer"])').first();
  const criticalBox = await criticalButton.boundingBox();
  expect(criticalBox?.width).toBeGreaterThanOrEqual(44);
  expect(criticalBox?.height).toBeGreaterThanOrEqual(44);
  await criticalButton.focus();
  await expect(criticalButton).toBeFocused();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test("Checkpoint-Hitfläche öffnet am Rand den richtigen Wert und der Bereich daneben keine Warnung", async ({ page }) => {
  await loadDemo(page);
  const hit = page.locator('[data-testid^="checkpoint-band-temperature-"]').first();
  const box = await hit.boundingBox();
  expect(box).not.toBeNull();
  await hit.click({ position: { x: 2, y: box!.height / 2 } });
  await expect(page.getByRole("combobox", { name: "Temperatur auswählen" })).toBeVisible();
  await page.getByRole("button", { name: "Abbrechen" }).click();

  const warnings = page.locator('[data-testid^="checkpoint-warning-"]');
  expect(await warnings.count()).toBeGreaterThan(1);
  const retainedTime = (await warnings.nth(1).getAttribute("aria-label"))?.slice(0, 8);
  await warnings.nth(1).click();
  await expect(page.getByTestId("checkpoint-selection")).toContainText(retainedTime ?? "");
  const warningBox = await warnings.first().boundingBox();
  expect(warningBox).not.toBeNull();
  await page.mouse.click(warningBox!.x + warningBox!.width + 3, warningBox!.y + warningBox!.height / 2);
  await expect(page.getByTestId("checkpoint-selection")).toContainText(retainedTime ?? "");
});

test("Pen öffnet die Medikament-Lane und Tastatur schaltet ein Ereignis um", async ({ page }) => {
  await clearStorage(page);
  await page.goto("/dokumentation");
  const startedAt = Date.now() - 20 * 60_000;
  await page.evaluate((time) => {
    localStorage.setItem("sikant-anesthesia-demo-case:v1", JSON.stringify({
      schemaVersion: 6,
      caseId: "pen-test-fall",
      caseRevision: 1,
      lastSuccessfullyExportedRevision: null,
      startedAt: time,
      endedAt: null,
      measurements: [],
      medications: [],
      infusions: [],
      events: [],
      lastSavedAt: time,
    }));
  }, startedAt);
  await page.reload();
  await expect(page.getByTestId("case-started")).toBeVisible();

  const lane = page.getByTestId("lane-create-medication");
  const box = await lane.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width * 0.05;
  const y = box!.y + box!.height / 2;
  // Zwei-Schritt (Stift): erster Kontakt legt nur eine Vorschau ab, kein Formular.
  await lane.dispatchEvent("pointerdown", { pointerId: 91, pointerType: "pen", isPrimary: true, button: 0, buttons: 1, clientX: x, clientY: y });
  await lane.dispatchEvent("pointerup", { pointerId: 91, pointerType: "pen", isPrimary: true, button: 0, buttons: 0, clientX: x, clientY: y });
  await expect(page.getByTestId("timeline-preview")).toBeVisible();
  await expect(page.getByTestId("medication-name")).toHaveCount(0);
  // Zweiter Kontakt auf dieselbe Stelle bestätigt und öffnet das Formular.
  await lane.dispatchEvent("pointerdown", { pointerId: 92, pointerType: "pen", isPrimary: true, button: 0, buttons: 1, clientX: x, clientY: y });
  await lane.dispatchEvent("pointerup", { pointerId: 92, pointerType: "pen", isPrimary: true, button: 0, buttons: 0, clientX: x, clientY: y });
  await expect(page.getByTestId("medication-name")).toBeVisible();
  await page.getByRole("button", { name: "Abbrechen" }).click();

  const eventTool = page.getByTestId("select-event-extra");
  await eventTool.focus();
  await eventTool.press("Enter");
  await expect(eventTool).toHaveAttribute("aria-pressed", "true");
  await eventTool.press("Space");
  await expect(eventTool).toHaveAttribute("aria-pressed", "false");
});
