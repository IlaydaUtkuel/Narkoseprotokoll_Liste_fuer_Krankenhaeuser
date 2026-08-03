import { test, expect, type Page } from "@playwright/test";

// --- Hilfsfunktionen: echte Pointer-Interaktion (Maus) auf dem gemeinsamen SVG ---

// Tap nahe der Jetzt-Linie in einem Band (zum Anlegen eines Wertes ~ jetzt).
async function tapBandNow(page: Page, kind: string) {
  const band = page.locator(`[data-testid="band-${kind}"]`);
  const area = page.getByTestId("timeline-create-area");
  await band.scrollIntoViewIfNeeded();
  const [bandBox, areaBox, nowBox] = await Promise.all([band.boundingBox(), area.boundingBox(), page.getByTestId("now-dot").boundingBox()]);
  expect(bandBox).not.toBeNull();
  expect(areaBox).not.toBeNull();
  expect(nowBox).not.toBeNull();
  await area.click({ position: {
    x: Math.min(areaBox!.width - 3, Math.max(3, nowBox!.x + nowBox!.width / 2 - areaBox!.x)),
    y: bandBox!.y + bandBox!.height / 2 - areaBox!.y,
  } });
}

// Tap an einem horizontalen Anteil der Plotbreite (fuer Fehlerfaelle: Zukunft / vor Start).
async function tapBandFraction(page: Page, kind: string, fraction: number) {
  const band = page.locator(`[data-testid="band-${kind}"]`);
  const area = page.getByTestId("timeline-create-area");
  await band.scrollIntoViewIfNeeded();
  const [bandBox, areaBox] = await Promise.all([band.boundingBox(), area.boundingBox()]);
  expect(bandBox).not.toBeNull();
  expect(areaBox).not.toBeNull();
  await area.click({ position: {
    x: areaBox!.width * fraction,
    y: bandBox!.y + bandBox!.height / 2 - areaBox!.y,
  } });
}

async function tapLaneFraction(page: Page, kind: "event" | "medication" | "infusion", fraction: number) {
  const lane = page.getByTestId(`lane-create-${kind}`);
  await lane.scrollIntoViewIfNeeded();
  const box = await lane.boundingBox();
  expect(box).not.toBeNull();
  await lane.click({ position: { x: box!.width * fraction, y: box!.height / 2 } });
}

// Tap auf ein konkretes Element (z.B. einen bestehenden Messpunkt).
async function tapSelector(page: Page, selector: string) {
  const pt = await page.evaluate((sel) => {
    const r = document.querySelector(sel)!.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, selector);
  await page.mouse.click(pt.x, pt.y);
}

// Startet den Fall und wartet, bis die Timeline vollstaendig im gestarteten Zustand
// gerendert ist (Jetzt-Indikator sichtbar), bevor getippt wird.
async function startCase(page: Page) {
  await page.getByTestId("start-button").click();
  await expect(page.getByTestId("case-started")).toBeVisible();
  await expect(page.getByTestId("now-dot")).toBeVisible();
  await expect(page.getByTestId("timeline-create-area")).toBeVisible();
}

async function addScalar(page: Page, kind: string, value: number) {
  await tapBandNow(page, kind);
  if (kind === "temperature") {
    const picker = page.getByRole("combobox", { name: "Temperatur auswählen" });
    await picker.fill(value.toFixed(1).replace(".", ","));
    await picker.press("Enter");
  } else {
    await page.getByTestId("entry-value").fill(String(value));
  }
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("entry-value")).toHaveCount(0);
}

async function addNibp(page: Page, sys: number, mean: number, dia: number) {
  await tapBandNow(page, "nibp");
  await page.getByTestId("entry-mean").fill(String(mean));
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("entry-mean")).toHaveCount(0);

  await page.getByTestId("nibp-handle-systolic").locator('circle[role="button"]').click();
  await page.getByTestId("entry-systolic").fill(String(sys));
  await page.getByTestId("entry-diastolic").fill(String(dia));
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("entry-diastolic")).toHaveCount(0);
}

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "").trim();
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

async function seedStartedCase(page: Page, minutesAgo = 20) {
  const now = Date.now();
  const startedAt = now - minutesAgo * 60_000;
  await page.evaluate(({ startedAt }) => {
    localStorage.setItem(
      "sikant-anesthesia-demo-case:v1",
      JSON.stringify({
        schemaVersion: 2,
        caseId: "demo-case-001",
        startedAt,
        endedAt: null,
        measurements: [],
        medications: [],
        infusions: [],
        events: [],
        lastSavedAt: startedAt,
      }),
    );
  }, { startedAt });
  await page.reload();
  await expect(page.getByTestId("case-started")).toBeVisible();
  return startedAt;
}

async function setTimePicker(page: Page, testId: string, value: string) {
  const root = page.getByTestId(testId);
  const nested = root.locator("input");
  const input = await nested.count() ? nested : root;
  await input.fill(value);
  await input.press("Escape");
}

async function selectTherapyUnit(page: Page, testId: "medication-unit" | "infusion-unit", label: string) {
  const select = page.getByTestId(testId);
  await select.click();
  const input = select.locator("input");
  await input.fill(label);
  const option = page.locator(`.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option[title="${label}"]`);
  await expect(option).toBeVisible();
  await input.press("Enter");
  await expect(select).toContainText(label);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

// Story 1: kompletter Nutzerfluss ab der ersten Seite.
test("Story 1: Basisdaten -> Okay und Weiter -> Start -> SpO2 -> Reload", async ({ page }) => {
  await page.reload();

  // Erste Seite sichtbar, Logo links oben.
  await expect(page.getByRole("heading", { name: "Basisdaten des Narkosefalls" })).toBeVisible();
  await expect(page.getByTestId("brand-mark")).toBeVisible();

  await page.getByTestId("input-procedure").fill("Appendektomie");
  await page.getByTestId("weiter").click();

  // Grafikseite: Logo + Fallkopf.
  await expect(page).toHaveURL(/\/dokumentation$/);
  await expect(page.getByTestId("brand-mark")).toBeVisible();
  await expect(page.getByTestId("case-header")).toContainText("Appendektomie");

  // Start.
  await startCase(page);

  // SpO2 dokumentieren.
  await addScalar(page, "spo2", 95);
  await expect(page.locator('[data-testid="spo2-area"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="points-spo2"] circle')).toHaveCount(1);
  await expect(page.getByTestId("save-status")).toContainText("Gespeichert");

  // Reload -> Start, Basisdaten und Messung bleiben erhalten.
  await page.reload();
  await expect(page.getByTestId("case-started")).toBeVisible();
  await expect(page.getByTestId("case-header")).toContainText("Appendektomie");
  await expect(page.locator('[data-testid="points-spo2"] circle')).toHaveCount(1);
});

// Story 2: vier Vitalparameter auf gemeinsamer X-Achse + Farb-Tokens.
test("Story 2: vier Parameter, gemeinsame Zeitachse, korrekte Farben", async ({ page }) => {
  await page.goto("/dokumentation");
  await startCase(page);

  await addScalar(page, "spo2", 96);
  await addScalar(page, "heartRate", 72);
  await addNibp(page, 120, 90, 70);
  await addScalar(page, "temperature", 36.7);

  const persistedNibp = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("sikant-anesthesia-demo-case:v1")!).measurements.find((measurement: { kind: string }) => measurement.kind === "nibp"),
  );
  expect(persistedNibp).toMatchObject({ systolic: 120, mean: 90, diastolic: 70 });
  await page.getByTestId("nibp-handle-systolic").hover();
  await expect(page.locator('[data-testid^="nibp-values-"]')).toContainText("S 120 · M 90 · D 70");
  await expect(page.locator('[data-testid^="nibp-values-"]')).toContainText("mmHg");

  // Kurzer Klick auf den weißen Griff öffnet die direkte Zahleneingabe;
  // Drag bleibt weiterhin die schnelle grafische Alternative.
  await page.getByTestId("nibp-handle-systolic").locator('circle[role="button"]').click();
  await expect(page.getByTestId("entry-systolic")).toHaveValue("120");
  await expect(page.getByTestId("entry-diastolic")).toHaveValue("70");
  await page.getByTestId("entry-systolic").fill("125");
  await page.getByTestId("entry-save").click();
  const directlyEditedNibp = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("sikant-anesthesia-demo-case:v1")!).measurements.find((measurement: { kind: string }) => measurement.kind === "nibp"),
  );
  expect(directlyEditedNibp).toMatchObject({ systolic: 125, mean: 90, diastolic: 70 });

  await expect(page.locator('[data-testid="points-spo2"] circle')).toHaveCount(1);
  await expect(page.locator('[data-testid="points-heartRate"] circle')).toHaveCount(1);
  await expect(page.locator('[data-testid="points-nibp"] circle')).toHaveCount(1);
  await expect(page.locator('[data-testid="points-temperature"] circle')).toHaveCount(1);

  // Vier Werte teilen dieselbe Jetzt-Zeit -> nahezu gleiche X-Koordinate.
  const xs = await page.evaluate(() =>
    ["spo2", "heartRate", "nibp", "temperature"].map((k) => {
      const c = document.querySelector(`[data-testid="points-${k}"] circle`) as SVGCircleElement;
      return c ? parseFloat(c.getAttribute("cx") || "0") : NaN;
    }),
  );
  for (const x of xs) expect(Math.abs(x - xs[0])).toBeLessThan(2);

  // Farb-Tokens (CSS-Variablen) werden verwendet.
  const tokens = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return {
      spo2: root.getPropertyValue("--vital-spo2"),
      heartRate: root.getPropertyValue("--vital-heart-rate"),
      nibp: root.getPropertyValue("--vital-nibp"),
      temperature: root.getPropertyValue("--vital-temperature"),
    };
  });
  const colors = await page.evaluate(() => {
    const strokeOf = (sel: string) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el).stroke : "";
    };
    const fillOf = (sel: string) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el).fill : "";
    };
    return {
      spo2: strokeOf('[data-testid="series-spo2"]'),
      heartRate: fillOf('[data-testid="points-heartRate"] circle'),
      nibp: strokeOf('[data-testid="series-nibp"]'),
      temperature: fillOf('[data-testid="points-temperature"] circle'),
    };
  });
  expect(colors.spo2).toBe(hexToRgb(tokens.spo2));
  expect(colors.heartRate).toBe(hexToRgb(tokens.heartRate));
  expect(colors.nibp).toBe(hexToRgb(tokens.nibp));
  expect(colors.temperature).toBe(hexToRgb(tokens.temperature));
});

// Story 3: bearbeiten und sicher loeschen.
test("Story 3: Wert bearbeiten und loeschen (kein Wiederkehren nach Reload)", async ({ page }) => {
  await page.goto("/dokumentation");
  await startCase(page);
  await addScalar(page, "spo2", 95);

  // Bearbeiten: 95 -> 90.
  await tapSelector(page, '[data-testid^="point-spo2-"]');
  await expect(page.getByTestId("entry-value")).toHaveValue("95");
  await page.getByTestId("entry-value").fill("90");
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("entry-value")).toHaveCount(0);

  const stored1 = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("sikant-anesthesia-demo-case:v1") || "{}"),
  );
  expect(stored1.measurements[0].value).toBe(90);

  // Loeschen mit Bestaetigung.
  await tapSelector(page, '[data-testid^="point-spo2-"]');
  await page.getByTestId("entry-delete").click();
  await page.getByRole("button", { name: "Löschen", exact: true }).click();
  await expect(page.locator('[data-testid="points-spo2"] circle')).toHaveCount(0);

  // Reload -> geloeschter Wert kehrt nicht zurueck.
  await page.reload();
  await expect(page.getByTestId("case-started")).toBeVisible();
  await expect(page.locator('[data-testid="points-spo2"] circle')).toHaveCount(0);
});

// Fehlerbehandlung: vor Start blockiert, Zukunft blockiert.
test("Fehlerfaelle: vor Start und in der Zukunft nicht dokumentierbar", async ({ page }) => {
  await page.goto("/dokumentation");

  // Vor dem Start.
  await tapBandFraction(page, "spo2", 0.3);
  await expect(page.getByText("Bitte starten Sie zuerst den Fall.")).toBeVisible();

  // Start, dann in die Zukunft tippen (weit rechts).
  await page.getByTestId("start-button").click();
  await expect(page.getByTestId("case-started")).toBeVisible();
  await tapBandFraction(page, "spo2", 0.95);
  await expect(page.getByText("Zukünftige Werte können nicht dokumentiert werden.")).toBeVisible();
  await expect(page.locator('[data-testid="points-spo2"] circle')).toHaveCount(0);
});

test("Story 4: Eingriff beenden, Zeit einfrieren und Reload", async ({ page }) => {
  await page.goto("/dokumentation");
  await startCase(page);
  await addScalar(page, "spo2", 95);

  await page.getByTestId("end-case-button").click();
  const confirmation = page.locator(".ant-popconfirm");
  await expect(confirmation).toContainText("Möchten Sie den Eingriff wirklich beenden?");
  await confirmation.getByRole("button", { name: "Eingriff beenden", exact: true }).click();
  await expect(page.getByTestId("case-ended")).toContainText(/Beendet um \d{2}:\d{2}:\d{2}/);

  const frozenX = await page.getByTestId("now-dot").getAttribute("cx");
  await page.waitForTimeout(700);
  expect(await page.getByTestId("now-dot").getAttribute("cx")).toBe(frozenX);

  await page.reload();
  await expect(page.getByTestId("case-ended")).toBeVisible();
  expect(await page.getByTestId("now-dot").getAttribute("cx")).toBe(frozenX);
  await tapBandFraction(page, "spo2", 0.5);
  // Fuer diesen Abschluss-Test gilt deterministisch: Es liegen keine
  // Basisdaten vor. Damit zeigt die Vollstaendigkeitspruefung den sachlichen
  // Hinweis samt expliziter Kenntnisnahme in jedem Lauf.
  await page.evaluate(() => {
    localStorage.removeItem("sikant-anesthesia-demo.patient-base-data.v1");
  });
  await expect(page.getByText("Nach dem Ende des Eingriffs können keine neuen Einträge dokumentiert werden.")).toBeVisible();

  // Abschluss öffnet eine neue Registerkarte, archiviert zuerst und setzt dann
  // Basisdaten + aktiven Fall für den nächsten Patienten zurück.
  await expect(page.getByTestId("save-close-case")).toBeVisible();
  await page.context().addInitScript(() => {
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: async () => ({
        name: "Narkoseprotokolle",
        getFileHandle: async (fileName: string) => ({
          createWritable: async () => ({
            write: async (file: File) => {
              (window as typeof window & { __savedCase?: unknown; __savedFileName?: string }).__savedCase = JSON.parse(await file.text());
              (window as typeof window & { __savedFileName?: string }).__savedFileName = fileName;
            },
            close: async () => undefined,
          }),
        }),
      }),
    });
  });
  const popupPromise = page.waitForEvent("popup");
  await page.getByTestId("save-close-case").click();
  const closePage = await popupPromise;
  await closePage.waitForURL("**/abschluss");
  await expect(closePage.getByRole("heading", { name: "Kontrolle" })).toBeVisible();
  await expect(closePage.getByTestId("case-basis-summary")).toBeVisible();
  await expect(closePage.getByTestId("case-timeline-preview")).toBeVisible();
  await expect(closePage.getByTestId("completeness-acknowledgement")).toBeVisible();
  await closePage.getByTestId("completeness-acknowledgement").click();
  await closePage.getByTestId("choose-directory").click();
  await expect(closePage.getByTestId("selected-directory")).toContainText("Narkoseprotokolle");
  await closePage.getByTestId("archive-confirmation").click();
  await closePage.getByTestId("archive-save").click();
  await expect(closePage.getByTestId("case-close-complete")).toBeVisible();
  const storageAfterClose = await closePage.evaluate(() => ({
    patient: localStorage.getItem("sikant-anesthesia-demo.patient-base-data.v1"),
    activeCase: localStorage.getItem("sikant-anesthesia-demo-case:v1"),
    archives: JSON.parse(localStorage.getItem("sikant-anesthesia-demo-archives:v1") || "[]").length,
    savedFileName: (window as typeof window & { __savedFileName?: string }).__savedFileName,
    savedCase: (window as typeof window & { __savedCase?: { endedAt?: number; measurements?: unknown[] } }).__savedCase,
  }));
  expect(storageAfterClose.patient).toBeNull();
  expect(storageAfterClose.activeCase).toBeNull();
  expect(storageAfterClose.archives).toBe(1);
  expect(storageAfterClose.savedFileName).toMatch(/^Narkosefall_.*\.json$/);
  expect(storageAfterClose.savedCase?.endedAt).toBeTruthy();
  expect(storageAfterClose.savedCase?.measurements).toHaveLength(1);
  await closePage.getByTestId("new-case-start").click();
  await expect(closePage.getByRole("heading", { name: "Basisdaten des Narkosefalls" })).toBeVisible();
  await expect(closePage.getByTestId("input-patientName")).toHaveValue("");
  await closePage.getByTestId("weiter").click();
  await expect(closePage.getByTestId("start-button")).toBeVisible();
});

test("Story 5: präzise Hit-Area und Crosshair auf freier Fläche", async ({ page }) => {
  await page.goto("/dokumentation");
  const startedAt = await seedStartedCase(page, 20);
  await page.evaluate(({ startedAt }) => {
    const stored = JSON.parse(localStorage.getItem("sikant-anesthesia-demo-case:v1")!);
    stored.measurements = [
      { id: "p1", kind: "spo2", time: startedAt + 2 * 60_000, value: 95, createdAt: startedAt, updatedAt: startedAt },
      { id: "p2", kind: "spo2", time: startedAt + 8 * 60_000, value: 97, createdAt: startedAt, updatedAt: startedAt },
    ];
    localStorage.setItem("sikant-anesthesia-demo-case:v1", JSON.stringify(stored));
  }, { startedAt });
  await page.reload();
  await page.locator('[data-testid="band-spo2"]').scrollIntoViewIfNeeded();
  const point = await page.evaluate(() => {
    const circles = [...document.querySelectorAll('[data-testid="points-spo2"] circle')];
    const svg = document.querySelector('[data-testid="vital-timeline-svg"]')!.getBoundingClientRect();
    const band = document.querySelector('[data-testid="band-spo2"]')!.getBoundingClientRect();
    const xs = circles.map((circle) => Number(circle.getAttribute("cx")));
    return { x: svg.left + xs[0] * 0.6 + xs[1] * 0.4, y: band.top + band.height / 2 };
  });
  await page.mouse.move(point.x, point.y);
  await expect(page.getByTestId("timeline-crosshair")).toBeVisible();
  await expect(page.getByTestId("crosshair-coordinate")).toContainText("SpO₂");
  await page.mouse.click(point.x, point.y);
  await expect(page.getByTestId("entry-value")).toBeVisible();
  await expect(page.getByText("SpO₂ dokumentieren", { exact: true })).toBeVisible();
});

test("Story 6: Zeit im Vitalformular ändern und persistieren", async ({ page }) => {
  await page.goto("/dokumentation");
  const startedAt = await seedStartedCase(page, 20);
  await tapBandFraction(page, "spo2", 0.15);
  await expect(page.getByTestId("entry-value")).toBeVisible();
  const target = startedAt + 5 * 60_000;
  const targetDate = new Date(target);
  const clock = [targetDate.getHours(), targetDate.getMinutes(), targetDate.getSeconds()]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
  await setTimePicker(page, "entry-time", clock);
  await page.getByTestId("entry-save").click();
  const storedTime = await page.evaluate(() => JSON.parse(localStorage.getItem("sikant-anesthesia-demo-case:v1")!).measurements[0].time);
  const expectedTime = target - target % 1000;
  expect(storedTime).toBe(expectedTime);
  await page.reload();
  const reloadedTime = await page.evaluate(() => JSON.parse(localStorage.getItem("sikant-anesthesia-demo-case:v1")!).measurements[0].time);
  expect(reloadedTime).toBe(expectedTime);
});

test("Story 7: ein- und fünfminütige Gridlinien", async ({ page }) => {
  await page.goto("/dokumentation");
  await startCase(page);
  await expect(page.getByTestId("grid-minor")).not.toHaveCount(0);
  await expect(page.getByTestId("grid-major")).not.toHaveCount(0);
  const widths = await page.evaluate(() => ({
    minor: getComputedStyle(document.querySelector('[data-testid="grid-minor"]')!).strokeWidth,
    major: getComputedStyle(document.querySelector('[data-testid="grid-major"]')!).strokeWidth,
  }));
  expect(Number.parseFloat(widths.major)).toBeGreaterThan(Number.parseFloat(widths.minor));
});

test("Story 8: Medikamente und Infusionen CRUD mit Persistence", async ({ page }) => {
  await page.goto("/dokumentation");
  await seedStartedCase(page, 20);

  await tapLaneFraction(page, "medication", 0.05);
  await page.getByTestId("medication-name").fill("Demo-Bolus");
  await page.getByTestId("medication-dose").fill("2");
  await selectTherapyUnit(page, "medication-unit", "Milligramm (mg)");
  await page.getByTestId("therapy-duration").fill("20");
  await page.getByTestId("therapy-save").click();
  await expect(page.getByTestId("medication-name")).toHaveCount(0);
  await expect(page.locator(".ant-drawer-mask")).toHaveCount(0);
  const medicationId = await page.evaluate(() => JSON.parse(localStorage.getItem("sikant-anesthesia-demo-case:v1")!).medications[0].id);
  await expect(page.getByTestId(`medication-${medicationId}`)).toBeVisible();
  await expect(page.getByTestId(`medication-duration-${medicationId}`)).toBeVisible();
  await expect(page.getByTestId(`medication-hatch-${medicationId}-spo2`)).toBeVisible();

  const hatch = page.getByTestId(`medication-hatch-${medicationId}-spo2`);
  await hatch.scrollIntoViewIfNeeded();
  const hatchPoint = await page.evaluate((id) => {
    const hatch = document.querySelector(`[data-testid="medication-hatch-${id}-spo2"]`)!.getBoundingClientRect();
    return { x: hatch.left + hatch.width / 2, y: hatch.top + hatch.height / 2 };
  }, medicationId);
  await page.mouse.move(0, 0);
  await page.mouse.move(hatchPoint.x, hatchPoint.y);
  await expect(page.getByTestId("therapy-interval-tooltip")).toContainText("Demo-Bolus");
  await expect(page.getByTestId("timeline-crosshair")).toBeVisible();
  const tooltipBoxes = await page.evaluate(() => {
    const therapy = document.querySelector('[data-testid="therapy-interval-tooltip"]')!.getBoundingClientRect();
    const crosshair = document.querySelector('[data-testid="timeline-crosshair"] .crosshair-tooltip')!.getBoundingClientRect();
    return { therapy: { left: therapy.left, right: therapy.right, top: therapy.top, bottom: therapy.bottom }, crosshair: { left: crosshair.left, right: crosshair.right, top: crosshair.top, bottom: crosshair.bottom } };
  });
  const overlap = !(tooltipBoxes.therapy.right <= tooltipBoxes.crosshair.left || tooltipBoxes.crosshair.right <= tooltipBoxes.therapy.left || tooltipBoxes.therapy.bottom <= tooltipBoxes.crosshair.top || tooltipBoxes.crosshair.bottom <= tooltipBoxes.therapy.top);
  expect(overlap).toBe(false);

  await tapLaneFraction(page, "medication", 0.35);
  await expect(page.getByTestId("medication-name")).toBeVisible();
  const continuousOption = page.getByTestId("medication-administration-type").locator('label:has(input[value="continuous"])');
  await continuousOption.click();
  await expect(page.getByRole("radio", { name: "Kontinuierliche Gabe" })).toBeChecked();
  await page.getByTestId("medication-name").fill("Demo-Perfusor");
  await page.getByTestId("medication-dose").fill("1");
  await selectTherapyUnit(page, "medication-unit", "mg/h");
  await page.getByTestId("therapy-duration").fill("15");
  await page.getByTestId("therapy-save").click();

  await page.getByTestId("lane-create-infusion").press("Enter");
  await page.getByTestId("infusion-name").fill("Ringer");
  await page.getByTestId("infusion-amount").fill("500");
  await selectTherapyUnit(page, "infusion-unit", "mL");
  await page.getByTestId("therapy-duration").fill("30");
  await page.getByTestId("therapy-save").click();
  const infusionId = await page.evaluate(() => JSON.parse(localStorage.getItem("sikant-anesthesia-demo-case:v1")!).infusions[0].id);
  await expect(page.getByTestId(`infusion-${infusionId}`)).toBeVisible();

  await page.getByTestId(`medication-${medicationId}`).press("Enter");
  await page.getByTestId("medication-dose").fill("3");
  await page.getByTestId("therapy-save").click();
  await page.getByTestId(`infusion-${infusionId}`).press("Enter");
  await page.getByTestId("therapy-delete").click();
  await page.locator(".ant-popconfirm").getByRole("button", { name: "Entfernen", exact: true }).click();
  await page.reload();
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem("sikant-anesthesia-demo-case:v1")!));
  expect(persisted.medications).toHaveLength(2);
  expect(persisted.medications[0].dose).toBe(3);
  expect(persisted.infusions).toHaveLength(0);
});

test("Story 9: fünf Phasen, Event-Drag und Entfernen", async ({ page }) => {
  await page.goto("/dokumentation");
  await seedStartedCase(page, 20);
  const types = ["anesthesiaStart", "incision", "suture", "emergenceEnd", "patientOut"];
  for (const [index, type] of types.entries()) {
    await page.getByTestId(`select-event-${type}`).click();
    await expect(page.getByTestId(`select-event-${type}`)).toHaveAttribute("aria-pressed", "true");
    await tapLaneFraction(page, "event", 0.08 + index * 0.06);
    await expect(page.getByTestId(`event-${type}`)).toBeVisible();
  }
  expect(await page.getByTestId("event-line").count()).toBe(5);

  const incision = page.getByTestId("event-hit-incision");
  await incision.scrollIntoViewIfNeeded();
  const box = await incision.boundingBox();
  expect(box).not.toBeNull();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("sikant-anesthesia-demo-case:v1")!).events.find((event: { eventType: string }) => event.eventType === "incision").time);
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 - 35, box!.y + box!.height / 2, { steps: 5 });
  await page.mouse.up();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("sikant-anesthesia-demo-case:v1")!).events.find((event: { eventType: string }) => event.eventType === "incision").time);
  expect(after).not.toBe(before);

  await page.getByTestId("event-hit-incision").click();
  await page.getByTestId("therapy-delete").click();
  await page.locator(".ant-popconfirm").getByRole("button", { name: "Entfernen", exact: true }).click();
  await page.reload();
  await expect(page.getByTestId("event-incision")).toHaveCount(0);
});

test("Story 10: kontextuelle Lanes, toggle Ereignisauswahl und große lesbare Ansicht", async ({ page }) => {
  await page.goto("/dokumentation");
  await seedStartedCase(page, 20);

  await expect(page.getByTestId("add-medication")).toHaveCount(0);
  await expect(page.getByTestId("add-infusion")).toHaveCount(0);
  await expect(page.getByTestId("event-lane-tools")).toBeVisible();

  const medicationHover = await page.getByTestId("lane-create-medication").boundingBox();
  expect(medicationHover).not.toBeNull();
  await page.mouse.move(medicationHover!.x + medicationHover!.width * 0.2, medicationHover!.y + medicationHover!.height / 2);
  await expect(page.getByTestId("lane-placement-preview")).toContainText(/\d{2}:\d{2}:\d{2} · Medikament anlegen/);
  await page.mouse.click(medicationHover!.x + medicationHover!.width * 0.2, medicationHover!.y + medicationHover!.height / 2);
  await expect(page.getByTestId("therapy-time")).not.toHaveValue("");
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();

  await page.getByTestId("select-event-incision").click();
  await page.getByTestId("select-event-incision").click();
  await expect(page.getByTestId("select-event-incision")).toHaveAttribute("aria-pressed", "false");
  const eventHover = await page.getByTestId("lane-create-event").boundingBox();
  expect(eventHover).not.toBeNull();
  await page.mouse.move(eventHover!.x + eventHover!.width * 0.2, eventHover!.y + eventHover!.height / 2);
  await expect(page.getByTestId("lane-placement-preview")).toHaveCount(0);
  await tapLaneFraction(page, "event", 0.2);
  await expect(page.getByTestId("event-incision")).toHaveCount(0);
  await page.getByTestId("select-event-incision").click();
  await page.mouse.move(eventHover!.x + eventHover!.width * 0.2, eventHover!.y + eventHover!.height / 2);
  await expect(page.getByTestId("lane-placement-preview")).toContainText("Schnitt platzieren");
  await tapLaneFraction(page, "event", 0.2);
  await expect(page.getByTestId("select-event-incision")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("select-event-incision")).toHaveAttribute("aria-pressed", "false");
  await page.getByTestId("event-hit-incision").click();
  const eventPicker = page.getByTestId("event-type").getByRole("combobox");
  await eventPicker.click();
  await page.locator(".ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option", { hasText: "Naht" }).click();
  await page.getByTestId("therapy-save").click();
  await expect(page.getByTestId("event-incision")).toHaveCount(0);
  await expect(page.getByTestId("event-suture")).toBeVisible();

  const layout = await page.evaluate(() => ({
    svgHeight: Number(document.querySelector('[data-testid="vital-timeline-svg"]')?.getAttribute("height")),
    spo2Height: Number(document.querySelector('[data-testid="band-spo2"]')?.getAttribute("height")),
    nibpHeight: Number(document.querySelector('[data-testid="band-nibp"]')?.getAttribute("height")),
    eventToolsTop: document.querySelector('[data-testid="event-lane-tools"]')?.getBoundingClientRect().top,
    eventLaneTop: document.querySelector('[data-testid="lane-events"]')?.getBoundingClientRect().top,
  }));
  expect(layout.svgHeight).toBeGreaterThan(950);
  expect(layout.spo2Height).toBeGreaterThanOrEqual(160);
  expect(layout.nibpHeight).toBeGreaterThanOrEqual(170);
  expect(layout.eventToolsTop).toBeGreaterThanOrEqual(layout.eventLaneTop!);
});

test("Ereignissymbol toggelt per Maus und iPad-Touch und bleibt nach Platzierung aktiv", async ({ page }, testInfo) => {
  await page.goto("/dokumentation");
  await seedStartedCase(page, 20);
  const tool = page.getByTestId("select-event-incision");
  const touch = testInfo.project.name === "ipad-viewport";
  const activate = async () => {
    if (!touch) return tool.click();
    const box = await tool.boundingBox();
    expect(box).not.toBeNull();
    await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
  };

  await activate();
  await expect(tool).toHaveAttribute("aria-pressed", "true");
  await activate();
  await expect(tool).toHaveAttribute("aria-pressed", "false");
  await activate();
  await expect(tool).toHaveAttribute("aria-pressed", "true");

  const lane = await page.getByTestId("lane-create-event").boundingBox();
  expect(lane).not.toBeNull();
  const laneX = lane!.x + lane!.width * 0.2;
  const laneY = lane!.y + lane!.height / 2;
  if (touch) {
    // iPad-Zwei-Schritt: erster Tap legt nur einen Geist-Marker ab, kein Ereignis.
    await page.touchscreen.tap(laneX, laneY);
    await expect(page.getByTestId("timeline-preview")).toBeVisible();
    await expect(page.getByTestId("event-incision")).toHaveCount(0);
    // Zweiter Tap auf dieselbe Stelle platziert das Ereignis.
    await page.touchscreen.tap(laneX, laneY);
  } else {
    await page.mouse.click(laneX, laneY);
  }
  await expect(page.getByTestId("event-incision")).toBeVisible();
  await expect(tool).toHaveAttribute("aria-pressed", "true");
  await activate();
  await expect(tool).toHaveAttribute("aria-pressed", "false");
});

test("Extra-Ereignis öffnet einen Kommentar-Entwurf, persistiert den Text und lässt sich löschen", async ({ page }) => {
  await page.goto("/dokumentation");
  await seedStartedCase(page, 20);
  const tool = page.getByTestId("select-event-extra");
  await tool.click();
  await expect(tool).toHaveAttribute("aria-pressed", "true");

  await tapLaneFraction(page, "event", 0.22);
  await expect(page.getByTestId("event-comment")).toBeVisible();
  await page.getByTestId("event-comment").fill("Noch nicht speichern");
  await page.getByTestId("therapy-delete").click();
  await expect(page.getByTestId("event-extra")).toHaveCount(0);
  await expect(tool).toHaveAttribute("aria-pressed", "true");

  await tapLaneFraction(page, "event", 0.26);
  await page.getByTestId("event-comment").fill("Unerwartete schwierige Maskenbeatmung");
  await page.getByTestId("therapy-save").click();
  await expect(page.getByTestId("event-extra")).toBeVisible();
  await expect(tool).toHaveAttribute("aria-pressed", "true");

  const marker = page.getByTestId("event-hit-extra");
  await marker.hover();
  await expect(page.locator('[data-testid^="event-comment-tooltip-"]')).toContainText("Unerwartete schwierige Maskenbeatmung");
  await marker.click();
  await expect(page.getByTestId("event-comment")).toHaveValue("Unerwartete schwierige Maskenbeatmung");
  await page.getByTestId("event-comment").fill("Maßnahme erfolgreich dokumentiert");
  await page.getByTestId("therapy-save").click();

  await page.reload();
  const reloadedMarker = page.getByTestId("event-hit-extra");
  await reloadedMarker.hover();
  await expect(page.locator('[data-testid^="event-comment-tooltip-"]')).toContainText("Maßnahme erfolgreich dokumentiert");
  await reloadedMarker.click();
  await page.getByTestId("therapy-delete").click();
  await page.locator(".ant-popconfirm").getByRole("button", { name: "Löschen", exact: true }).click();
  await page.reload();
  await expect(page.getByTestId("event-extra")).toHaveCount(0);
});

test("Checkpoint-Modus: Ausrufezeichen aktiviert direkte Y-Eingabe, Warnung verschwindet erst bei vier vollständigen Vitalwerten", async ({ page }) => {
  await page.goto("/dokumentation");
  const startedAt = await seedStartedCase(page, 6);
  const checkpoint = startedAt + 5 * 60_000;
  const warning = page.getByTestId(`checkpoint-warning-${checkpoint}`);
  await expect(warning).toBeVisible();
  // Ausrufezeichen tippen -> Checkpoint-Modus AN (aria-pressed + Kontrollzeit-Linie).
  await warning.click();
  await expect(warning).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("checkpoint-selection")).toContainText(/Kontrollzeit/);

  const area = page.getByTestId("timeline-create-area");
  const clickBand = async (kind: string, yFraction: number) => {
    const band = page.getByTestId(`band-${kind}`);
    await band.scrollIntoViewIfNeeded();
    const [bandBox, areaBox] = await Promise.all([band.boundingBox(), area.boundingBox()]);
    expect(bandBox).not.toBeNull();
    expect(areaBox).not.toBeNull();
    await page.mouse.click(areaBox!.x + areaBox!.width * 0.12, bandBox!.y + bandBox!.height * yFraction);
  };

  // Skalar-Bänder: direkte Y-Eingabe, KEIN Drawer.
  await clickBand("spo2", 0.4);
  await expect(page.getByTestId("entry-value")).toHaveCount(0);
  await expect(warning).toBeVisible();
  await clickBand("heartRate", 0.4);
  await expect(warning).toBeVisible();
  await clickBand("temperature", 0.4);
  await expect(warning).toBeVisible();

  // NIBP: inline drei Komponenten wählen und setzen – kein Drawer, keine Schätzung.
  await page.getByTestId("nibp-component-mean").click();
  await clickBand("nibp", 0.5);
  await expect(warning).toBeVisible();
  await page.getByTestId("nibp-component-systolic").click();
  await clickBand("nibp", 0.2);
  await expect(warning).toBeVisible();
  await page.getByTestId("nibp-component-diastolic").click();
  await clickBand("nibp", 0.8);
  await expect(warning).toHaveCount(0);

  // Alle Werte an genau derselben Kontrollzeit; NIBP-Reihenfolge gültig.
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem("sikant-anesthesia-demo-case:v1")!).measurements);
  expect(new Set(persisted.map((m: { time: number }) => m.time))).toEqual(new Set([checkpoint]));
  const nibp = persisted.find((m: { kind: string }) => m.kind === "nibp");
  expect(nibp.systolic).toBeGreaterThan(nibp.mean);
  expect(nibp.mean).toBeGreaterThan(nibp.diastolic);

  const temperaturePoint = page.locator('[data-testid^="point-temperature-"]');
  await expect(temperaturePoint).toHaveCount(1);
  await temperaturePoint.focus();
  await temperaturePoint.press("Enter");
  await expect(page.getByTestId("entry-delete")).toBeVisible();
  await page.getByTestId("entry-delete").click();
  await page.locator(".ant-popconfirm").getByRole("button", { name: "Löschen", exact: true }).click();
  await expect(page.getByTestId(`checkpoint-warning-${checkpoint}`)).toBeVisible();
  await page.reload();
  await expect(page.getByTestId(`checkpoint-warning-${checkpoint}`)).toBeVisible();
});

test("Temperatur-Zwischenwerte bleiben vollständig; SpO₂ bleibt auf 0–100 begrenzt", async ({ page }) => {
  await page.goto("/dokumentation");
  const now = Date.now();
  const startedAt = now - 10 * 60_000;
  const values = [35.2, 35.7, 36.1, 36.4, 36.8, 37.2, 38.6];
  await page.evaluate(({ startedAt, now, values }) => {
    localStorage.setItem("sikant-anesthesia-demo-case:v1", JSON.stringify({
      schemaVersion: 4,
      caseId: "temperature-series",
      startedAt,
      endedAt: null,
      measurements: values.map((value, index) => ({ id: `temp-${index}`, kind: "temperature", time: startedAt + (index + 1) * 60_000, value, createdAt: now, updatedAt: now })),
      medications: [], infusions: [], events: [], lastSavedAt: now,
    }));
  }, { startedAt, now, values });
  await page.reload();
  await expect(page.getByTestId("points-temperature").locator("circle")).toHaveCount(7);
  await page.reload();
  await expect(page.getByTestId("points-temperature").locator("circle")).toHaveCount(7);

  // Zwischen den relativen 5- und 10-Minuten-Checkpoints dokumentieren. So
  // prueft dieser Grenzwerttest die Werteeingabe und nicht den Warnungs-Button.
  await tapBandFraction(page, "spo2", 0.1875);
  await page.getByTestId("entry-value").fill("100");
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("entry-value")).toHaveCount(0);

  await tapBandFraction(page, "spo2", 0.1875);
  await page.getByTestId("entry-value").fill("101");
  await page.getByTestId("entry-save").click();
  await expect(page.getByText("Der SpO₂-Wert muss zwischen 0 und 100 % liegen.")).toBeVisible();
});

test("Checkpoint-Y übernimmt Herzfrequenz und NIBP-Mittel aus der echten Klickhöhe", async ({ page }) => {
  await page.goto("/dokumentation");
  const startedAt = await seedStartedCase(page, 6);
  const checkpoint = startedAt + 5 * 60_000;
  const heartRateHit = page.getByTestId(`checkpoint-band-heartRate-${checkpoint}`);
  await heartRateHit.scrollIntoViewIfNeeded();
  const heartRateBox = await heartRateHit.boundingBox();
  expect(heartRateBox).not.toBeNull();
  await heartRateHit.click({ position: { x: heartRateBox!.width / 2, y: heartRateBox!.height / 2 } });
  await expect(page.getByTestId("entry-value")).toHaveValue("115");
  await expect(page.getByText("Herzfrequenz (/min)")).toBeVisible();
  await page.getByTestId("entry-cancel").click();
  await expect(page.getByTestId("entry-value")).toHaveCount(0);

  const nibpHit = page.getByTestId(`checkpoint-band-nibp-${checkpoint}`);
  await nibpHit.scrollIntoViewIfNeeded();
  const nibpBox = await nibpHit.boundingBox();
  expect(nibpBox).not.toBeNull();
  await nibpHit.click({ position: { x: nibpBox!.width / 2, y: nibpBox!.height / 2 } });
  await expect(page.getByTestId("entry-mean")).toHaveValue("125");
});

test("Therapieende über Mitternacht, Einheit und Ende-Handle bleiben nach Drag, Zielklick und Reload konsistent", async ({ page }, testInfo) => {
  await page.goto("/dokumentation");
  await seedStartedCase(page, 20);
  await tapLaneFraction(page, "medication", 0.08);
  await page.getByTestId("medication-name").fill("Nacht-Perfusor");
  await page.getByTestId("medication-dose").fill("1");
  await selectTherapyUnit(page, "medication-unit", "Milligramm (mg)");
  await page.getByTestId("therapy-end-mode").getByText("Ende", { exact: true }).click();
  const startClock = await page.getByTestId("therapy-time").inputValue();
  const [hour, minute] = startClock.split(":").map(Number);
  const earlierClock = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  await setTimePicker(page, "therapy-end-time", earlierClock);
  await expect(page.getByTestId("therapy-end-preview")).toContainText("(morgen)");
  await page.getByTestId("therapy-save").click();
  await expect(page.locator(".ant-drawer-mask")).toHaveCount(0);

  const initial = await page.evaluate(() => JSON.parse(localStorage.getItem("sikant-anesthesia-demo-case:v1")!).medications[0]);
  expect(initial.endedAt).toBeGreaterThan(initial.startedAt);
  expect(new Date(initial.endedAt).getDate()).not.toBe(new Date(initial.startedAt).getDate());
  expect(initial.unit).toMatchObject({ code: "mg", system: "UCUM", isCustom: false });

  const hit = page.getByTestId(`medication-${initial.id}-end-hit`);
  await hit.scrollIntoViewIfNeeded();
  const box = await hit.boundingBox();
  expect(box).not.toBeNull();
  const fromX = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  const toX = fromX - 70;
  if (testInfo.project.name === "ipad-viewport") {
    await hit.dispatchEvent("pointerdown", { pointerId: 41, pointerType: "touch", button: 0, clientX: fromX, clientY: y });
    await hit.dispatchEvent("pointermove", { pointerId: 41, pointerType: "touch", button: 0, clientX: toX, clientY: y });
    await hit.dispatchEvent("pointerup", { pointerId: 41, pointerType: "touch", button: 0, clientX: toX, clientY: y });
  } else {
    await page.mouse.move(fromX, y);
    await page.mouse.down();
    await page.mouse.move(toX, y, { steps: 5 });
    await page.mouse.up();
  }
  const dragged = await page.evaluate(() => JSON.parse(localStorage.getItem("sikant-anesthesia-demo-case:v1")!).medications[0]);
  expect(dragged.endedAt).toBeLessThan(initial.endedAt);

  const movedHit = page.getByTestId(`medication-${initial.id}-end-hit`);
  await movedHit.scrollIntoViewIfNeeded();
  if (testInfo.project.name === "ipad-viewport") {
    const movedBox = await movedHit.boundingBox();
    await page.touchscreen.tap(movedBox!.x + movedBox!.width / 2, movedBox!.y + movedBox!.height / 2);
  } else {
    await movedHit.click();
  }
  await expect(page.getByTestId("therapy-end-preview")).toBeVisible();
  const temperatureBand = page.getByTestId("band-temperature");
  const createArea = page.getByTestId("timeline-create-area");
  await temperatureBand.scrollIntoViewIfNeeded();
  const [temperatureBox, createAreaBox, nowDotBox] = await Promise.all([
    temperatureBand.boundingBox(),
    createArea.boundingBox(),
    page.getByTestId("now-dot").boundingBox(),
  ]);
  expect(temperatureBox).not.toBeNull();
  expect(createAreaBox).not.toBeNull();
  expect(nowDotBox).not.toBeNull();
  const placement = {
    x: nowDotBox!.x + nowDotBox!.width / 2 - createAreaBox!.x - 10,
    y: temperatureBox!.y + temperatureBox!.height / 2 - createAreaBox!.y,
  };
  if (testInfo.project.name === "ipad-viewport") {
    const clientX = createAreaBox!.x + placement.x;
    const clientY = createAreaBox!.y + placement.y;
    await createArea.dispatchEvent("pointerdown", { pointerId: 51, pointerType: "touch", isPrimary: true, button: 0, buttons: 1, clientX, clientY });
    await createArea.dispatchEvent("pointerup", { pointerId: 51, pointerType: "touch", isPrimary: true, button: 0, buttons: 0, clientX, clientY });
  } else {
    await createArea.click({ position: placement });
  }
  const placed = await page.evaluate(() => JSON.parse(localStorage.getItem("sikant-anesthesia-demo-case:v1")!).medications[0]);
  expect(placed.endedAt).not.toBe(dragged.endedAt);
  await page.reload();
  const reloaded = await page.evaluate(() => JSON.parse(localStorage.getItem("sikant-anesthesia-demo-case:v1")!).medications[0]);
  expect(reloaded.endedAt).toBe(placed.endedAt);
  expect(reloaded.unit.code).toBe("mg");
});

test("Kontrolle zeigt reale Daten und erstellt ohne Share API eine echte herunterladbare JSON-Datei", async ({ page }) => {
  const now = Date.now();
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, "showDirectoryPicker");
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => false });
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  });
  await page.goto("/dokumentation");
  await page.evaluate(({ now }) => {
    localStorage.setItem("sikant-anesthesia-demo.patient-base-data.v1", JSON.stringify({ patientName: "Kontrollpatient", birthDate: "01.01.2000", procedure: "Kontroll-OP", operationDate: "01.08.2026", bodyWeightKg: 70, weightUnit: "kg", asaClass: "II", mallampatiClass: "I", allergies: "keine", updatedAt: null }));
    localStorage.setItem("sikant-anesthesia-demo-case:v1", JSON.stringify({ schemaVersion: 3, caseId: "fall-download", startedAt: now - 10 * 60_000, endedAt: now, measurements: [{ id: "t", kind: "temperature", time: now - 5 * 60_000, value: 45.5, createdAt: now, updatedAt: now }], medications: [], infusions: [], events: [], lastSavedAt: now }));
  }, { now });
  await page.goto("/abschluss");
  await expect(page.getByRole("heading", { name: "Kontrolle" })).toBeVisible();
  await expect(page.getByTestId("case-basis-summary")).toContainText("Kontrollpatient");
  await expect(page.getByTestId("preview-series-temperature").locator("circle")).toHaveCount(1);
  await expect(page.getByTestId("file-delivery-fallback")).toBeVisible();
  await page.getByTestId("completeness-acknowledgement").click();
  await page.getByTestId("archive-confirmation").click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("archive-save").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^Narkosefall_fall-download_.*\.json$/);
  await expect(page.getByTestId("case-close-complete")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("sikant-anesthesia-demo-case:v1"))).toBeNull();
});
