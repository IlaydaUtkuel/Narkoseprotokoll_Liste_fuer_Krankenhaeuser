import { expect, test, type Page } from "@playwright/test";

const CASE_KEY = "sikant-anesthesia-demo-case:v1";
const PATIENT_KEY = "sikant-anesthesia-demo.patient-base-data.v1";

function deDate(date: Date) {
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
}

function birthForAge(age: number) {
  const now = new Date();
  return deDate(new Date(now.getFullYear() - age, now.getMonth(), now.getDate()));
}

async function seedCase(page: Page, options: {
  caseId?: string;
  birthDate?: string;
  patientName?: string;
  ended?: boolean;
  measurements?: unknown[];
  withTherapy?: boolean;
} = {}) {
  const now = Date.now();
  const startedAt = now - 20 * 60_000;
  const caseId = options.caseId ?? "safe-op-case";
  // Die Basisdaten-Seite schreibt ihren aktuellen React-State bei pagehide.
  // Daher zuerst zur Dokumentation wechseln und erst dort die persistierte
  // Test-Fixture setzen; der anschlieÃŸende Reload hydriert exakt diese Daten.
  await page.goto("/dokumentation");
  await page.evaluate(({ caseKey, patientKey, now, startedAt, caseId, birthDate, patientName, ended, measurements, withTherapy }) => {
    localStorage.setItem(patientKey, JSON.stringify({
      patientName,
      birthDate,
      procedure: "Sicherheits-Test-OP",
      operationDate: new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date()),
      bodyWeightKg: 70,
      weightUnit: "kg",
      asaClass: "II",
      mallampatiClass: "I",
      allergies: "Keine",
      noKnownAllergies: false,
      updatedAt: new Date(now).toISOString(),
    }));
    localStorage.setItem(caseKey, JSON.stringify({
      schemaVersion: 5,
      caseId,
      caseRevision: 4,
      lastSuccessfullyExportedRevision: null,
      startedAt,
      endedAt: ended ? now : null,
      measurements,
      medications: withTherapy ? [{
        id: "med-preserved", kind: "medication", administrationType: "bolus", name: "Erhaltenes Medikament",
        startedAt: startedAt + 60_000, dose: 1, unit: { label: "mg", code: "mg", system: "UCUM", isCustom: false },
        concentration: null, endedAt: null, ongoing: false, createdAt: now, updatedAt: now,
      }] : [],
      infusions: [],
      events: [],
      lastSavedAt: now,
    }));
  }, {
    caseKey: CASE_KEY,
    patientKey: PATIENT_KEY,
    now,
    startedAt,
    caseId,
    birthDate: options.birthDate ?? birthForAge(40),
    patientName: options.patientName ?? "Bestehender Patient",
    ended: options.ended ?? false,
    measurements: options.measurements ?? [{ id: "vital-preserved", kind: "heartRate", time: startedAt + 60_000, value: 72, createdAt: now, updatedAt: now }],
    withTherapy: options.withTherapy ?? true,
  });
  await page.reload();
  await expect(page.getByTestId("case-started")).toBeVisible();
  return { startedAt, caseId };
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

test("Basisdaten werden von der Timeline nur als bestätigter Draft korrigiert", async ({ page }) => {
  await seedCase(page, { withTherapy: true });
  await page.getByTestId("back-basisdaten").click();
  await expect(page.getByText("Basisdaten dieses OP-Falls bearbeiten?", { exact: true })).toBeVisible();
  await expect(page.getByTestId("basis-existing-summary")).toContainText("Bestehender Patient");
  await expect(page).toHaveURL(/\/dokumentation$/);

  await page.getByTestId("confirm-edit-basis").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("basis-edit-mode")).toBeVisible();
  await page.getByTestId("input-patientName").fill("Nur im Draft");
  await page.getByTestId("input-procedure").fill("Korrigierte OP");
  await expect(page.getByText("Basisdaten dieses OP-Falls ändern?", { exact: true })).toHaveCount(0);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).patientName, PATIENT_KEY)).toBe("Bestehender Patient");

  await page.getByTestId("discard-basis-edit").click();
  await expect(page.getByTestId("input-patientName")).toHaveValue("Bestehender Patient");
  await page.getByTestId("weiter").click();
  await page.getByTestId("back-basisdaten").click();
  await page.getByTestId("confirm-edit-basis").click();
  await page.getByTestId("input-patientName").fill("Korrigierter Patient");
  await page.getByTestId("apply-basis-edit").click();
  await expect(page).toHaveURL(/\/dokumentation$/);
  await expect(page.getByTestId("case-header")).toContainText("Korrigierter Patient");
  const retained = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), CASE_KEY);
  expect(retained.measurements).toHaveLength(1);
  expect(retained.medications).toHaveLength(1);
  expect(retained.caseRevision).toBe(5);
});

test("Neue OP bewahrt den Fall bei Exportabbruch und leert erst nach echtem Export", async ({ page }) => {
  await page.addInitScript(() => {
    (window as typeof window & { __cancelPicker?: boolean }).__cancelPicker = true;
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: async () => {
        if ((window as typeof window & { __cancelPicker?: boolean }).__cancelPicker) throw new DOMException("Abgebrochen", "AbortError");
        return {
          name: "Testordner",
          getFileHandle: async (fileName: string) => ({
            createWritable: async () => ({
              write: async (file: File) => {
                (window as typeof window & { __savedSnapshot?: unknown; __savedName?: string }).__savedSnapshot = JSON.parse(await file.text());
                (window as typeof window & { __savedName?: string }).__savedName = fileName;
              },
              close: async () => undefined,
            }),
          }),
        };
      },
    });
  });
  const { caseId } = await seedCase(page, { ended: true });
  await page.evaluate(({ caseId }) => localStorage.setItem(`sikant-critical-values:v1:${caseId}`, JSON.stringify({ schemaVersion: 1, caseId, birthDate: "", ageGroup: "adult", source: "custom", ageChangedNotice: false, thresholds: { spo2Lower: 77 } })), { caseId });

  await page.getByTestId("back-basisdaten").click();
  await page.getByRole("button", { name: "Neue OP", exact: true }).click();
  await expect(page.locator(".ant-modal-confirm-title").filter({ hasText: "Aktuellen OP-Fall zuerst speichern" })).toBeVisible();
  await page.getByRole("button", { name: "Aktuellen Fall prüfen und speichern" }).click();
  await expect(page).toHaveURL(/\/abschluss$/);
  await page.getByTestId("choose-directory").click();
  expect(await page.evaluate((key) => localStorage.getItem(key), CASE_KEY)).not.toBeNull();
  await expect(page.getByTestId("case-close-page")).toBeVisible();

  await page.evaluate(() => { (window as typeof window & { __cancelPicker?: boolean }).__cancelPicker = false; });
  await page.getByTestId("choose-directory").click();
  await page.getByTestId("archive-confirmation").click();
  await page.getByTestId("archive-save").click();
  await expect(page.getByRole("heading", { name: "Basisdaten des Narkosefalls" })).toBeVisible();
  await expect(page.getByTestId("input-patientName")).toHaveValue("");
  expect(await page.evaluate((key) => localStorage.getItem(key), CASE_KEY)).toBeNull();
  expect(await page.evaluate((id) => localStorage.getItem(`sikant-critical-values:v1:${id}`), caseId)).toBeNull();
  const exported = await page.evaluate(() => (window as typeof window & { __savedSnapshot?: Record<string, unknown> }).__savedSnapshot);
  expect(exported).not.toHaveProperty("criticalThresholds");
  expect(exported).not.toHaveProperty("derivedCriticalWarnings");
});

test("Therapie-Lanes zeigen keine schwarze Ganzflächenkontur und behalten Zeitinteraktion", async ({ page }) => {
  await seedCase(page);
  for (const kind of ["medication", "infusion"] as const) {
    const lane = page.getByTestId(`lane-create-${kind}`);
    await page.locator("body").click({ position: { x: 4, y: 4 } });
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await page.keyboard.press("Tab");
      if (await lane.evaluate((element) => element === document.activeElement)) break;
    }
    await expect(lane).toBeFocused();
    const focusStyle = await lane.evaluate((element) => ({ outline: getComputedStyle(element).outlineStyle, siblingOpacity: getComputedStyle(element.nextElementSibling!).opacity }));
    expect(focusStyle.outline).toBe("none");
    expect(focusStyle.siblingOpacity).toBe("1");
    const box = await lane.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width * 0.3, box!.y + box!.height / 2);
    await expect(page.getByTestId("therapy-time")).toBeVisible();
    await page.getByTestId("therapy-cancel").click();
  }
});

test("NIBP-Mittelpunkt verschiebt horizontal nur die Zeit und bleibt nach Reload erhalten", async ({ page }) => {
  const now = Date.now();
  const startedAt = now - 20 * 60_000;
  const originalTime = startedAt + 5 * 60_000;
  await seedCase(page, { measurements: [{ id: "nibp-time", kind: "nibp", time: originalTime, systolic: 125, mean: 90, diastolic: 68, createdAt: now, updatedAt: now }], withTherapy: false });
  const handle = page.getByTestId("nibp-time-handle-nibp-time");
  await handle.scrollIntoViewIfNeeded();
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await handle.dispatchEvent("pointerdown", { pointerId: 31, pointerType: "touch", button: 0, clientX: x, clientY: y });
  await handle.dispatchEvent("pointermove", { pointerId: 31, pointerType: "touch", button: 0, clientX: x + 90, clientY: y + 1 });
  await expect(page.locator('[data-testid^="nibp-values-"]')).toContainText(/\d{2}:\d{2}:\d{2}/);
  await handle.dispatchEvent("pointerup", { pointerId: 31, pointerType: "touch", button: 0, clientX: x + 90, clientY: y + 1 });
  const moved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).measurements[0], CASE_KEY);
  expect(moved.time).not.toBe(originalTime);
  expect(moved).toMatchObject({ systolic: 125, mean: 90, diastolic: 68 });
  await page.reload();
  const reloaded = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).measurements[0], CASE_KEY);
  expect(reloaded).toMatchObject({ time: moved.time, systolic: 125, mean: 90, diastolic: 68 });
});

test("Kritische Werte beachten Alter, exakte Hinweise, Custom-Änderung und vollständiges Leeren", async ({ page }) => {
  for (const [age, expected] of [[17, ""], [18, "90"], [65, "90"]] as const) {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await seedCase(page, { caseId: `age-${age}`, birthDate: birthForAge(age), measurements: [], withTherapy: false });
    await page.getByTestId("critical-values-button").click();
    await expect(page.getByTestId("critical-spo2Lower")).toHaveValue(expected);
    await expect(page.getByTestId("critical-patient-age")).toContainText(`${age} Jahre`);
    if (age === 17) await expect(page.getByText("Für Patientinnen und Patienten unter 18 Jahren sind keine Standardwerte vorbelegt.")).toBeVisible();
    if (age === 65) await expect(page.getByText(/ab 65 Jahren individuell angepasst/)).toBeVisible();
    await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  }

  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  const now = Date.now();
  const startedAt = now - 20 * 60_000;
  await seedCase(page, {
    caseId: "critical-icons",
    birthDate: birthForAge(40),
    withTherapy: false,
    measurements: [
      { id: "critical-spo2", kind: "spo2", time: startedAt + 5 * 60_000, value: 89, createdAt: now, updatedAt: now },
      { id: "critical-nibp", kind: "nibp", time: startedAt + 6 * 60_000, systolic: 85, mean: 60, diastolic: 130, createdAt: now, updatedAt: now },
    ],
  });
  const spoWarning = page.getByTestId("critical-warning-critical-spo2");
  const nibpWarning = page.getByTestId("critical-warning-critical-nibp");
  await expect(spoWarning).toBeVisible();
  await expect(spoWarning).toHaveAttribute("title", /SpO₂ liegt unter 90 %/);
  await spoWarning.click();
  await expect(page.locator(".critical-warning-tooltip")).toHaveCount(0);
  await expect(nibpWarning).toHaveAttribute("title", /MAP liegt unter 65 mmHg/);
  const nibpTitle = await nibpWarning.getAttribute("title");
  expect(nibpTitle).toContain("Systolischer Wert liegt unter 90 mmHg");
  expect(nibpTitle).toContain("Diastolischer Wert liegt über 120 mmHg");

  await page.getByTestId("critical-values-button").click();
  await page.getByTestId("critical-spo2Lower").fill("80");
  await page.getByTestId("critical-apply").click();
  await expect(page.getByTestId("critical-warning-critical-spo2")).toHaveCount(0);
  await expect(page.getByTestId("critical-warning-critical-nibp")).toBeVisible();
  await page.getByTestId("critical-values-button").click();
  await page.getByRole("button", { name: "Alle Werte leeren" }).click();
  await page.getByTestId("critical-apply").click();
  await expect(page.locator('[data-testid^="critical-warning-"]:not([data-testid="critical-warning-layer"])')).toHaveCount(0);
});

test("Kontrolle rendert keine kritischen Hilfsicons oder Schwellen", async ({ page }) => {
  const now = Date.now();
  await seedCase(page, { caseId: "critical-export", ended: true, birthDate: birthForAge(40), measurements: [{ id: "critical", kind: "spo2", time: now - 5 * 60_000, value: 80, createdAt: now, updatedAt: now }], withTherapy: false });
  await expect(page.getByTestId("critical-warning-critical")).toBeVisible();
  await page.goto("/abschluss");
  await expect(page.getByRole("heading", { name: "Kontrolle" })).toBeVisible();
  await expect(page.getByTestId("case-timeline-preview")).toBeVisible();
  await expect(page.getByTestId("critical-warning-layer")).toHaveCount(0);
  await expect(page.getByText("Kritische Werte", { exact: true })).toHaveCount(0);
});
