import { expect, test } from "@playwright/test";
import {
  beat,
  boxOf,
  caseData,
  clickNibpMean,
  clickScalar,
  DEMO_DATE_DE,
  DEMO_PATIENT,
  documentEvent,
  dragScalarPoint,
  fillBasisdaten,
  prepareDemoPage,
  selectTherapyUnit,
  setTimePicker,
  startCaseAt,
  travelTo,
} from "./demo-helpers";

/**
 * Kurzaufnahme 3: kritischen Wert erzeugen, den Hinweis lesen, den Wert per
 * Ziehen korrigieren, den Fall beenden und ueber die Kontrollseite exportieren.
 *
 * Playwright kann den nativen Ordnerdialog des Betriebssystems nicht bedienen.
 * Deshalb wird ausschliesslich `window.showDirectoryPicker` – also die Browser-
 * und Systemschnittstelle – durch einen Mock ersetzt, der die geschriebene Datei
 * mitliest. Alle Klicks, die Anwendungslogik, die Vollstaendigkeitspruefung und
 * die Erzeugung der JSON-Datei laufen unveraendert durch die echte Anwendung.
 */
test("Demo 3: kritischen Wert korrigieren, Fall beenden und exportieren", async ({ page }) => {
  await prepareDemoPage(page);

  // Nur der native Systemdialog wird ersetzt; der Mock gilt auch fuer die in
  // einem neuen Tab geoeffnete Kontrollseite.
  await page.context().addInitScript(() => {
    const store = window as typeof window & { __savedCase?: unknown; __savedFileName?: string };
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: async () => ({
        name: "Narkoseprotokolle",
        getFileHandle: async (fileName: string) => ({
          createWritable: async () => ({
            write: async (file: File) => {
              store.__savedFileName = fileName;
              store.__savedCase = JSON.parse(await file.text());
            },
            close: async () => undefined,
          }),
        }),
      }),
    });
  });

  await test.step("Fall vorbereiten", async () => {
    await fillBasisdaten(page);
    await page.getByTestId("weiter").click();
    await expect(page).toHaveURL(/\/dokumentation$/);
    await startCaseAt(page, "10:00:00");
    await travelTo(page, "10:00:50");
    await documentEvent(page, "anesthesiaStart", "10:00:00");

    // Ein Blutdruck und ein Medikament, damit der spaetere Export alle zentralen
    // Bereiche mit echten Daten enthaelt.
    await clickNibpMean(page, 90, { clock: "10:00:00" });

    const lane = page.getByTestId("lane-create-medication");
    await lane.scrollIntoViewIfNeeded();
    const laneBox = await lane.boundingBox();
    expect(laneBox).not.toBeNull();
    await lane.click({ position: { x: 1, y: laneBox!.height / 2 } });
    await expect(page.getByTestId("medication-name")).toBeVisible();
    await page.getByTestId("medication-name").fill("Propofol");
    await setTimePicker(page, "therapy-time", "10:00:00");
    await page.getByTestId("medication-dose").fill("40");
    await selectTherapyUnit(page, "medication-unit", "Milligramm (mg)");
    await page.getByTestId("therapy-save").click();
    await expect(page.getByTestId("therapy-save")).toHaveCount(0);
    await expect.poll(async () => (await caseData(page)).medications.length).toBe(1);
    await beat(page);
  });

  let criticalId = "";

  await test.step("Kritischen SpO2-Wert erzeugen und Hinweis lesen", async () => {
    // Bewusst tief angeklickt: unter 90 % meldet die Anwendung einen kritischen Hinweis.
    const critical = await clickScalar(page, "spo2", 88);
    expect(critical.shown.value).toBeLessThan(90);
    criticalId = critical.saved.id;

    const warning = page.getByTestId(`critical-warning-${criticalId}`);
    await expect(warning).toBeVisible();
    await expect(warning).toHaveAttribute("title", /SpO₂ liegt unter 90 %/);

    // Mit der Maus auf das Warnsymbol: die Erklaerung erscheint im Bild.
    const icon = await boxOf(warning);
    await page.mouse.move((icon.left + icon.right) / 2, (icon.top + icon.bottom) / 2, { steps: 12 });
    const hint = page.getByTestId("warning-info");
    await expect(hint).toContainText("Kritischer Hinweis");
    await expect(hint).toContainText("SpO₂ liegt unter 90 %");
    await beat(page, 1200);
  });

  await test.step("Kritischen Wert durch Ziehen korrigieren", async () => {
    const corrected = await dragScalarPoint(page, "spo2", criticalId, 96);
    expect(corrected.value).toBeGreaterThanOrEqual(90);
    // Der kritische Zustand aktualisiert sich sofort: das Warnsymbol verschwindet.
    await expect(page.getByTestId(`critical-warning-${criticalId}`)).toHaveCount(0);
    await expect(page.getByTestId("save-status")).toContainText("Gespeichert");
    await beat(page);
  });

  await test.step("Fall beenden", async () => {
    await travelTo(page, "10:02:40");
    await documentEvent(page, "patientOut", "10:02:00");

    await page.getByTestId("end-case-button").click();
    const confirmation = page.locator(".ant-popconfirm");
    await expect(confirmation).toContainText("Möchten Sie den Eingriff wirklich beenden?");
    await confirmation.getByRole("button", { name: "Eingriff beenden", exact: true }).click();
    await expect(page.getByTestId("case-ended")).toContainText(/Beendet um \d{2}:\d{2}:\d{2}/);
    await beat(page);
  });

  await test.step("Kontrollseite pruefen und exportieren", async () => {
    const snapshot = await caseData(page);
    await page.getByTestId("save-close-case").click();
    await page.waitForURL("**/abschluss");
    const review = page;
    await expect(review.getByRole("heading", { name: "Kontrolle" })).toBeVisible();

    // 1. Basisdaten und 2. schreibgeschuetzte Timeline-Vorschau.
    const summary = review.getByTestId("case-basis-summary");
    await expect(summary).toContainText(DEMO_PATIENT.name);
    await expect(summary).toContainText(DEMO_PATIENT.procedure);
    await expect(summary).toContainText(DEMO_DATE_DE);
    await expect(review.getByTestId("case-timeline-preview")).toBeVisible();
    await expect(review.getByTestId("case-completeness")).toBeVisible();

    // Die gesamte Kontrollseite einmal sichtbar durchfahren.
    const maxScroll = await review.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    for (let position = 0; position <= maxScroll; position += Math.max(1, Math.ceil(maxScroll / 6))) {
      await review.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), position);
      await beat(review, 350);
    }

    // 3. Kenntnisnahme, 4. Ordner, 5. letzte Bestaetigung.
    const acknowledgement = review.getByTestId("completeness-acknowledgement");
    if (await acknowledgement.count()) await acknowledgement.click();
    await review.getByTestId("choose-directory").click();
    await expect(review.getByTestId("selected-directory")).toContainText("Narkoseprotokolle");
    await review.getByTestId("archive-confirmation").click();
    await beat(review, 600);
    await review.getByTestId("archive-save").click();

    // Erfolgreicher Exportzustand der Anwendung.
    await expect(review.getByTestId("case-close-complete")).toBeVisible();
    await beat(review, 900);

    // Die tatsaechlich geschriebene Datei pruefen.
    const written = await review.evaluate(() => ({
      fileName: (window as typeof window & { __savedFileName?: string }).__savedFileName,
      snapshot: (window as typeof window & { __savedCase?: Record<string, unknown> }).__savedCase,
    }));
    expect(written.fileName).toMatch(/^Narkosefall_.*\.json$/);
    const exported = written.snapshot as {
      caseId: string;
      startedAt: number;
      endedAt: number;
      basisdaten: { patientName: string; procedure: string; operationDate: string };
      measurements: Array<{ kind: string }>;
      medications: unknown[];
      infusions: unknown[];
      events: Array<{ eventType: string }>;
      archivedAt: string;
    };
    expect(exported.caseId).toBe(snapshot.caseId);
    expect(exported.startedAt).toBe(snapshot.startedAt);
    expect(exported.endedAt).toBe(snapshot.endedAt);
    expect(exported.basisdaten).toMatchObject({
      patientName: DEMO_PATIENT.name,
      procedure: DEMO_PATIENT.procedure,
      operationDate: DEMO_DATE_DE,
    });
    expect(exported.measurements.length).toBe(snapshot.measurements.length);
    expect(exported.measurements.some((m) => m.kind === "spo2")).toBe(true);
    expect(exported.measurements.some((m) => m.kind === "nibp")).toBe(true);
    expect(exported.medications).toHaveLength(1);
    expect(exported.events.map((event) => event.eventType).sort()).toEqual(["anesthesiaStart", "patientOut"]);
    expect(Array.isArray(exported.infusions)).toBe(true);
    expect(typeof exported.archivedAt).toBe("string");
    await beat(review, 900);
  });
});
