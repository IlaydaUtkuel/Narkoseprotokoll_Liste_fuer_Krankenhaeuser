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

// ---- Runde 2: Vorschaukreis, Sofort-Löschen, NIBP-Präzision, Auswahl, Checkpoint ----

// R2 Story 1: Medikament-Vorschaukreis, kein "+", versetzter zweiter Kontakt nutzt den fixierten Zeitstempel.
test("iPad R2 Story 1: Medikament-Vorschaukreis ohne Plus; versetzter zweiter Kontakt nutzt den fixierten Zeitstempel", async ({ page }) => {
  await seedStartedCase(page, 20);
  const lane = page.getByTestId("lane-create-medication");
  const box = await lane.boundingBox();
  const x = box!.x + box!.width * 0.35;
  const y = box!.y + box!.height / 2;
  await tap(lane, x, y, "pen", 201);
  await expect(page.getByTestId("timeline-preview")).toBeVisible();
  await expect(page.getByTestId("preview-circle")).toBeVisible();
  expect(await page.locator(".timeline-preview-plus").count()).toBe(0);
  const pinnedTime = ((await page.getByTestId("preview-coordinate").textContent()) ?? "").trim();
  // Zweiter Kontakt VERSETZT (innerhalb des 44-px-Kreises), nicht exakt auf der Linie.
  await tap(lane, x + 15, y - 8, "pen", 202);
  await expect(page.getByTestId("medication-name")).toBeVisible();
  const formTime = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="therapy-time"]');
    const input = el?.tagName === "INPUT" ? el : el?.querySelector("input");
    return (input as HTMLInputElement | null)?.value ?? "";
  });
  expect(formTime).toBe(pinnedTime); // fixierter Zeitstempel der Vorschau, nicht die zweite Kontaktposition
});

// R2 Story 2: Infusion-Vorschaukreis öffnet nur das Infusions-Formular.
test("iPad R2 Story 2: Infusion-Vorschaukreis, versetzter zweiter Kontakt öffnet nur das Infusions-Formular", async ({ page }) => {
  await seedStartedCase(page, 20);
  const lane = page.getByTestId("lane-create-infusion");
  const box = await lane.boundingBox();
  const x = box!.x + box!.width * 0.4;
  const y = box!.y + box!.height / 2;
  await tap(lane, x, y, "pen", 211);
  await expect(page.getByTestId("preview-circle")).toBeVisible();
  await tap(lane, x - 14, y + 6, "pen", 212);
  await expect(page.getByTestId("infusion-name")).toBeVisible();
  await expect(page.getByTestId("medication-name")).toHaveCount(0);
});

// R2 Story 3: eine neue Berührung entfernt die alte Vorschau sofort (nie zwei gleichzeitig).
test("iPad R2 Story 3: neue Stift-Berührung entfernt die alte Vorschau sofort", async ({ page }) => {
  await seedStartedCase(page, 20);
  const lane = page.getByTestId("lane-create-medication");
  const box = await lane.boundingBox();
  const y = box!.y + box!.height / 2;
  const x1 = box!.x + box!.width * 0.1;
  const x2 = box!.x + box!.width * 0.32; // weit entfernt (> Trefferkreis), aber gültige Vergangenheit
  await tap(lane, x1, y, "pen", 231);
  await expect(page.getByTestId("timeline-preview")).toHaveCount(1);
  // Neuer pointerdown weit entfernt: alte Vorschau sofort weg, neue noch nicht abgelegt.
  await pointer(lane, "down", x2, y, "pen", 232);
  await expect(page.getByTestId("timeline-preview")).toHaveCount(0);
  await pointer(lane, "up", x2, y, "pen", 232);
  await expect(page.getByTestId("timeline-preview")).toHaveCount(1);
});

// R2 Story 6: Systolisch nahe an das Mittel gezogen – Mittel und Diastolisch bleiben, Reihenfolge gewahrt.
test("iPad R2 Story 6: Systolisch nahe Mittel gezogen lässt die anderen Werte unverändert", async ({ page }) => {
  await seedStartedCase(page, 20, [
    { id: "n6", kind: "nibp", time: Date.now() - 15 * 60_000, systolic: 120, mean: 90, diastolic: 60, createdAt: Date.now(), updatedAt: Date.now() },
  ]);
  const sys = page.getByTestId("nibp-handle-systolic").locator('circle[role="button"]');
  const b = await sys.boundingBox();
  const sx = b!.x + b!.width / 2;
  const sy = b!.y + b!.height / 2;
  await pointer(sys, "down", sx, sy, "pen", 261);
  await pointer(sys, "move", sx, sy + 220, "pen", 261); // weit nach unten Richtung/über das Mittel
  await pointer(sys, "up", sx, sy + 220, "pen", 261);
  const n = (await readCase(page)).measurements[0];
  expect(n.mean).toBe(90);
  expect(n.diastolic).toBe(60);
  expect(n.systolic).toBeGreaterThan(n.mean); // an der Grenze geclampt, kein Sprung über das Mittel
});

// R2 Story 7: keine blaue Textauswahl auf der Grafik; Drawer-Eingaben bleiben auswählbar.
test("iPad R2 Story 7: keine Textauswahl auf der Grafik, aber Drawer-Eingabe bleibt auswählbar", async ({ page }) => {
  await seedStartedCase(page, 20);
  const svgUserSelect = await page.evaluate(() => {
    const style = getComputedStyle(document.querySelector('[data-testid="vital-timeline-svg"]')!);
    return style.userSelect || style.webkitUserSelect;
  });
  expect(svgUserSelect).toBe("none");

  const area = page.getByTestId("timeline-create-area");
  const band = await page.getByTestId("band-heartRate").boundingBox();
  const abox = await area.boundingBox();
  const gx = abox!.x + abox!.width * 0.3;
  const gy = band!.y + band!.height / 2;
  await pointer(area, "down", gx, gy, "pen", 271);
  await pointer(area, "move", gx + 40, gy + 25, "pen", 271);
  await pointer(area, "up", gx + 40, gy + 25, "pen", 271);
  const selection = await page.evaluate(() => window.getSelection()?.toString() ?? "");
  expect(selection).toBe("");

  // Ein Drawer-Formular öffnen und prüfen, dass die Eingabe normal auswählbar bleibt.
  const lane = page.getByTestId("lane-create-medication");
  const lbox = await lane.boundingBox();
  const lx = lbox!.x + lbox!.width * 0.3;
  const ly = lbox!.y + lbox!.height / 2;
  await tap(lane, lx, ly, "pen", 272);
  await tap(lane, lx, ly, "pen", 273);
  await expect(page.getByTestId("medication-name")).toBeVisible();
  const inputUserSelect = await page.evaluate(() => {
    const input = document.querySelector('[data-testid="medication-name"]') as HTMLElement;
    return getComputedStyle(input).userSelect || getComputedStyle(input).webkitUserSelect;
  });
  expect(inputUserSelect).not.toBe("none");
});

// R2 Story 8: Checkpoint-Ausrufezeichen schaltet den Modus um (aria-pressed).
test("iPad R2 Story 8: Checkpoint-Ausrufezeichen schaltet den Modus um", async ({ page }) => {
  const startedAt = await seedStartedCase(page, 6);
  const checkpoint = startedAt + 5 * 60_000;
  const warn = page.getByTestId(`checkpoint-warning-${checkpoint}`);
  await expect(warn).toBeVisible();
  await expect(warn).toHaveAttribute("aria-pressed", "false");
  await warn.click();
  await expect(warn).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("checkpoint-selection")).toContainText(/Kontrollzeit/);
  await warn.click();
  await expect(warn).toHaveAttribute("aria-pressed", "false");
});

// R2 Story 9: Checkpoint-Modus füllt vier Bänder per Stift an derselben Kontrollzeit (kein Drawer).
test("iPad R2 Story 9: Checkpoint-Modus füllt vier Bänder per Stift an derselben Zeit", async ({ page }) => {
  const startedAt = await seedStartedCase(page, 6);
  const checkpoint = startedAt + 5 * 60_000;
  const warn = page.getByTestId(`checkpoint-warning-${checkpoint}`);
  await warn.click();
  await expect(warn).toHaveAttribute("aria-pressed", "true");
  const area = page.getByTestId("timeline-create-area");
  const penSet = async (kind: string, frac: number, id: number) => {
    const band = page.getByTestId(`band-${kind}`);
    await band.scrollIntoViewIfNeeded();
    const [bb, ab] = await Promise.all([band.boundingBox(), area.boundingBox()]);
    const x = ab!.x + ab!.width * 0.15;
    const yy = bb!.y + bb!.height * frac;
    await pointer(area, "down", x, yy, "pen", id);
    await pointer(area, "move", x, yy, "pen", id);
    await pointer(area, "up", x, yy, "pen", id);
  };
  await penSet("spo2", 0.4, 291);
  await expect(page.getByTestId("entry-value")).toHaveCount(0); // kein Drawer
  await expect(warn).toBeVisible();
  await penSet("heartRate", 0.4, 292);
  await penSet("temperature", 0.4, 293);
  await expect(warn).toBeVisible();
  await page.getByTestId("nibp-component-mean").click();
  await penSet("nibp", 0.5, 294);
  await page.getByTestId("nibp-component-systolic").click();
  await penSet("nibp", 0.2, 295);
  await page.getByTestId("nibp-component-diastolic").click();
  await penSet("nibp", 0.8, 296);
  await expect(warn).toHaveCount(0);
  const times = (await readCase(page)).measurements.map((m: { time: number }) => m.time);
  expect(new Set(times)).toEqual(new Set([checkpoint]));
});

// R2 Story 10: im Checkpoint-Modus bestimmt die X-Position der Berührung nicht die Zeit.
test("iPad R2 Story 10: Checkpoint-Modus fixiert die Zeit unabhängig von der X-Position", async ({ page }) => {
  const startedAt = await seedStartedCase(page, 6);
  const checkpoint = startedAt + 5 * 60_000;
  await page.getByTestId(`checkpoint-warning-${checkpoint}`).click();
  const area = page.getByTestId("timeline-create-area");
  const [bb, ab] = await Promise.all([page.getByTestId("band-spo2").boundingBox(), area.boundingBox()]);
  const x = ab!.x + ab!.width * 0.7; // weit rechts vom Checkpoint
  const y = bb!.y + bb!.height * 0.4;
  await pointer(area, "down", x, y, "pen", 301);
  await pointer(area, "up", x, y, "pen", 301);
  const spo2 = (await readCase(page)).measurements.find((m: { kind: string }) => m.kind === "spo2");
  expect(spo2.time).toBe(checkpoint);
});

// R2 Story 11: Koordinate, aktive Medikament-Info und Warn-Ausrufezeichen sind
// gleichzeitig sichtbar und überlappen sich nicht (links/mitte/rechts).
test("iPad R2 Story 11: Koordinate, Medikament-Info und Warnsymbol überlappen sich nie", async ({ page }) => {
  await page.goto("/dokumentation");
  await page.evaluate(() => localStorage.clear());
  const startedAt = Date.now() - 20 * 60_000;
  const caseId = "ipad-collide";
  await page.evaluate(({ startedAt, caseId }) => {
    const t = (min: number) => startedAt + min * 60_000;
    localStorage.setItem("sikant-anesthesia-demo-case:v1", JSON.stringify({
      schemaVersion: 6, caseId, caseRevision: 1, lastSuccessfullyExportedRevision: null,
      startedAt, endedAt: null,
      measurements: [
        { id: "sp-l", kind: "spo2", time: t(1), value: 80, createdAt: startedAt, updatedAt: startedAt },
        { id: "sp-m", kind: "spo2", time: t(10), value: 80, createdAt: startedAt, updatedAt: startedAt },
        { id: "sp-r", kind: "spo2", time: t(19), value: 80, createdAt: startedAt, updatedAt: startedAt },
      ],
      medications: [
        { id: "med1", kind: "medication", administrationType: "continuous", name: "Test-Perfusor", startedAt: t(0.5), dose: 5, unit: { label: "mg", code: "mg", system: "UCUM", isCustom: false }, concentration: null, endedAt: null, ongoing: true, createdAt: startedAt, updatedAt: startedAt },
      ],
      infusions: [], events: [], lastSavedAt: startedAt,
    }));
    localStorage.setItem("sikant-critical-values:v1:" + caseId, JSON.stringify({
      schemaVersion: 1, caseId, birthDate: "", ageGroup: "adult", source: "custom", ageChangedNotice: false,
      thresholds: { spo2Lower: 90, mapLower: 65, systolicLower: 90, systolicUpper: 180, diastolicUpper: 120, heartRateLower: 50, heartRateUpper: 150, temperatureLower: 36, temperatureUpper: 38.5, temperatureRiseDelta: 0.5, temperatureRiseWindowMinutes: 15 },
    }));
  }, { startedAt, caseId });
  await page.reload();
  await expect(page.getByTestId("case-started")).toBeVisible();
  const warnSelector = '[data-testid^="critical-warning-"]:not([data-testid="critical-warning-layer"])';
  await expect(page.locator(warnSelector)).toHaveCount(3);
  const area = page.getByTestId("timeline-create-area");
  await page.getByTestId("band-spo2").scrollIntoViewIfNeeded();

  const hoverBoxes = async (pointIndex: number) => {
    const pt = await page.evaluate((i) => {
      const circles = [...document.querySelectorAll('[data-testid^="point-spo2-"]')]
        .map((c) => c.getBoundingClientRect())
        .sort((a, b) => a.left - b.left);
      const r = circles[i];
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, pointIndex);
    await pointer(area, "move", pt.x, pt.y, "pen", 411);
    await expect(page.getByTestId("timeline-crosshair")).toBeVisible();
    await expect(page.getByTestId("therapy-interval-tooltip")).toBeVisible();
    return page.evaluate((sel) => {
      const plain = (el: Element | null) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      };
      return {
        coord: plain(document.querySelector('[data-testid="timeline-crosshair"] .crosshair-tooltip')),
        med: plain(document.querySelector('[data-testid="therapy-interval-tooltip"] rect')),
        warns: [...document.querySelectorAll(sel)].map(plain),
        vw: window.innerWidth,
      };
    }, warnSelector);
  };

  type Box = { left: number; top: number; right: number; bottom: number };
  const intersect = (a: Box, b: Box) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);

  for (const index of [1, 2, 0]) { // Mitte, rechte Kante, linke Kante
    const boxes = await hoverBoxes(index);
    expect(boxes.coord).not.toBeNull();
    expect(boxes.med).not.toBeNull();
    const coord = boxes.coord as Box;
    const med = boxes.med as Box;
    for (const w of boxes.warns as Box[]) {
      expect(intersect(coord, w)).toBe(false);
      expect(intersect(med, w)).toBe(false);
    }
    expect(intersect(coord, med)).toBe(false);
    // Kein horizontaler Viewport-Overflow an den Kanten.
    expect(coord.left).toBeGreaterThanOrEqual(0);
    expect(coord.right).toBeLessThanOrEqual(boxes.vw);
    expect(med.left).toBeGreaterThanOrEqual(0);
    expect(med.right).toBeLessThanOrEqual(boxes.vw);
  }
});

// ---- Runde 4: Scroll-Sperre, Vorschau-Ersetzung, Therapie-Info, Endmarker, NIBP-Aktivgriff ----

// R4 Story 1: In Grafik UND Lanes verschiebt ein Pencil-Zug die Seite nicht;
// ausserhalb bleibt die Seite scrollbar.
test("iPad R4 Story 1: Pencil-Zug in Grafik und Lanes scrollt die Seite nicht", async ({ page }) => {
  await seedStartedCase(page, 20);
  const scrollable = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
  expect(scrollable).toBe(true);

  const dragWithin = async (locator: Locator, id: number) => {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    const x = box!.x + box!.width * 0.2;
    const y = box!.y + box!.height / 2;
    await page.evaluate(() => window.scrollTo(0, 150));
    const before = await page.evaluate(() => window.scrollY);
    await pointer(locator, "down", x, y, "pen", id);
    for (const dy of [-40, -80, 40, 90]) await pointer(locator, "move", x + 5, y + dy, "pen", id);
    const during = await page.evaluate(() => window.scrollY);
    await pointer(locator, "up", x + 5, y + 90, "pen", id);
    const after = await page.evaluate(() => window.scrollY);
    expect(during).toBe(before);
    expect(after).toBe(before);
  };

  await dragWithin(page.getByTestId("timeline-create-area"), 701);
  await dragWithin(page.getByTestId("lane-create-medication"), 702);
  await dragWithin(page.getByTestId("lane-create-infusion"), 703);

  // Ausserhalb der interaktiven Flächen bleibt normales Scrollen möglich.
  await page.evaluate(() => window.scrollTo(0, 60));
  expect(await page.evaluate(() => window.scrollY)).toBe(60);
  // Und der Body bleibt nach der Interaktion entsperrt.
  expect(await page.evaluate(() => document.body.dataset.timelineScrollLock ?? "none")).toBe("none");
});

// R4 Story 2: Neue Berührung ersetzt die alte Vorschau sofort – in beiden Lanes.
test("iPad R4 Story 2: neue Berührung ersetzt die alte Vorschau sofort (Medikamente und Infusionen)", async ({ page }) => {
  await seedStartedCase(page, 20);
  for (const [lane, id] of [["medication", 710], ["infusion", 720]] as const) {
    const target = page.getByTestId(`lane-create-${lane}`);
    const box = await target.boundingBox();
    const y = box!.y + box!.height / 2;
    const x1 = box!.x + box!.width * 0.1;
    const x2 = box!.x + box!.width * 0.3;
    await tap(target, x1, y, "pen", id);
    await expect(page.getByTestId("timeline-preview")).toHaveCount(1);
    const firstTime = await page.getByTestId("preview-coordinate").textContent();
    // Neue Berührung weit entfernt: alte Vorschau sofort weg (schon beim pointerdown).
    await pointer(target, "down", x2, y, "pen", id + 1);
    await expect(page.getByTestId("timeline-preview")).toHaveCount(0);
    await pointer(target, "up", x2, y, "pen", id + 1);
    await expect(page.getByTestId("timeline-preview")).toHaveCount(1);
    expect(await page.getByTestId("preview-coordinate").textContent()).not.toBe(firstTime);
  }
});

// R4 Story 3: Beim Ziehen über die Grafik bleiben Koordinate UND Therapie-Info sichtbar.
test("iPad R4 Story 3: Therapie-Info erscheint beim Pencil-Zug über die Grafik", async ({ page }) => {
  const startedAt = Date.now() - 20 * 60_000;
  await page.goto("/dokumentation");
  await page.evaluate((started) => {
    localStorage.setItem("sikant-anesthesia-demo-case:v1", JSON.stringify({
      schemaVersion: 6, caseId: "r4-therapy", caseRevision: 1, lastSuccessfullyExportedRevision: null,
      startedAt: started, endedAt: null, measurements: [],
      medications: [{ id: "m1", kind: "medication", administrationType: "continuous", name: "Dauer-Perfusor", startedAt: started + 60_000, dose: 4, unit: { label: "mg", code: "mg", system: "UCUM", isCustom: false }, concentration: null, endedAt: null, ongoing: true, createdAt: started, updatedAt: started }],
      infusions: [], events: [], lastSavedAt: started,
    }));
  }, startedAt);
  await page.reload();
  await expect(page.getByTestId("case-started")).toBeVisible();

  const area = page.getByTestId("timeline-create-area");
  const band = await page.getByTestId("band-spo2").boundingBox();
  const box = await area.boundingBox();
  const x = box!.x + box!.width * 0.2;
  const y = band!.y + band!.height / 2;
  await pointer(area, "down", x, y, "pen", 731);
  await pointer(area, "move", x + 12, y + 10, "pen", 731);
  await expect(page.getByTestId("timeline-crosshair")).toBeVisible();
  await expect(page.getByTestId("crosshair-coordinate")).toContainText("SpO₂");
  await expect(page.getByTestId("therapy-interval-tooltip")).toContainText("Dauer-Perfusor");
  await pointer(area, "up", x + 12, y + 10, "pen", 731);
});

// R4 Story 4: "Anwendung beenden" fixiert den Endmarker; spätere Berührungen verschieben ihn nicht.
test("iPad R4 Story 4: Endmarker bleibt nach 'Anwendung beenden' an seiner Stelle", async ({ page }) => {
  const startedAt = Date.now() - 20 * 60_000;
  await page.goto("/dokumentation");
  await page.evaluate((started) => {
    localStorage.setItem("sikant-anesthesia-demo-case:v1", JSON.stringify({
      schemaVersion: 6, caseId: "r4-end", caseRevision: 1, lastSuccessfullyExportedRevision: null,
      startedAt: started, endedAt: null, measurements: [],
      medications: [{ id: "m9", kind: "medication", administrationType: "continuous", name: "Laufender Perfusor", startedAt: started + 60_000, dose: 4, unit: { label: "mg", code: "mg", system: "UCUM", isCustom: false }, concentration: null, endedAt: null, ongoing: true, createdAt: started, updatedAt: started }],
      infusions: [], events: [], lastSavedAt: started,
    }));
  }, startedAt);
  await page.reload();

  await page.getByTestId("medication-m9-stop-action").click();
  const ended = await page.evaluate(() => JSON.parse(localStorage.getItem("sikant-anesthesia-demo-case:v1")!).medications[0].endedAt);
  expect(ended).toBeGreaterThan(startedAt);

  // Berührung an anderer Stelle in der Medikamente-Lane: nur neue Vorschau.
  const lane = page.getByTestId("lane-create-medication");
  const box = await lane.boundingBox();
  const x = box!.x + box!.width * 0.15;
  const y = box!.y + box!.height / 2;
  await tap(lane, x, y, "pen", 741);
  await expect(page.getByTestId("timeline-preview")).toBeVisible();
  const afterTouch = await page.evaluate(() => JSON.parse(localStorage.getItem("sikant-anesthesia-demo-case:v1")!).medications[0].endedAt);
  expect(afterTouch).toBe(ended);

  await page.reload();
  const reloaded = await page.evaluate(() => JSON.parse(localStorage.getItem("sikant-anesthesia-demo-case:v1")!).medications[0].endedAt);
  expect(reloaded).toBe(ended);
});

// R4 Story 5: "Alles Löschen" fragt nach und leert dann nur die Formulareingaben.
test("iPad R4 Story 5: 'Alles Löschen' löscht erst nach Bestätigung", async ({ page }) => {
  await seedStartedCase(page, 20);
  const lane = page.getByTestId("lane-create-medication");
  const box = await lane.boundingBox();
  const x = box!.x + box!.width * 0.2;
  const y = box!.y + box!.height / 2;
  await tap(lane, x, y, "pen", 751);
  await tap(lane, x, y, "pen", 752);
  await expect(page.getByTestId("medication-name")).toBeVisible();

  await page.getByTestId("medication-name").fill("Test-Medikament");
  await page.getByTestId("medication-dose").fill("7");
  await expect(page.getByTestId("therapy-clear-all")).toBeVisible();

  // Erster Klick löscht nicht, sondern fragt.
  await page.getByTestId("therapy-clear-all").click();
  await expect(page.getByText("Alle Eingaben löschen?")).toBeVisible();
  await expect(page.getByTestId("medication-name")).toHaveValue("Test-Medikament");
  await page.locator(".ant-popconfirm").getByRole("button", { name: "Abbrechen" }).click();
  await expect(page.getByTestId("medication-name")).toHaveValue("Test-Medikament");

  // Nach Bestätigung sind die Eingaben leer.
  await page.getByTestId("therapy-clear-all").click();
  await page.locator(".ant-popconfirm").getByRole("button", { name: "Alles löschen" }).click();
  await expect(page.getByTestId("medication-name")).toHaveValue("");
  await expect(page.getByTestId("medication-dose")).toHaveValue("");
});

// R4 Story 6: Aktiver NIBP-Griff wird schwarz, der andere bleibt weiss.
test("iPad R4 Story 6: aktiver NIBP-Griff ist schwarz, der andere weiss", async ({ page }) => {
  await seedStartedCase(page, 20, [
    { id: "n4", kind: "nibp", time: Date.now() - 15 * 60_000, systolic: 120, mean: 90, diastolic: 60, createdAt: Date.now(), updatedAt: Date.now() },
  ]);
  const dia = page.getByTestId("nibp-handle-diastolic").locator('circle[role="button"]');
  const box = await dia.boundingBox();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;

  const activeStates = () => page.evaluate(() => ({
    systolic: document.querySelector('[data-testid="nibp-handle-systolic"]')?.getAttribute("data-active"),
    diastolic: document.querySelector('[data-testid="nibp-handle-diastolic"]')?.getAttribute("data-active"),
  }));

  expect(await activeStates()).toEqual({ systolic: "false", diastolic: "false" });
  await pointer(dia, "down", x, y, "pen", 761);
  expect(await activeStates()).toEqual({ systolic: "false", diastolic: "true" });
  // Der aktive Griff ist schwarz gefüllt.
  const fill = await page.evaluate(() => {
    const visual = document.querySelectorAll('[data-testid="nibp-handle-diastolic"] circle')[1];
    return getComputedStyle(visual).fill;
  });
  expect(fill).toBe("rgb(0, 0, 0)");
  await pointer(dia, "up", x, y, "pen", 761);
  // Nach dem Loslassen wieder weiss/inaktiv.
  expect(await activeStates()).toEqual({ systolic: "false", diastolic: "false" });
});

// ---- Runde 5: Vorschaukreis-Zeit, NIBP-Scroll, Nähe der Tooltips, Ereignisse nach OP-Ende,
//      strikter kritischer Hinweis, ausgewählte Messpunkte ----

// R5 Story 1: Jede Berührung im gestrichelten Kreis übernimmt exakt die gemerkte Uhrzeit.
test("iPad R5 Story 1: jede Stelle im Vorschaukreis übernimmt dieselbe Uhrzeit", async ({ page }) => {
  await seedStartedCase(page, 25);
  for (const [lane, field, id] of [["medication", "medication-name", 810], ["infusion", "infusion-name", 830]] as const) {
    const target = page.getByTestId(`lane-create-${lane}`);
    const box = await target.boundingBox();
    const y = box!.y + box!.height / 2;
    const x = box!.x + box!.width * 0.18;
    await tap(target, x, y, "pen", id);
    await expect(page.getByTestId("preview-circle")).toBeVisible();
    const pinned = ((await page.getByTestId("preview-coordinate").textContent()) ?? "").trim();
    // Zweite Berührung deutlich versetzt, aber innerhalb des Kreises.
    await tap(target, x + 17, y - 12, "pen", id + 1);
    await expect(page.getByTestId(field)).toBeVisible();
    const formTime = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="therapy-time"]');
      const input = el?.tagName === "INPUT" ? el : el?.querySelector("input");
      return (input as HTMLInputElement | null)?.value ?? "";
    });
    expect(formTime).toBe(pinned);
    await page.getByTestId("therapy-cancel").click();
    await expect(page.getByTestId(field)).toHaveCount(0);
  }
});

// R5 Story 2: NIBP-Griffe ziehen sperrt den Seiten-Scroll.
test("iPad R5 Story 2: Ziehen an Systolisch/Diastolisch scrollt die Seite nicht", async ({ page }) => {
  await seedStartedCase(page, 20, [
    { id: "n5", kind: "nibp", time: Date.now() - 15 * 60_000, systolic: 120, mean: 90, diastolic: 60, createdAt: Date.now(), updatedAt: Date.now() },
  ]);
  for (const [part, id] of [["systolic", 851], ["diastolic", 861]] as const) {
    const handle = page.getByTestId(`nibp-handle-${part}`).locator('circle[role="button"]');
    const box = await handle.boundingBox();
    const x = box!.x + box!.width / 2;
    const y = box!.y + box!.height / 2;
    await page.evaluate(() => window.scrollTo(0, 120));
    const before = await page.evaluate(() => window.scrollY);
    await pointer(handle, "down", x, y, "pen", id);
    expect(await page.evaluate(() => document.body.dataset.timelineScrollLock ?? "none")).toBe("true");
    for (const dy of [-30, -60, 30, 70]) await pointer(handle, "move", x, y + dy, "pen", id);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
    await pointer(handle, "up", x, y + 70, "pen", id);
    expect(await page.evaluate(() => document.body.dataset.timelineScrollLock ?? "none")).toBe("none");
  }
});

// R5 Story 3: Koordinaten-/Info-Boxen erscheinen nahe am Stift.
test("iPad R5 Story 3: Koordinate erscheint direkt beim Stift", async ({ page }) => {
  await seedStartedCase(page, 20);
  const area = page.getByTestId("timeline-create-area");
  const band = await page.getByTestId("band-temperature").boundingBox();
  const box = await area.boundingBox();
  const x = box!.x + box!.width * 0.2;
  const y = band!.y + band!.height / 2;
  await pointer(area, "down", x, y, "pen", 871);
  await pointer(area, "move", x + 6, y + 4, "pen", 871);
  await expect(page.getByTestId("timeline-crosshair")).toBeVisible();
  const distance = await page.evaluate(({ px, py }) => {
    const r = document.querySelector('[data-testid="timeline-crosshair"] .crosshair-tooltip')!.getBoundingClientRect();
    const dx = Math.max(r.left - px, 0, px - r.right);
    const dy = Math.max(r.top - py, 0, py - r.bottom);
    return Math.hypot(dx, dy);
  }, { px: x + 6, py: y + 4 });
  // Nahe am Stift (nicht am anderen Ende der Grafik).
  expect(distance).toBeLessThan(90);
  await pointer(area, "up", x + 6, y + 4, "pen", 871);
});

// R5 Story 4: Nach "Eingriff beenden" lassen sich Ereignisse weiterhin platzieren.
test("iPad R5 Story 4: Phasen und Ereignisse auch nach OP-Ende platzierbar", async ({ page }) => {
  const startedAt = Date.now() - 30 * 60_000;
  await page.goto("/dokumentation");
  await page.evaluate((started) => {
    localStorage.setItem("sikant-anesthesia-demo-case:v1", JSON.stringify({
      schemaVersion: 6, caseId: "r5-ended", caseRevision: 1, lastSuccessfullyExportedRevision: null,
      startedAt: started, endedAt: started + 20 * 60_000,
      measurements: [], medications: [], infusions: [], events: [], lastSavedAt: started,
    }));
  }, startedAt);
  await page.reload();
  await expect(page.getByTestId("case-ended")).toBeVisible();

  const tool = page.getByTestId("select-event-incision");
  await expect(tool).toBeEnabled();
  await tool.click();
  await expect(tool).toHaveAttribute("aria-pressed", "true");

  const lane = page.getByTestId("lane-create-event");
  const box = await lane.boundingBox();
  const x = box!.x + box!.width * 0.15;
  const y = box!.y + box!.height / 2;
  await tap(lane, x, y, "pen", 881);
  await tap(lane, x, y, "pen", 882);
  await expect(page.getByTestId("event-incision")).toBeVisible();
  const events = (await readCase(page)).events;
  expect(events).toHaveLength(1);
  expect(events[0].time).toBeLessThanOrEqual(startedAt + 20 * 60_000);
});

// R5 Story 5: Kritischer Hinweis nur exakt auf dem Messwert, nicht daneben.
test("iPad R5 Story 5: kritischer Hinweis erscheint nur direkt auf dem Messwert", async ({ page }) => {
  const startedAt = Date.now() - 20 * 60_000;
  await page.goto("/dokumentation");
  await page.evaluate((started) => {
    localStorage.setItem("sikant-anesthesia-demo-case:v1", JSON.stringify({
      schemaVersion: 6, caseId: "r5-crit", caseRevision: 1, lastSuccessfullyExportedRevision: null,
      startedAt: started, endedAt: null,
      measurements: [{ id: "c1", kind: "spo2", time: started + 5 * 60_000, value: 80, createdAt: started, updatedAt: started }],
      medications: [], infusions: [], events: [], lastSavedAt: started,
    }));
    localStorage.setItem("sikant-critical-values:v1:r5-crit", JSON.stringify({
      schemaVersion: 1, caseId: "r5-crit", birthDate: "", ageGroup: "adult", source: "custom", ageChangedNotice: false,
      thresholds: { spo2Lower: 90, mapLower: 65, systolicLower: 90, systolicUpper: 180, diastolicUpper: 120, heartRateLower: 50, heartRateUpper: 150, temperatureLower: 36, temperatureUpper: 38.5, temperatureRiseDelta: 0.5, temperatureRiseWindowMinutes: 15 },
    }));
  }, startedAt);
  await page.reload();
  await expect(page.locator('[data-testid^="critical-warning-"]:not([data-testid="critical-warning-layer"])')).toHaveCount(1);

  const area = page.getByTestId("timeline-create-area");
  const marker = await page.locator('[data-testid^="point-spo2-"]').first().boundingBox();
  const mx = marker!.x + marker!.width / 2;
  const my = marker!.y + marker!.height / 2;

  // Deutlich neben dem Messwert: KEIN kritischer Hinweis (andere Hinweise wie die
  // Kontrollzeit dürfen dort weiterhin erscheinen).
  await pointer(area, "move", mx + 90, my + 55, "pen", 891);
  await expect(page.getByTestId("timeline-crosshair")).toBeVisible();
  const asideText = (await page.getByTestId("warning-info").textContent().catch(() => "")) ?? "";
  expect(asideText).not.toContain("Kritischer Hinweis");

  // Genau auf dem Messwert: der Hinweis erscheint.
  await pointer(area, "move", mx, my, "pen", 891);
  await expect(page.getByTestId("warning-info")).toContainText("Kritischer Hinweis");
});

// R5 Story 6: Bestehende Punkte bewegen sich nur nach Auswahl (schwarzer Ring).
test("iPad R5 Story 6: Messpunkt folgt dem Stift erst nach Antippen", async ({ page }) => {
  const startedAt = Date.now() - 20 * 60_000;
  await seedStartedCase(page, 20, [
    { id: "pt1", kind: "spo2", time: startedAt + 5 * 60_000, value: 96, createdAt: startedAt, updatedAt: startedAt },
  ]);
  const area = page.getByTestId("timeline-create-area");
  const pointBox = await page.locator('[data-testid^="point-spo2-"]').first().boundingBox();
  const px = pointBox!.x + pointBox!.width / 2;
  const py = pointBox!.y + pointBox!.height / 2;
  const valueOf = async () => (await readCase(page)).measurements[0].value;
  const original = await valueOf();

  // 1) Ohne Auswahl: Darüberziehen verändert den Punkt NICHT und waehlt ihn nicht aus.
  await pointer(area, "down", px, py, "pen", 901);
  await pointer(area, "move", px + 5, py - 45, "pen", 901);
  await pointer(area, "up", px + 5, py - 45, "pen", 901);
  expect(await valueOf()).toBe(original);
  await expect(page.getByTestId("point-armed-pt1")).toHaveCount(0);
  await expect(page.getByTestId("entry-value")).toHaveCount(0);

  // 2) Antippen (ohne Bewegung) waehlt den Punkt aus: schwarzer Ring, kein Formular.
  await tap(area, px, py, "pen", 902);
  await expect(page.getByTestId("point-armed-pt1")).toBeVisible();
  await expect(page.getByTestId("entry-value")).toHaveCount(0);

  // 3) Mit Auswahl folgt der Punkt dem Stift und wird gespeichert.
  await pointer(area, "down", px, py, "pen", 903);
  await pointer(area, "move", px, py - 40, "pen", 903);
  await pointer(area, "up", px, py - 40, "pen", 903);
  const moved = await valueOf();
  expect(moved).not.toBe(original);
  await expect(page.getByTestId("point-armed-pt1")).toBeVisible();

  // 4) Erneutes Antippen hebt die Auswahl auf; danach bleibt der Wert fest.
  const armedBox = await page.locator('[data-testid^="point-spo2-"]').first().boundingBox();
  const ax = armedBox!.x + armedBox!.width / 2;
  const ay = armedBox!.y + armedBox!.height / 2;
  await tap(area, ax, ay, "pen", 904);
  await expect(page.getByTestId("point-armed-pt1")).toHaveCount(0);
  await pointer(area, "down", ax, ay, "pen", 905);
  await pointer(area, "move", ax + 4, ay + 50, "pen", 905);
  await pointer(area, "up", ax + 4, ay + 50, "pen", 905);
  expect(await valueOf()).toBe(moved);
});

// R5 Story 7: "Alles löschen" neben "Speichern und Schließen" fragt vorher nach.
test("iPad R5 Story 7: OP-Daten verwerfen erst nach Bestätigung", async ({ page }) => {
  const startedAt = Date.now() - 30 * 60_000;
  await page.goto("/dokumentation");
  await page.evaluate((started) => {
    localStorage.setItem("sikant-anesthesia-demo.patient-base-data.v1", JSON.stringify({
      patientName: "Testperson Beispiel", birthDate: "01.01.2000", procedure: "Test-OP", operationDate: "01.08.2026",
      bodyWeightKg: 70, weightUnit: "kg", asaClass: "II", mallampatiClass: "I", allergies: "keine",
      noKnownAllergies: false, updatedAt: null,
    }));
    localStorage.setItem("sikant-anesthesia-demo-case:v1", JSON.stringify({
      schemaVersion: 6, caseId: "r5-discard", caseRevision: 1, lastSuccessfullyExportedRevision: null,
      startedAt: started, endedAt: started + 10 * 60_000,
      measurements: [{ id: "m1", kind: "spo2", time: started + 60_000, value: 97, createdAt: started, updatedAt: started }],
      medications: [], infusions: [], events: [], lastSavedAt: started,
    }));
  }, startedAt);
  await page.reload();
  await expect(page.getByTestId("case-ended")).toBeVisible();
  await expect(page.getByTestId("save-close-case")).toBeVisible();

  // Abbrechen löscht nichts.
  await page.getByTestId("discard-case").click();
  await expect(page.getByTestId("discard-case-text")).toContainText("Testperson Beispiel");
  await page.getByTestId("discard-case-cancel").click();
  expect((await readCase(page)).measurements).toHaveLength(1);

  // Bestätigen verwirft den Fall.
  await page.getByTestId("discard-case").click();
  await page.getByTestId("discard-case-confirm").click();
  await expect(page.getByTestId("start-button")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("sikant-anesthesia-demo-case:v1"))).toBeNull();
  // Basisdaten bleiben erhalten.
  expect(await page.evaluate(() => localStorage.getItem("sikant-anesthesia-demo.patient-base-data.v1"))).not.toBeNull();
});

// R5 Story 8: Ereignis-Formular hat keinen "Alles Löschen"-Button (Entfernen genügt).
test("iPad R5 Story 8: Ereignis-Formular ohne 'Alles Löschen'", async ({ page }) => {
  await seedStartedCase(page, 20);
  await page.getByTestId("select-event-extra").click();
  const lane = page.getByTestId("lane-create-event");
  const box = await lane.boundingBox();
  const x = box!.x + box!.width * 0.15;
  const y = box!.y + box!.height / 2;
  await tap(lane, x, y, "pen", 921);
  await tap(lane, x, y, "pen", 922);
  await expect(page.getByTestId("event-comment")).toBeVisible();
  await expect(page.getByTestId("therapy-clear-all")).toHaveCount(0);
  await expect(page.getByTestId("therapy-delete")).toBeVisible();
});

// R5 Story 9: NIBP-Werte und Uhrzeit stehen in einem Textblock.
test("iPad R5 Story 9: NIBP zeigt S/M/D und die Zeit in einem Block", async ({ page }) => {
  await seedStartedCase(page, 20, [
    { id: "n9", kind: "nibp", time: Date.now() - 15 * 60_000, systolic: 120, mean: 90, diastolic: 60, createdAt: Date.now(), updatedAt: Date.now() },
  ]);
  const handle = page.getByTestId("nibp-handle-systolic").locator('circle[role="button"]');
  const box = await handle.boundingBox();
  await pointer(handle, "down", box!.x + box!.width / 2, box!.y + box!.height / 2, "pen", 931);
  const tooltip = page.locator('[data-testid^="nibp-values-"]');
  await expect(tooltip).toContainText("S 120 · M 90 · D 60 mmHg");
  await expect(tooltip).toContainText(/\d{2}:\d{2}:\d{2}/);
  // Genau ein Kasten mit beiden Zeilen.
  expect(await tooltip.locator("text").count()).toBe(2);
  await pointer(handle, "up", box!.x + box!.width / 2, box!.y + box!.height / 2, "pen", 931);
});

// R5 Story 10: Der erste Eintrag der Einheitenliste (mL) ist per Tippen waehlbar.
test("iPad R5 Story 10: erste Einheit (mL) laesst sich antippen und wird uebernommen", async ({ page }) => {
  await seedStartedCase(page, 25);
  // Formular deterministisch oeffnen: dieser Test prueft ausschliesslich die
  // Einheitenliste. Der Zwei-Schritt-Ablauf (mit 3-Sekunden-Vorschau) ist in
  // R5 Story 1 abgedeckt und wird hier bewusst nicht erneut durchlaufen.
  await page.getByTestId("lane-create-infusion").press("Enter");
  await expect(page.getByTestId("infusion-name")).toBeVisible();

  const unit = page.getByTestId("infusion-unit");
  await unit.click();
  const dropdown = page.locator(".ant-select-dropdown:not(.ant-select-dropdown-hidden)").last();
  await expect(dropdown).toBeVisible();
  const firstOption = dropdown.locator('.ant-select-item-option[title="mL"]');
  await expect(firstOption).toBeVisible();
  // Sichtbar und gross genug, um mit dem Stift getroffen zu werden.
  const optionBox = await firstOption.boundingBox();
  expect(optionBox!.height).toBeGreaterThanOrEqual(24);
  await firstOption.click();
  await expect(unit).toContainText("mL");

  // Wert speichern und pruefen, dass genau mL uebernommen wurde.
  await page.getByTestId("infusion-name").fill("Ringer");
  await page.getByTestId("infusion-amount").fill("500");
  await page.getByTestId("therapy-duration").fill("10");
  await page.getByTestId("therapy-save").click();
  await expect(page.getByTestId("infusion-name")).toHaveCount(0);
  const stored = (await readCase(page)).infusions[0];
  expect(stored.unit.code).toBe("mL");
});
