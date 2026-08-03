import { test, expect, type Locator, type Page } from "@playwright/test";

// iPad-fokussierte Szenarien. Es werden ECHTE Pointer-Events mit pointerType
// "pen"/"touch" verschickt (dispatchEvent) – nicht nur Maus-Events. Die Tests
// laufen im chromium- und im ipad-viewport-Projekt (Touch + iPad-naher Viewport).
//
// WICHTIG: Ein iPad-naher Viewport in Chromium ersetzt kein physisches iPad und
// kein Mobile Safari. Siehe docs/ipad-acceptance-test.md.

const CASE_KEY = "sikant-anesthesia-demo-case:v1";

async function seedStartedCase(page: Page, minutesAgo = 20, measurements: unknown[] = []) {
  await page.goto("/dokumentation");
  const startedAt = Date.now() - minutesAgo * 60_000;
  await page.evaluate(({ startedAt, measurements, key }) => {
    localStorage.setItem(key, JSON.stringify({
      schemaVersion: 6,
      caseId: "ipad-fall",
      caseRevision: 1,
      lastSuccessfullyExportedRevision: null,
      startedAt,
      endedAt: null,
      measurements,
      medications: [],
      infusions: [],
      events: [],
      lastSavedAt: startedAt,
    }));
  }, { startedAt, measurements, key: CASE_KEY });
  await page.reload();
  await expect(page.getByTestId("case-started")).toBeVisible();
  return startedAt;
}

async function pointer(locator: Locator, phase: "down" | "move" | "up" | "cancel", x: number, y: number, type: string, id: number) {
  await locator.dispatchEvent(`pointer${phase}`, {
    pointerId: id,
    pointerType: type,
    isPrimary: true,
    button: phase === "up" ? 0 : 0,
    buttons: phase === "up" || phase === "cancel" ? 0 : 1,
    clientX: x,
    clientY: y,
  });
}

async function tap(locator: Locator, x: number, y: number, type: string, id: number) {
  await pointer(locator, "down", x, y, type, id);
  await pointer(locator, "up", x, y, type, id);
}

function readCase(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), CASE_KEY);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

// Story 1: NIBP – jeder Griff bewegt sich unabhängig; die anderen Werte bleiben.
test("iPad Story 1: NIBP-Griffe ziehen unabhängig, Reihenfolge bleibt", async ({ page }) => {
  await seedStartedCase(page, 20, [
    { id: "nibp-1", kind: "nibp", time: Date.now() - 15 * 60_000, systolic: 120, mean: 90, diastolic: 60, createdAt: Date.now(), updatedAt: Date.now() },
  ]);
  await expect(page.getByTestId("points-nibp").locator("circle")).toHaveCount(1);

  const sys = page.getByTestId("nibp-handle-systolic").locator('circle[role="button"]');
  const sysBox = await sys.boundingBox();
  expect(sysBox).not.toBeNull();
  const sx = sysBox!.x + sysBox!.width / 2;
  const sy = sysBox!.y + sysBox!.height / 2;
  await pointer(sys, "down", sx, sy, "pen", 11);
  await pointer(sys, "move", sx, sy - 24, "pen", 11);
  await pointer(sys, "up", sx, sy - 24, "pen", 11);

  const afterSys = await readCase(page);
  const nibpA = afterSys.measurements[0];
  expect(nibpA.mean).toBe(90);
  expect(nibpA.diastolic).toBe(60);
  expect(nibpA.systolic).not.toBe(120);
  expect(nibpA.systolic).toBeGreaterThan(nibpA.mean);

  const dia = page.getByTestId("nibp-handle-diastolic").locator('circle[role="button"]');
  const diaBox = await dia.boundingBox();
  const dx = diaBox!.x + diaBox!.width / 2;
  const dy = diaBox!.y + diaBox!.height / 2;
  await pointer(dia, "down", dx, dy, "pen", 12);
  await pointer(dia, "move", dx, dy + 22, "pen", 12);
  await pointer(dia, "up", dx, dy + 22, "pen", 12);

  const afterDia = await readCase(page);
  const nibpB = afterDia.measurements[0];
  expect(nibpB.systolic).toBe(nibpA.systolic);
  expect(nibpB.mean).toBe(90);
  expect(nibpB.diastolic).not.toBe(60);
  expect(nibpB.diastolic).toBeLessThan(nibpB.mean);

  await page.reload();
  const reloaded = await readCase(page);
  expect(reloaded.measurements[0]).toMatchObject({ systolic: nibpB.systolic, mean: 90, diastolic: nibpB.diastolic });
});

// Story 2: Erster Stift-Kontakt zeigt nur die Koordinate; zweiter Kontakt öffnet das Formular.
test("iPad Story 2: erster Stift-Kontakt öffnet kein Formular, zweiter schon", async ({ page }) => {
  await seedStartedCase(page, 20);
  const band = await page.getByTestId("band-spo2").boundingBox();
  const area = await page.getByTestId("timeline-create-area").boundingBox();
  expect(band).not.toBeNull();
  expect(area).not.toBeNull();
  const x = area!.x + area!.width * 0.15;
  const y = band!.y + band!.height / 2;
  const areaLoc = page.getByTestId("timeline-create-area");

  await pointer(areaLoc, "down", x, y, "pen", 21);
  await pointer(areaLoc, "move", x + 2, y + 1, "pen", 21);
  await pointer(areaLoc, "up", x + 2, y + 1, "pen", 21);

  await expect(page.getByTestId("timeline-preview")).toBeVisible();
  await expect(page.getByTestId("preview-coordinate")).toContainText("SpO₂");
  await expect(page.getByTestId("entry-value")).toHaveCount(0);

  // Zweiter Kontakt auf dieselbe Stelle -> Formular öffnet, Werte vorbelegt.
  await tap(areaLoc, x + 2, y + 1, "pen", 22);
  await expect(page.getByTestId("entry-value")).toBeVisible();
  await expect(page.getByTestId("entry-time")).not.toHaveValue("");
  await expect(page.getByTestId("entry-value")).not.toHaveValue("");
});

// Story 3: Vorschau verschwindet nach 3 Sekunden ohne Formular.
test("iPad Story 3: Vorschau verschwindet nach drei Sekunden", async ({ page }) => {
  await seedStartedCase(page, 20);
  const band = await page.getByTestId("band-heartRate").boundingBox();
  const area = await page.getByTestId("timeline-create-area").boundingBox();
  const x = area!.x + area!.width * 0.2;
  const y = band!.y + band!.height / 2;
  const areaLoc = page.getByTestId("timeline-create-area");
  await tap(areaLoc, x, y, "touch", 31);
  await expect(page.getByTestId("timeline-preview")).toBeVisible();
  await page.waitForTimeout(3300);
  await expect(page.getByTestId("timeline-preview")).toHaveCount(0);
  await expect(page.getByTestId("entry-value")).toHaveCount(0);
});

// Story 4: Interaktion auf der Grafik scrollt die Seite nicht; ausserhalb schon.
test("iPad Story 4: Grafik-Interaktion scrollt die Seite nicht", async ({ page }) => {
  await seedStartedCase(page, 20);
  const touchActions = await page.evaluate(() => ({
    plot: getComputedStyle(document.querySelector('[data-testid="timeline-create-area"]')!).touchAction,
    lane: getComputedStyle(document.querySelector('[data-testid="lane-create-medication"]')!).touchAction,
  }));
  expect(touchActions.plot).toBe("none");
  expect(touchActions.lane).toBe("none");

  const scrollable = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
  expect(scrollable).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 150));
  const before = await page.evaluate(() => window.scrollY);

  const band = await page.getByTestId("band-spo2").boundingBox();
  const area = await page.getByTestId("timeline-create-area").boundingBox();
  const x = area!.x + area!.width * 0.25;
  const y = band!.y + band!.height / 2;
  const areaLoc = page.getByTestId("timeline-create-area");
  await pointer(areaLoc, "down", x, y, "pen", 41);
  await pointer(areaLoc, "move", x + 5, y + 30, "pen", 41);
  await pointer(areaLoc, "up", x + 5, y + 30, "pen", 41);
  const after = await page.evaluate(() => window.scrollY);
  expect(after).toBe(before);

  // Ausserhalb der Grafik bleibt der Seiten-Scroll möglich.
  await page.evaluate(() => window.scrollTo(0, 40));
  expect(await page.evaluate(() => window.scrollY)).toBe(40);
});

// Story 5: Der Eingabe-Drawer liegt vollständig im sichtbaren Bereich (Portrait + Landscape).
test("iPad Story 5: Drawer liegt vollständig im Viewport, kein Sprung", async ({ page }) => {
  await seedStartedCase(page, 20);
  const openMedicationForm = async () => {
    const lane = page.getByTestId("lane-create-medication");
    const box = await lane.boundingBox();
    const x = box!.x + box!.width * 0.2;
    const y = box!.y + box!.height / 2;
    await tap(lane, x, y, "touch", 51); // Vorschau
    await tap(lane, x, y, "touch", 52); // Bestätigung
    await expect(page.getByTestId("medication-name")).toBeVisible();
  };

  const assertDrawerInViewport = async () => {
    const viewport = page.viewportSize()!;
    const wrapper = page.locator(".ant-drawer-content-wrapper");
    // Auf das Ende der Öffnen-Animation warten (Drawer sitzt dann am unteren Rand).
    await expect.poll(async () => {
      const box = await wrapper.boundingBox();
      return box ? Math.round(box.y + box.height) : Number.POSITIVE_INFINITY;
    }).toBeLessThanOrEqual(viewport.height + 2);
    const box = await wrapper.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(-2);
    await expect(page.getByTestId("therapy-save")).toBeVisible();
    await expect(page.getByTestId("therapy-cancel")).toBeVisible();
  };

  await page.evaluate(() => window.scrollTo(0, 120));
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await openMedicationForm();
  await assertDrawerInViewport();
  // Öffnen darf die Seite nicht nach oben springen lassen.
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  await page.getByTestId("therapy-cancel").click();

  // Landscape prüfen.
  await page.setViewportSize({ width: 1080, height: 810 });
  await openMedicationForm();
  await assertDrawerInViewport();
  await page.getByTestId("therapy-cancel").click();
});

// Story 6: Ereignisplatzierung – erster Kontakt Geist, zweiter Kontakt platziert.
test("iPad Story 6: Ereignis wird per Zwei-Schritt platziert und schneidet die Vitalgrafiken", async ({ page }) => {
  await seedStartedCase(page, 20);
  await page.getByTestId("select-event-incision").click();
  await expect(page.getByTestId("select-event-incision")).toHaveAttribute("aria-pressed", "true");

  const lane = page.getByTestId("lane-create-event");
  const box = await lane.boundingBox();
  const x = box!.x + box!.width * 0.25;
  const y = box!.y + box!.height / 2;

  await tap(lane, x, y, "touch", 61); // Geist
  await expect(page.getByTestId("timeline-preview")).toBeVisible();
  await expect(page.getByTestId("event-incision")).toHaveCount(0);

  await tap(lane, x, y, "touch", 62); // Platzierung
  await expect(page.getByTestId("event-incision")).toBeVisible();
  await expect(page.getByTestId("event-line")).toHaveCount(1);

  const stored = await readCase(page);
  expect(stored.events).toHaveLength(1);
  expect(stored.events[0].eventType).toBe("incision");

  await page.reload();
  await expect(page.getByTestId("event-incision")).toBeVisible();
});

// Story 7: Medikamenten-Lane – gestrichelte Vorschau, Formular erst beim zweiten Kontakt.
test("iPad Story 7: Medikamenten-Vorschau, Formular erst beim zweiten Kontakt", async ({ page }) => {
  await seedStartedCase(page, 20);
  const lane = page.getByTestId("lane-create-medication");
  const box = await lane.boundingBox();
  const x = box!.x + box!.width * 0.3;
  const y = box!.y + box!.height / 2;

  await tap(lane, x, y, "pen", 71);
  await expect(page.getByTestId("timeline-preview")).toBeVisible();
  await expect(page.getByTestId("preview-coordinate")).toHaveText(/\d{2}:\d{2}:\d{2}/);
  await expect(page.getByTestId("medication-name")).toHaveCount(0);
  await expect(page.getByTestId("infusion-name")).toHaveCount(0);

  await tap(lane, x, y, "pen", 72);
  await expect(page.getByTestId("medication-name")).toBeVisible();
  await expect(page.getByTestId("therapy-time")).not.toHaveValue("");
});

// Story 8: Infusions-Lane – gleiche Zwei-Schritt-Logik, öffnet das Infusions-Formular.
test("iPad Story 8: Infusions-Vorschau öffnet nur das Infusions-Formular", async ({ page }) => {
  await seedStartedCase(page, 20);
  const lane = page.getByTestId("lane-create-infusion");
  const box = await lane.boundingBox();
  const x = box!.x + box!.width * 0.3;
  const y = box!.y + box!.height / 2;

  await tap(lane, x, y, "pen", 81);
  await expect(page.getByTestId("timeline-preview")).toBeVisible();
  await expect(page.getByTestId("infusion-name")).toHaveCount(0);
  await expect(page.getByTestId("medication-name")).toHaveCount(0);

  await tap(lane, x, y, "pen", 82);
  await expect(page.getByTestId("infusion-name")).toBeVisible();
  await expect(page.getByTestId("medication-name")).toHaveCount(0);
});

// Story 9: pointercancel darf keinen Wert verändern und keine Vorschau bestätigen.
test("iPad Story 9: pointercancel verwirft Drag und Vorschau ohne Datenänderung", async ({ page }) => {
  await seedStartedCase(page, 20, [
    { id: "nibp-9", kind: "nibp", time: Date.now() - 15 * 60_000, systolic: 120, mean: 90, diastolic: 60, createdAt: Date.now(), updatedAt: Date.now() },
  ]);
  const sys = page.getByTestId("nibp-handle-systolic").locator('circle[role="button"]');
  const sysBox = await sys.boundingBox();
  const sx = sysBox!.x + sysBox!.width / 2;
  const sy = sysBox!.y + sysBox!.height / 2;
  await pointer(sys, "down", sx, sy, "pen", 91);
  await pointer(sys, "move", sx, sy - 30, "pen", 91);
  await pointer(sys, "cancel", sx, sy - 30, "pen", 91);
  const afterCancel = await readCase(page);
  expect(afterCancel.measurements[0]).toMatchObject({ systolic: 120, mean: 90, diastolic: 60 });

  // Preview-Vorgang abbrechen -> kein Datensatz, kein Formular.
  const area = page.getByTestId("timeline-create-area");
  const band = await page.getByTestId("band-spo2").boundingBox();
  const areaBox = await area.boundingBox();
  const x = areaBox!.x + areaBox!.width * 0.2;
  const y = band!.y + band!.height / 2;
  await pointer(area, "down", x, y, "touch", 92);
  await pointer(area, "move", x + 4, y + 3, "touch", 92);
  await pointer(area, "cancel", x + 4, y + 3, "touch", 92);
  await expect(page.getByTestId("entry-value")).toHaveCount(0);
  const stored = await readCase(page);
  expect(stored.measurements).toHaveLength(1);
});
