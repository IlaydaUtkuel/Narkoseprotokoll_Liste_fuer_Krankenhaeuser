import { test, expect, type Page } from "@playwright/test";

// --- Hilfsfunktionen: echte Pointer-Interaktion (Maus) auf dem gemeinsamen SVG ---

// Tap nahe der Jetzt-Linie in einem Band (zum Anlegen eines Wertes ~ jetzt).
async function tapBandNow(page: Page, kind: string) {
  await page.locator(`[data-testid="band-${kind}"]`).scrollIntoViewIfNeeded();
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
  await page.locator(`[data-testid="band-${kind}"]`).scrollIntoViewIfNeeded();
  const pt = await page.evaluate(
    ({ k, frac }) => {
      const bg = document.querySelector(`[data-testid="band-${k}"]`)!.getBoundingClientRect();
      return { x: bg.left + bg.width * frac, y: bg.top + bg.height / 2 };
    },
    { k: kind, frac: fraction },
  );
  await page.mouse.click(pt.x, pt.y);
}

async function tapLaneFraction(page: Page, kind: "event" | "medication" | "infusion", fraction: number) {
  const point = await page.evaluate(({ laneKind, fractionValue }) => {
    const lane = document.querySelector(`[data-testid="lane-create-${laneKind}"]`)!.getBoundingClientRect();
    return { x: lane.left + lane.width * fractionValue, y: lane.top + lane.height / 2 };
  }, { laneKind: kind, fractionValue: fraction });
  await page.mouse.click(point.x, point.y);
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

  const dragHandleToValue = async (part: "systolic" | "diastolic", value: number) => {
    const position = await page.evaluate(({ partName, targetValue }) => {
      const hit = document.querySelector(`[data-testid="nibp-handle-${partName}"] > circle[role="button"]`)!;
      const svg = document.querySelector('[data-testid="vital-timeline-svg"]')!.getBoundingClientRect();
      const band = document.querySelector('[data-testid="band-nibp"]')!;
      const hitRect = hit.getBoundingClientRect();
      const bandY = Number(band.getAttribute("y"));
      const bandHeight = Number(band.getAttribute("height"));
      const innerTop = bandY + 12;
      const innerHeight = bandHeight - 24;
      const targetY = svg.top + innerTop + ((220 - targetValue) / (220 - 30)) * innerHeight;
      return { x: hitRect.left + hitRect.width / 2, fromY: hitRect.top + hitRect.height / 2, targetY };
    }, { partName: part, targetValue: value });
    await page.mouse.move(position.x, position.fromY);
    await page.mouse.down();
    await page.mouse.move(position.x, position.targetY, { steps: 5 });
    await page.mouse.up();
  };

  await dragHandleToValue("systolic", sys);
  await page.getByTestId("nibp-handle-diastolic").locator('circle[role="button"]').click();
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
  await expect(page.getByText("Nach dem Ende des Eingriffs können keine neuen Einträge dokumentiert werden.")).toBeVisible();

  // Abschluss öffnet eine neue Registerkarte, archiviert zuerst und setzt dann
  // Basisdaten + aktiven Fall für den nächsten Patienten zurück.
  await expect(page.getByTestId("save-close-case")).toBeVisible();
  const popupPromise = page.waitForEvent("popup");
  await page.getByTestId("save-close-case").click();
  const closePage = await popupPromise;
  await closePage.waitForLoadState("domcontentloaded");
  await expect(closePage.getByRole("heading", { name: "Speichern und Schließen" })).toBeVisible();
  await closePage.getByTestId("archive-folder-path").fill("C:\\Narkoseprotokolle");
  await closePage.getByTestId("archive-ok").click();
  await closePage.getByRole("button", { name: "Speichern und Schließen", exact: true }).click();
  await expect(closePage.getByTestId("case-close-complete")).toBeVisible();
  const storageAfterClose = await closePage.evaluate(() => ({
    patient: localStorage.getItem("sikant-anesthesia-demo.patient-base-data.v1"),
    activeCase: localStorage.getItem("sikant-anesthesia-demo-case:v1"),
    archives: JSON.parse(localStorage.getItem("sikant-anesthesia-demo-archives:v1") || "[]").length,
  }));
  expect(storageAfterClose.patient).toBeNull();
  expect(storageAfterClose.activeCase).toBeNull();
  expect(storageAfterClose.archives).toBe(1);
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
    return { x: svg.left + (xs[0] + xs[1]) / 2, y: band.top + band.height / 2 };
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
  await page.getByTestId("medication-unit").fill("mg");
  await page.getByTestId("medication-duration").fill("20");
  await page.getByTestId("therapy-save").click();
  const medicationId = await page.evaluate(() => JSON.parse(localStorage.getItem("sikant-anesthesia-demo-case:v1")!).medications[0].id);
  await expect(page.getByTestId(`medication-${medicationId}`)).toBeVisible();
  await expect(page.getByTestId(`medication-duration-${medicationId}`)).toBeVisible();
  await expect(page.getByTestId(`medication-hatch-${medicationId}-spo2`)).toBeVisible();

  const hatchPoint = await page.evaluate((id) => {
    const hatch = document.querySelector(`[data-testid="medication-hatch-${id}-spo2"]`)!.getBoundingClientRect();
    return { x: hatch.left + Math.min(8, hatch.width / 2), y: hatch.top + hatch.height / 2 };
  }, medicationId);
  await page.mouse.move(hatchPoint.x, hatchPoint.y);
  await expect(page.getByTestId("therapy-interval-tooltip")).toContainText("Demo-Bolus");

  await tapLaneFraction(page, "medication", 0.35);
  await page.getByText("Kontinuierliche Gabe", { exact: true }).click();
  await page.getByTestId("medication-name").fill("Demo-Perfusor");
  await page.getByTestId("medication-dose").fill("1");
  await page.getByTestId("medication-unit").fill("mg/h");
  await page.getByTestId("medication-duration").fill("15");
  await page.getByTestId("therapy-save").click();

  await page.getByTestId("lane-create-infusion").press("Enter");
  await page.getByTestId("infusion-name").fill("Ringer");
  await page.getByTestId("infusion-amount").fill("500");
  await page.getByTestId("infusion-unit").fill("ml");
  await page.getByTestId("infusion-duration").fill("30");
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

test("Story 10: kontextuelle Lanes, stabile Ereignisauswahl und große lesbare Ansicht", async ({ page }) => {
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
  await expect(page.getByTestId("select-event-incision")).toHaveAttribute("aria-pressed", "true");
  const eventHover = await page.getByTestId("lane-create-event").boundingBox();
  expect(eventHover).not.toBeNull();
  await page.mouse.move(eventHover!.x + eventHover!.width * 0.2, eventHover!.y + eventHover!.height / 2);
  await expect(page.getByTestId("lane-placement-preview")).toContainText("Schnitt platzieren");
  await tapLaneFraction(page, "event", 0.2);
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
