import { expect, test } from "@playwright/test";
import {
  boxOf,
  beat,
  caseData,
  CASE_KEY,
  clickNibpMean,
  clickScalar,
  countOf,
  CROSSHAIR,
  DEMO_DATE_DE,
  DEMO_DAY,
  DEMO_PATIENT as PATIENT,
  documentEvent,
  dragNibpHandle,
  dragScalarPoint,
  installDemoCursor,
  keepReviewInSameTab,
  measurementAt,
  PATIENT_KEY,
  plotBoxes,
  pressValueAtCheckpoint,
  probe,
  readDraftValue,
  selectBasisOption,
  selectTherapyUnit,
  setTimePicker,
  travelTo,
  ts,
  yForValue,
} from "./demo-helpers";

/**
 * Umfassende Gesamtaufnahme: ein einziger Durchlauf von den Basisdaten bis zur
 * Kontrollseite. Die kurzen, thematisch fokussierten Aufnahmen liegen in
 * 01-basisdaten-vitalwerte.spec.ts, 02-therapien-ereignisse.spec.ts und
 * 03-abschluss-export.spec.ts.
 *
 * Grundregel: Vitalwerte werden nicht eingetippt, sondern ausschliesslich aus der
 * Zeigerposition in der Grafik erzeugt. Siehe demo-helpers.ts.
 */

test("Narkoseprotokoll-Demo: Werte per Maus dokumentieren, korrigieren und abschliessen", async ({ page }) => {
  await installDemoCursor(page);
  await keepReviewInSameTab(page);
  await page.clock.install({ time: new Date(DEMO_DAY.year, DEMO_DAY.month, DEMO_DAY.day, 9, 57, 0) });

  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await test.step("Basisdaten eingeben", async () => {
    // Der eingeblendete Zeiger muss im Video sichtbar sein und jeder Bewegung folgen.
    await expect(page.locator("#__demo-cursor")).toBeAttached();
    await page.mouse.move(300, 300, { steps: 5 });
    await expect
      .poll(async () => page.evaluate(() => {
        const dot = document.getElementById("__demo-cursor");
        return dot ? [Math.round(parseFloat(dot.style.left)), Math.round(parseFloat(dot.style.top))] : null;
      }))
      .toEqual([300, 300]);

    await expect(page.getByRole("heading", { name: "Basisdaten des Narkosefalls" })).toBeVisible();

    await page.getByTestId("input-patientName").fill(PATIENT.name);
    await page.getByTestId("input-birthDate").fill(PATIENT.birthDate);
    await page.getByTestId("input-procedure").fill(PATIENT.procedure);
    await page.getByTestId("operation-date-today").click();
    await page.locator("#bodyWeightKg").fill(PATIENT.weight);
    await selectBasisOption(page, "asaClass", PATIENT.asa);
    await selectBasisOption(page, "mallampatiClass", PATIENT.mallampati);

    const noAllergies = page.getByTestId("no-known-allergies");
    await noAllergies.click();
    await expect(noAllergies).toHaveAttribute("aria-pressed", "true");

    await expect(page.getByTestId("input-patientName")).toHaveValue(PATIENT.name);
    await expect(page.getByTestId("input-birthDate")).toHaveValue(PATIENT.birthDate);
    await expect(page.getByTestId("input-procedure")).toHaveValue(PATIENT.procedure);
    await expect(page.getByTestId("input-operationDate")).toHaveValue(DEMO_DATE_DE);
    // Der Zahlenbaustein zeigt nach dem Verlassen die Schrittweite mit an ("68,0").
    await expect(page.locator("#bodyWeightKg")).toHaveValue(/^68(,0)?$/);
    await expect(page.getByTestId("field-bodyWeightKg")).toContainText("kg");
    await expect(page.getByTestId("field-asaClass")).toContainText(PATIENT.asa);
    await expect(page.getByTestId("field-mallampatiClass")).toContainText(PATIENT.mallampati);
    await expect(page.getByTestId("input-allergies")).toHaveValue("Keine Allergien bekannt");
    await expect(page.getByTestId("global-status")).toContainText("automatisch gespeichert");

    await beat(page, 1200);
    await page.getByTestId("weiter").click();
    await expect(page).toHaveURL(/\/dokumentation$/);
  });

  await test.step("Narkosefall starten", async () => {
    const header = page.getByTestId("case-header");
    await expect(header).toContainText(PATIENT.name);
    await expect(header).toContainText(PATIENT.procedure);
    await expect(header).toContainText(DEMO_DATE_DE);
    await beat(page);

    await page.clock.pauseAt(new Date(ts("10:00:00")));
    await page.getByTestId("start-button").click();
    await expect(page.getByTestId("case-started")).toHaveText("Gestartet um 10:00:00");
    await page.clock.resume();

    await expect(page.getByTestId("now-dot")).toBeVisible();
    expect((await caseData(page)).startedAt).toBe(ts("10:00:00"));
    await travelTo(page, "10:00:55");
    await beat(page);
  });

  await test.step("Beginn der Anästhesie dokumentieren", async () => {
    await documentEvent(page, "anesthesiaStart", "10:00:00");
  });

  await test.step("Mit der Maus über die Grafik fahren", async () => {
    // Die Koordinatenanzeige folgt dem Zeiger: links die Uhrzeit, rechts der
    // Y-Wert des Bandes. Ohne diesen Bezug waere kein Wert per Klick setzbar.
    const { band, area } = await plotBoxes(page, "temperature");
    const y = band.y + band.height * 0.45;
    const readings: Array<{ clock: string; value: number }> = [];
    for (const fraction of [0.02, 0.012, 0.006]) {
      readings.push(await probe(page, area.x + area.width * fraction, y));
      await beat(page, 350);
    }
    // Nach links bedeutet frueher: die angezeigte Uhrzeit nimmt monoton ab.
    expect(readings[0].clock > readings[1].clock).toBe(true);
    expect(readings[1].clock > readings[2].clock).toBe(true);
    // Auf gleicher Hoehe bleibt der Temperaturwert konstant.
    expect(readings[0].value).toBeCloseTo(readings[2].value, 5);
    await expect(page.locator(CROSSHAIR)).toContainText("°C");

    // Dieselbe Anzeige gibt es in jedem Band – kurz die Hoehe wechseln.
    await probe(page, area.x + area.width * 0.01, band.y + band.height * 0.2);
    await beat(page, 400);
  });

  await test.step("Erste Vitalwerte per Klick dokumentieren", async () => {
    // Ganz links auf der Zeitachse liegt die Startzeit; die Uhrzeit wird im
    // Formular exakt auf 10:00:00 gesetzt, der Wert bleibt der angeklickte.
    const area = (await plotBoxes(page, "spo2")).area;
    const startX = area.x + 1;

    const spo2 = await clickScalar(page, "spo2", 98, { x: startX, clock: "10:00:00" });
    const heart = await clickScalar(page, "heartRate", 74, { x: startX, clock: "10:00:00" });
    const temperature = await clickScalar(page, "temperature", 36.7, { x: startX, clock: "10:00:00" });
    expect(spo2.saved.time).toBe(ts("10:00:00"));
    expect(heart.saved.time).toBe(ts("10:00:00"));
    expect(temperature.saved.time).toBe(ts("10:00:00"));

    const nibp = await clickNibpMean(page, 93, { x: startX, clock: "10:00:00" });
    expect(nibp.time).toBe(ts("10:00:00"));

    // Systolisch und Diastolisch entstehen durch Ziehen der weissen Griffe.
    const systolic = await dragNibpHandle(page, nibp.id, "systolic", 122);
    const diastolic = await dragNibpHandle(page, nibp.id, "diastolic", 78);
    const stored = await measurementAt(page, "nibp", ts("10:00:00"));
    expect(stored.systolic).toBe(systolic);
    expect(stored.diastolic).toBe(diastolic);
    expect(stored.systolic!).toBeGreaterThan(stored.mean!);
    expect(stored.mean!).toBeGreaterThan(stored.diastolic!);

    // Was der Tooltip zeigt, steht genau so im Speicher.
    await page.getByTestId(`nibp-time-handle-${nibp.id}`).hover();
    await expect(page.getByTestId(`nibp-values-${nibp.id}`)).toContainText(
      `S ${stored.systolic} · M ${stored.mean} · D ${stored.diastolic} mmHg`,
    );

    await expect(page.locator('[data-testid="points-spo2"] circle')).toHaveCount(1);
    await expect(page.locator('[data-testid="points-heartRate"] circle')).toHaveCount(1);
    await expect(page.locator('[data-testid="points-nibp"] circle')).toHaveCount(1);
    await expect(page.locator('[data-testid="points-temperature"] circle')).toHaveCount(1);
    await beat(page);
  });

  await test.step("Medikamente und Infusion dokumentieren", async () => {
    const lane = page.getByTestId("lane-create-medication");
    await lane.scrollIntoViewIfNeeded();
    const laneBox = await lane.boundingBox();
    expect(laneBox).not.toBeNull();

    // Propofol 40 mg mit Wirkdauer – so entsteht die schraffierte Flaeche.
    await lane.click({ position: { x: 1, y: laneBox!.height / 2 } });
    await expect(page.getByTestId("medication-name")).toBeVisible();
    await expect(page.getByRole("radio", { name: "Bolus" })).toBeChecked();
    await page.getByTestId("medication-name").fill("Propofol");
    await setTimePicker(page, "therapy-time", "10:00:00");
    await page.getByTestId("medication-dose").fill("40");
    await selectTherapyUnit(page, "medication-unit", "Milligramm (mg)");
    await page.getByTestId("therapy-duration").fill("5");
    await page.getByTestId("therapy-save").click();
    await expect(page.getByTestId("therapy-save")).toHaveCount(0);

    await expect.poll(async () => (await caseData(page)).medications.length).toBe(1);
    const propofol = (await caseData(page)).medications[0];
    expect(propofol.startedAt).toBe(ts("10:00:00"));
    await expect(page.getByTestId(`medication-${propofol.id}`)).toContainText("Propofol · 40 mg");
    await beat(page);

    // Die Gabe erscheint als Schraffur in ALLEN Vitalbaendern. Beim Ueberfahren
    // nennt die Anwendung dort Medikament, Dosis, Beginn, Ende und Dauer.
    for (const band of ["spo2", "heartRate"] as const) {
      const hatch = page.getByTestId(`medication-hatch-${propofol.id}-${band}`);
      await expect(hatch).toBeAttached();
      const hatchBox = await boxOf(hatch);
      await page.mouse.move(
        (hatchBox.left + hatchBox.right) / 2,
        (hatchBox.top + hatchBox.bottom) / 2,
        { steps: 10 },
      );
      const tooltip = page.getByTestId("therapy-interval-tooltip");
      await expect(tooltip).toContainText("Propofol");
      await expect(tooltip).toContainText("Medikament · 40 mg");
      await expect(tooltip).toContainText("Dauer: 5 Minuten");
      await beat(page, 900);
    }

    // Alfentanil 1 mg um 10:01 an einer freien Stelle der Lane.
    await travelTo(page, "10:05:20");
    await lane.click({ position: { x: 150, y: laneBox!.height / 2 } });
    await expect(page.getByTestId("medication-name")).toBeVisible();
    await page.getByTestId("medication-name").fill("Alfentanil");
    await setTimePicker(page, "therapy-time", "10:01:00");
    await page.getByTestId("medication-dose").fill("1");
    await selectTherapyUnit(page, "medication-unit", "Milligramm (mg)");
    await page.getByTestId("therapy-save").click();
    await expect(page.getByTestId("therapy-save")).toHaveCount(0);
    await expect.poll(async () => (await caseData(page)).medications.length).toBe(2);
    const alfentanil = (await caseData(page)).medications.find((entry) => entry.name === "Alfentanil")!;
    expect(alfentanil.startedAt).toBe(ts("10:01:00"));
    await expect(page.getByTestId(`medication-${alfentanil.id}`)).toContainText("Alfentanil · 1 mg");
    await beat(page);

    // Ringer 500 mL als durchgehendes Intervall 10:02 – 10:30.
    const infusionLane = page.getByTestId("lane-create-infusion");
    await infusionLane.scrollIntoViewIfNeeded();
    const infusionBox = await infusionLane.boundingBox();
    expect(infusionBox).not.toBeNull();
    await infusionLane.click({ position: { x: 150, y: infusionBox!.height / 2 } });
    await expect(page.getByTestId("infusion-name")).toBeVisible();
    await page.getByTestId("infusion-name").fill("Ringer");
    await setTimePicker(page, "therapy-time", "10:02:00");
    await page.getByTestId("infusion-amount").fill("500");
    await selectTherapyUnit(page, "infusion-unit", "mL");
    await page.getByTestId("therapy-end-mode").getByText("Ende", { exact: true }).click();
    await setTimePicker(page, "therapy-end-time", "10:30:00");
    await expect(page.getByTestId("therapy-end-preview")).toContainText("10:30:00");
    await page.getByTestId("therapy-save").click();
    await expect(page.getByTestId("therapy-save")).toHaveCount(0);

    await expect.poll(async () => (await caseData(page)).infusions.length).toBe(1);
    const ringer = (await caseData(page)).infusions[0];
    expect(ringer.startedAt).toBe(ts("10:02:00"));
    expect(ringer.endedAt).toBe(ts("10:30:00"));
    await expect(page.getByTestId(`infusion-${ringer.id}`)).toContainText("Ringer · 500 mL");
    const interval = page.getByTestId(`infusion-${ringer.id}-lane-interval`);
    await expect(interval).toBeAttached();
    expect(
      await interval.evaluate((line) => Number(line.getAttribute("x2")) - Number(line.getAttribute("x1"))),
    ).toBeGreaterThan(100);
    await beat(page);
  });

  await test.step("Kontrollzeit-Modus: Werte direkt auf die 5-Minuten-Linie setzen", async () => {
    await travelTo(page, "10:05:40");
    const checkpoint = ts("10:05:00");
    const warning = page.getByTestId(`checkpoint-warning-${checkpoint}`);
    await expect(warning).toBeVisible();
    await expect(warning).toHaveAttribute("aria-pressed", "false");
    await beat(page);

    // Klick auf das Ausrufezeichen: der Modus schaltet ein (schwarzer Ring) und
    // die Kontrollzeit-Linie wird zur festen X-Position jeder folgenden Eingabe.
    await warning.click();
    await expect(warning).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("checkpoint-selection")).toContainText("Kontrollzeit 10:05:00");
    await beat(page);

    // In diesem Modus oeffnet sich KEIN Formular: die Zeigerhoehe ist der Wert und
    // die Zeit ist immer exakt die Kontrollzeit – unabhaengig davon, wo in der
    // Breite gedrueckt wird.
    for (const [kind, target] of [["spo2", 97], ["heartRate", 78], ["temperature", 36.6]] as const) {
      const shown = await pressValueAtCheckpoint(page, kind, target);
      const saved = await measurementAt(page, kind, checkpoint);
      expect(saved.time).toBe(checkpoint);
      expect(saved.value).toBeCloseTo(shown.value, 5);
      expect(shown.clock).toBe("10:05:00");
    }
    // Solange Werte fehlen, bleibt der Modus aktiv und die Warnung sichtbar.
    await expect(warning).toBeVisible();
    await expect(warning).toHaveAttribute("aria-pressed", "true");

    // Blutdruck: erst die Komponente waehlen, dann die Hoehe setzen.
    await page.getByTestId("nibp-component-mean").click();
    const meanShown = await pressValueAtCheckpoint(page, "nibp", 89);
    const nibp = await measurementAt(page, "nibp", checkpoint);
    expect(nibp.mean).toBeCloseTo(meanShown.value, 5);

    await page.getByTestId("nibp-component-systolic").click();
    await pressValueAtCheckpoint(page, "nibp", 118);
    await expect
      .poll(async () => (await caseData(page)).measurements.find((m) => m.id === nibp.id)?.systolic ?? null)
      .not.toBeNull();

    // Diastolisch fehlt noch -> Warnung bleibt. Jetzt den Modus wieder ausschalten.
    await expect(warning).toBeVisible();
    await warning.click();
    await expect(warning).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("checkpoint-selection")).toHaveCount(0);
    await beat(page);

    // Ausserhalb des Modus wird der fehlende Wert per Zug ergaenzt.
    const diastolic = await dragNibpHandle(page, nibp.id, "diastolic", 75);
    const complete = await measurementAt(page, "nibp", checkpoint);
    expect(complete.diastolic).toBe(diastolic);
    expect(complete.systolic!).toBeGreaterThan(complete.mean!);
    expect(complete.mean!).toBeGreaterThan(complete.diastolic!);
    // Alle vier Parameter liegen auf der Kontrollzeit -> die Warnung verschwindet.
    await expect(page.getByTestId(`checkpoint-warning-${checkpoint}`)).toHaveCount(0);
    expect((await caseData(page)).measurements.filter((m) => m.time === checkpoint)).toHaveLength(4);
    await beat(page);
  });

  await test.step("Schnitt dokumentieren", async () => {
    await travelTo(page, "10:06:30");
    await documentEvent(page, "incision", "10:06:00");
  });

  await test.step("Kritischen Wert und NIBP dokumentieren", async () => {
    await travelTo(page, "10:10:40");
    const checkpoint = ts("10:10:00");

    // SpO2 bewusst tief anklicken: unter 90 % meldet die Anwendung einen
    // kritischen Hinweis. Der Wert wird nicht getippt, sondern gesetzt.
    const spo2 = await yForValue(page, "spo2", 88);
    expect(spo2.shown).toBeLessThan(90);
    const checkpointHit = page.getByTestId(`checkpoint-band-spo2-${checkpoint}`);
    const hitBox = await checkpointHit.boundingBox();
    expect(hitBox).not.toBeNull();
    await page.mouse.click(hitBox!.x + hitBox!.width / 2, spo2.y);
    await expect(page.getByTestId("entry-save")).toBeVisible();
    expect(await readDraftValue(page, "spo2")).toBeCloseTo(spo2.shown, 5);
    await page.getByTestId("entry-save").click();
    await expect(page.getByTestId("entry-save")).toHaveCount(0);

    const critical = await measurementAt(page, "spo2", checkpoint);
    expect(critical.value).toBeCloseTo(spo2.shown, 5);
    const warning = page.getByTestId(`critical-warning-${critical.id}`);
    await expect(warning).toBeVisible();
    await beat(page);

    // Mit der Maus auf das Warnsymbol: die Anwendung erklaert den Hinweis im Bild.
    const iconBox = await boxOf(warning);
    await page.mouse.move((iconBox.left + iconBox.right) / 2, (iconBox.top + iconBox.bottom) / 2, { steps: 12 });
    const hint = page.getByTestId("warning-info");
    await expect(hint).toContainText("Kritischer Hinweis");
    await expect(hint).toContainText("SpO₂ liegt unter 90 %");
    await expect(warning).toHaveAttribute("title", /SpO₂ liegt unter 90 %/);
    await beat(page, 1200);

    // Das Warnsymbol liegt im DOM VOR den Griffen und ueberdeckt seinen eigenen
    // Messpunkt nicht – es darf keine Eingabe blockieren.
    const order = await page.evaluate(() => {
      const layer = document.querySelector('[data-testid="critical-warning-layer"]')!;
      const handles = document.querySelector('[data-testid="nibp-handles"]')!;
      return layer.compareDocumentPosition(handles) & Node.DOCUMENT_POSITION_FOLLOWING ? "handles-above" : "handles-below";
    });
    expect(order).toBe("handles-above");
    const pointBox = await boxOf(page.getByTestId(`point-spo2-${critical.id}`));
    const covered =
      iconBox.left <= pointBox.left + 10 && iconBox.right >= pointBox.right - 10 &&
      iconBox.top <= pointBox.top + 10 && iconBox.bottom >= pointBox.bottom - 10;
    expect(covered).toBe(false);

    // Trotz sichtbarer Warnung bleibt der Blutdruck vollstaendig bedienbar.
    const meanTarget = await yForValue(page, "nibp", 83);
    await page.mouse.click(hitBox!.x + hitBox!.width / 2, meanTarget.y);
    await expect(page.getByTestId("entry-mean")).toBeVisible();
    await page.getByTestId("entry-save").click();
    await expect(page.getByTestId("entry-save")).toHaveCount(0);
    const nibp = await measurementAt(page, "nibp", checkpoint);
    await expect(warning).toBeVisible();
    await dragNibpHandle(page, nibp.id, "systolic", 110);
    await expect(warning).toBeVisible();
    await dragNibpHandle(page, nibp.id, "diastolic", 70);
    const completeNibp = await measurementAt(page, "nibp", checkpoint);
    expect(completeNibp.systolic!).toBeGreaterThan(completeNibp.mean!);
    expect(completeNibp.mean!).toBeGreaterThan(completeNibp.diastolic!);
    await expect(warning).toBeVisible();

    // Herzfrequenz und Temperatur derselben Kontrollzeit ergaenzen, damit der
    // Punkt anschliessend frei anklickbar ist.
    for (const [kind, target] of [["heartRate", 82], ["temperature", 36.8]] as const) {
      const aim = await yForValue(page, kind, target);
      const bandHit = page.getByTestId(`checkpoint-band-${kind}-${checkpoint}`);
      const bandBox = await bandHit.boundingBox();
      expect(bandBox).not.toBeNull();
      await page.mouse.click(bandBox!.x + bandBox!.width / 2, aim.y);
      await expect(page.getByTestId("entry-save")).toBeVisible();
      await page.getByTestId("entry-save").click();
      await expect(page.getByTestId("entry-save")).toHaveCount(0);
      await measurementAt(page, kind, checkpoint);
      await beat(page, 400);
    }
    await expect(page.getByTestId(`checkpoint-warning-${checkpoint}`)).toHaveCount(0);
    await beat(page);
  });

  await test.step("Kritischen Wert durch Ziehen korrigieren", async () => {
    const critical = (await caseData(page)).measurements
      .filter((m) => m.kind === "spo2")
      .sort((a, b) => a.time - b.time)
      .at(-1)!;
    expect(critical.value!).toBeLessThan(90);

    // Der falsche Wert wird nicht ueberschrieben, sondern nach oben gezogen.
    const corrected = await dragScalarPoint(page, "spo2", critical.id, 96);
    expect(corrected.value).toBeGreaterThanOrEqual(90);

    const stored = (await caseData(page)).measurements.find((m) => m.id === critical.id)!;
    expect(stored.value).toBeCloseTo(corrected.value, 5);
    expect(stored.value).not.toBe(critical.value);
    // Ohne kritischen Wert verschwindet auch das Warnsymbol.
    await expect(page.getByTestId(`critical-warning-${critical.id}`)).toHaveCount(0);
    await expect(page.getByTestId("save-status")).toContainText("Gespeichert");
    await beat(page);
  });

  await test.step("Messwert entfernen", async () => {
    await travelTo(page, "10:17:20");
    // Bewusst zwischen zwei Kontrollzeiten, damit der Punkt frei anklickbar bleibt.
    const temporary = await clickScalar(page, "temperature", 37.4);
    const before = await countOf(page, "temperature");
    await expect(page.getByTestId(`point-temperature-${temporary.saved.id}`)).toBeAttached();
    await beat(page);

    const pointBox = await page.getByTestId(`point-temperature-${temporary.saved.id}`).boundingBox();
    expect(pointBox).not.toBeNull();
    await page.mouse.click(pointBox!.x + pointBox!.width / 2, pointBox!.y + pointBox!.height / 2);
    await expect(page.getByTestId("entry-delete")).toBeVisible();
    await page.getByTestId("entry-delete").click();
    await page.locator(".ant-popconfirm").getByRole("button", { name: "Löschen", exact: true }).click();
    await expect(page.getByTestId("entry-save")).toHaveCount(0);

    await expect.poll(async () => countOf(page, "temperature")).toBe(before - 1);
    await expect
      .poll(async () => (await caseData(page)).measurements.some((m) => m.id === temporary.saved.id))
      .toBe(false);
    await beat(page);
  });

  await test.step("Phasen abschließen", async () => {
    await travelTo(page, "10:20:30");
    await documentEvent(page, "suture", "10:20:00");
    await travelTo(page, "10:25:30");
    await documentEvent(page, "emergenceEnd", "10:25:00");
    await travelTo(page, "10:30:30");
    await documentEvent(page, "patientOut", "10:30:00");

    for (const type of ["anesthesiaStart", "incision", "suture", "emergenceEnd", "patientOut"]) {
      await expect(page.getByTestId(`event-${type}`)).toBeVisible();
    }
    expect(await page.getByTestId("event-line").count()).toBe(5);
    await beat(page);
  });

  await test.step("Fall beenden", async () => {
    await page.getByTestId("end-case-button").click();
    const confirmation = page.locator(".ant-popconfirm");
    await expect(confirmation).toContainText("Möchten Sie den Eingriff wirklich beenden?");
    await confirmation.getByRole("button", { name: "Eingriff beenden", exact: true }).click();

    await expect(page.getByTestId("case-ended")).toContainText(/Beendet um \d{2}:\d{2}:\d{2}/);
    await expect.poll(async () => (await caseData(page)).endedAt !== null).toBe(true);
    expect((await caseData(page)).endedAt!).toBeGreaterThan(ts("10:30:00"));
    await beat(page);
  });

  await test.step("Persistenz nach Reload prüfen", async () => {
    const before = await caseData(page);
    await page.reload();
    await expect(page.getByTestId("case-ended")).toBeVisible();

    const header = page.getByTestId("case-header");
    await expect(header).toContainText(PATIENT.name);
    await expect(header).toContainText(PATIENT.procedure);
    await expect(header).toContainText(DEMO_DATE_DE);

    const after = await caseData(page);
    expect(after.startedAt).toBe(ts("10:00:00"));
    expect(after.endedAt).toBe(before.endedAt);
    expect(after.measurements).toEqual(before.measurements);
    expect(after.medications).toEqual(before.medications);
    expect(after.infusions).toEqual(before.infusions);
    expect(after.events).toEqual(before.events);

    // Der geloeschte Temperaturwert kehrt nicht zurueck.
    expect(after.measurements.filter((m) => m.kind === "temperature")).toHaveLength(3);
    expect(after.measurements.filter((m) => m.kind === "spo2").every((m) => m.value! >= 90)).toBe(true);
    await expect(page.locator('[data-testid="points-spo2"] circle')).toHaveCount(3);
    await expect(page.locator('[data-testid="points-heartRate"] circle')).toHaveCount(3);
    await expect(page.locator('[data-testid="points-nibp"] circle')).toHaveCount(3);
    await expect(page.locator('[data-testid="points-temperature"] circle')).toHaveCount(3);

    const propofol = after.medications.find((entry) => entry.name === "Propofol")!;
    const alfentanil = after.medications.find((entry) => entry.name === "Alfentanil")!;
    const ringer = after.infusions[0];
    expect(propofol.startedAt).toBe(ts("10:00:00"));
    expect(alfentanil.startedAt).toBe(ts("10:01:00"));
    expect(ringer).toMatchObject({ name: "Ringer", startedAt: ts("10:02:00"), endedAt: ts("10:30:00") });
    await expect(page.getByTestId(`medication-${propofol.id}`)).toContainText("Propofol · 40 mg");
    await expect(page.getByTestId(`infusion-${ringer.id}`)).toContainText("Ringer · 500 mL");

    expect(Object.fromEntries(after.events.map((event) => [event.eventType, event.time]))).toMatchObject({
      anesthesiaStart: ts("10:00:00"),
      incision: ts("10:06:00"),
      suture: ts("10:20:00"),
      emergenceEnd: ts("10:25:00"),
      patientOut: ts("10:30:00"),
    });

    const patient = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), PATIENT_KEY);
    expect(patient).toMatchObject({
      patientName: PATIENT.name,
      birthDate: PATIENT.birthDate,
      procedure: PATIENT.procedure,
      operationDate: DEMO_DATE_DE,
      bodyWeightKg: 68,
      weightUnit: "kg",
      asaClass: "II",
      mallampatiClass: "II",
    });
    await beat(page);
  });

  await test.step("Speichern und Schließen: Kontrollseite vor dem Sichern durchsehen", async () => {
    const snapshot = await caseData(page);
    await page.getByTestId("save-close-case").click();
    await page.waitForURL("**/abschluss");
    const review = page;

    await expect(review.getByRole("heading", { name: "Kontrolle" })).toBeVisible();
    await expect(review.getByTestId("case-close-page")).toBeVisible();
    await beat(review, 900);

    // 1. Basisdaten – alle Angaben des Falls stehen zur Kontrolle bereit.
    const summary = review.getByTestId("case-basis-summary");
    await expect(summary).toContainText(PATIENT.name);
    await expect(summary).toContainText(PATIENT.birthDate);
    await expect(summary).toContainText(PATIENT.procedure);
    await expect(summary).toContainText(DEMO_DATE_DE);

    // 2. Grafik – jede dokumentierte Messung und jedes Ereignis ist enthalten.
    const preview = review.getByTestId("case-timeline-preview");
    await expect(preview).toBeVisible();
    await expect(preview.getByTestId("preview-series-spo2").locator("circle")).toHaveCount(3);
    await expect(preview.getByTestId("preview-series-heartRate").locator("circle")).toHaveCount(3);
    await expect(preview.getByTestId("preview-series-temperature").locator("circle")).toHaveCount(3);
    for (const entry of [...snapshot.medications, ...snapshot.infusions]) {
      await expect(preview.locator(`[data-testid$="-${entry.id}"]`).first()).toBeAttached();
    }
    for (const event of snapshot.events) {
      await expect(preview.getByTestId(`preview-event-${event.id}`)).toBeAttached();
    }

    // 3. bis 5. Vollstaendigkeitspruefung, Zielordner und letzte Bestaetigung.
    await expect(review.getByTestId("case-completeness")).toBeVisible();
    await expect(review.getByTestId("archive-confirmation")).toBeAttached();
    await expect(review.getByTestId("archive-save")).toBeAttached();

    // Die gesamte Seite langsam von oben nach unten durchfahren.
    const maxScroll = await review.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    );
    expect(maxScroll).toBeGreaterThan(0);
    for (let position = 0; position <= maxScroll; position += Math.ceil(maxScroll / 12)) {
      await review.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), position);
      await beat(review, 420);
    }
    await review.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), maxScroll);
    await beat(review, 900);
    expect(await review.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(0);

    // Der Fall ist an dieser Stelle bewusst noch NICHT archiviert.
    expect(await review.evaluate((key) => localStorage.getItem(key) !== null, CASE_KEY)).toBe(true);
    await expect(review.getByTestId("case-close-complete")).toHaveCount(0);
    await beat(review, 1200);
  });
});
