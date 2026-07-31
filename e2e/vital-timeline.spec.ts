import { test, expect, type Page } from "@playwright/test";

// --- Hilfsfunktionen: echte Pointer-Interaktion (Maus) auf dem gemeinsamen SVG ---

// Tap nahe der Jetzt-Linie in einem Band (zum Anlegen eines Wertes ~ jetzt).
async function tapBandNow(page: Page, kind: string) {
  const pt = await page.evaluate((k) => {
    const bg = document.querySelector(`[data-testid="band-${k}"]`)!.getBoundingClientRect();
    const svg = document.querySelector('[data-testid="vital-timeline-svg"]')!.getBoundingClientRect();
    const nowDot = document.querySelector('[data-testid="now-dot"]')!;
    const cx = parseFloat(nowDot.getAttribute("cx") || "0");
    // Wenige Pixel rechts der Jetzt-Linie: sicher innerhalb der Plotflaeche und
    // innerhalb der Jetzt-Snap-Toleranz (-> Zeit = jetzt, kein Zukunftsfehler).
    return { x: svg.left + cx + 3, y: bg.top + bg.height / 2 };
  }, kind);
  await page.mouse.click(pt.x, pt.y);
}

// Tap an einem horizontalen Anteil der Plotbreite (fuer Fehlerfaelle: Zukunft / vor Start).
async function tapBandFraction(page: Page, kind: string, fraction: number) {
  const pt = await page.evaluate(
    ({ k, frac }) => {
      const bg = document.querySelector(`[data-testid="band-${k}"]`)!.getBoundingClientRect();
      return { x: bg.left + bg.width * frac, y: bg.top + bg.height / 2 };
    },
    { k: kind, frac: fraction },
  );
  await page.mouse.click(pt.x, pt.y);
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
  await page.waitForTimeout(350);
}

async function addScalar(page: Page, kind: string, value: number) {
  await tapBandNow(page, kind);
  await page.getByTestId("entry-value").fill(String(value));
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("entry-value")).toHaveCount(0);
}

async function addNibp(page: Page, sys: number, mean: number, dia: number) {
  await tapBandNow(page, "nibp");
  await page.getByTestId("entry-systolic").fill(String(sys));
  await page.getByTestId("entry-mean").fill(String(mean));
  await page.getByTestId("entry-diastolic").fill(String(dia));
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("entry-systolic")).toHaveCount(0);
}

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "").trim();
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
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
