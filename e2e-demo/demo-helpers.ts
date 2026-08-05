import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Gemeinsame Bausteine der Playwright-Demoaufnahmen.
 *
 * Grundregel aller Demo-Videos: Vitalwerte werden NICHT eingetippt. Jeder Wert
 * entsteht aus der Position des Mauszeigers in der Grafik – durch Klicken, im
 * Kontrollzeit-Modus oder durch Ziehen der Griffe. Die Helfer lesen dazu die
 * Koordinatenanzeige der Anwendung (Zeit und Y-Wert unter dem Zeiger); die Tests
 * behaupten anschliessend, dass genau der angezeigte Wert gespeichert wurde.
 *
 * Die Browser-Uhr wird fixiert, damit die Zeitachse in jedem Lauf identisch
 * beginnt.
 */

export const CASE_KEY = "sikant-anesthesia-demo-case:v1";
export const PATIENT_KEY = "sikant-anesthesia-demo.patient-base-data.v1";
export const CROSSHAIR = '[data-testid="crosshair-coordinate"]';

// Fester Demotag: 04.08.2026 (Monat ist 0-basiert).
export const DEMO_DAY = { year: 2026, month: 7, day: 4 } as const;
export const DEMO_DATE_DE = "04.08.2026";

export const DEMO_PATIENT = {
  name: "Anna Beispiel",
  birthDate: "14.05.1987",
  procedure: "Arthroskopie Knie rechts",
  weight: "68",
  asa: "ASA II",
  mallampati: "Klasse II",
};

/** "10:05:00" -> Zeitstempel am Demotag. */
export function ts(clock: string): number {
  const [hour, minute, second] = clock.split(":").map(Number);
  return new Date(DEMO_DAY.year, DEMO_DAY.month, DEMO_DAY.day, hour, minute, second ?? 0, 0).getTime();
}

// --- Sichtbarer Mauszeiger ---------------------------------------------------

/**
 * Playwright zeichnet den echten Cursor nicht ins Video. Diese Einblendung folgt
 * jedem Pointer-Ereignis und macht Bewegung, Druck und Ziehen sichtbar. Sie wird
 * erst nach dem Laden eingehaengt, damit die Hydration von React unberuehrt bleibt.
 * Registriert wird sie am Browser-Kontext, damit auch die in einem neuen Tab
 * geoeffnete Kontrollseite den Zeiger zeigt.
 */
export async function installDemoCursor(page: Page) {
  await page.context().addInitScript(() => {
    const install = () => {
      if (document.getElementById("__demo-cursor")) return;
      const dot = document.createElement("div");
      dot.id = "__demo-cursor";
      dot.style.cssText = [
        "position:fixed", "left:0", "top:0", "width:26px", "height:26px",
        "margin:-13px 0 0 -13px", "border-radius:50%",
        "border:3px solid #d6006e", "background:rgba(214,0,110,0.22)",
        "box-shadow:0 0 0 2px rgba(255,255,255,0.95), 0 3px 10px rgba(0,0,0,0.45)",
        "pointer-events:none", "z-index:2147483647",
        "transition:width .09s, height .09s, background .09s",
      ].join(";");
      document.body.appendChild(dot);
      let x = 0;
      let y = 0;
      const place = () => { dot.style.left = `${x}px`; dot.style.top = `${y}px`; };
      addEventListener("pointermove", (event) => { x = event.clientX; y = event.clientY; place(); }, true);
      addEventListener("pointerdown", () => {
        dot.style.background = "rgba(214,0,110,0.6)";
        dot.style.width = "16px";
        dot.style.height = "16px";
        dot.style.margin = "-8px 0 0 -8px";
      }, true);
      addEventListener("pointerup", () => {
        dot.style.background = "rgba(214,0,110,0.22)";
        dot.style.width = "26px";
        dot.style.height = "26px";
        dot.style.margin = "-13px 0 0 -13px";
      }, true);
    };
    if (document.readyState === "complete") install();
    else addEventListener("load", install);
  });
}

/**
 * Die Anwendung oeffnet die Kontrollseite bewusst in einem neuen Tab. Playwright
 * zeichnet pro Seite ein eigenes Video auf, wodurch der Abschluss in einer
 * zweiten Datei landen wuerde. Fuer eine durchgehende Aufnahme wird daher beim
 * Klick lediglich das `target`-Attribut des Links entfernt. Schaltflaeche, Route,
 * Validierung und Exportlogik der Anwendung bleiben unveraendert.
 */
export async function keepReviewInSameTab(page: Page) {
  await page.context().addInitScript(() => {
    document.addEventListener(
      "click",
      (event) => {
        const origin = event.target as Element | null;
        const link = origin?.closest?.('a[target="_blank"]');
        if (link) link.removeAttribute("target");
      },
      true,
    );
  });
}

/** Sichtbarer Zeiger, fixierte Uhr und ein leerer lokaler Speicher. */
export async function prepareDemoPage(page: Page, clock = "09:57:00") {
  // Beide Init-Skripte muessen vor dem ersten Laden registriert sein.
  await installDemoCursor(page);
  await keepReviewInSameTab(page);
  await page.clock.install({ time: new Date(ts(clock)) });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("#__demo-cursor")).toBeAttached();
}

// --- Zeitsteuerung -----------------------------------------------------------

/**
 * Springt auf eine feste Uhrzeit des Demotags und laesst die Zeit danach wieder
 * normal fliessen. Nur so laufen die Animationen von Ant Design (Drawer, Modal)
 * weiter, waehrend die Zeitachse trotzdem deterministisch bleibt.
 */
export async function travelTo(page: Page, clock: string) {
  const target = ts(clock);
  const current = await page.evaluate(() => Date.now());
  if (current >= target) return;
  await page.clock.pauseAt(new Date(target));
  await page.clock.resume();
}

/** Nur fuer die Lesbarkeit des Videos – niemals zur Testsynchronisation. */
export async function beat(page: Page, ms = 700) {
  await page.waitForTimeout(ms);
}

// --- Zustand lesen -----------------------------------------------------------

export interface CaseSnapshot {
  caseId?: string;
  startedAt: number | null;
  endedAt: number | null;
  measurements: Array<{
    id: string;
    kind: string;
    time: number;
    value?: number;
    systolic?: number | null;
    mean?: number;
    diastolic?: number | null;
  }>;
  medications: Array<{ id: string; name: string; startedAt: number; endedAt: number | null; dose: number }>;
  infusions: Array<{ id: string; name: string; startedAt: number; endedAt: number | null; amount: number }>;
  events: Array<{ id: string; eventType: string; time: number }>;
}

export async function caseData(page: Page): Promise<CaseSnapshot> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), CASE_KEY);
}

export async function measurementAt(page: Page, kind: string, time: number) {
  await expect
    .poll(async () => (await caseData(page)).measurements.some((m) => m.kind === kind && m.time === time))
    .toBe(true);
  return (await caseData(page)).measurements.find((m) => m.kind === kind && m.time === time)!;
}

/** Neueste Messung eines Typs (fuer Klicks ohne vorher bekannte Zeit). */
export async function newestMeasurement(page: Page, kind: string, previousCount: number) {
  await expect
    .poll(async () => (await caseData(page)).measurements.filter((m) => m.kind === kind).length)
    .toBe(previousCount + 1);
  const all = (await caseData(page)).measurements.filter((m) => m.kind === kind);
  return all.sort((a, b) => a.time - b.time).at(-1)!;
}

export async function countOf(page: Page, kind: string) {
  return (await caseData(page)).measurements.filter((m) => m.kind === kind).length;
}

// --- Koordinatenanzeige der Anwendung ----------------------------------------

/** Zerlegt "10:04:12 · SpO₂ 93 %" in Uhrzeit und Zahlenwert. */
export function parseCrosshair(text: string): { clock: string; value: number } {
  const [clockPart, valuePart] = text.split("·");
  const match = /(-?\d+(?:,\d+)?)\s*(?:%|\/min|mmHg|°C)\s*$/.exec(valuePart ?? "");
  expect(match, `Koordinatenanzeige nicht lesbar: "${text}"`).not.toBeNull();
  return { clock: clockPart.trim(), value: Number(match![1].replace(",", ".")) };
}

export async function crosshairState(page: Page) {
  return page.evaluate(() => {
    const svg = document.querySelector('[data-testid="vital-timeline-svg"]');
    const vertical = document.querySelector('[data-testid="timeline-crosshair"] .crosshair-vertical');
    const horizontal = document.querySelector('[data-testid="timeline-crosshair"] .crosshair-horizontal');
    const text = document.querySelector('[data-testid="crosshair-coordinate"]');
    if (!svg || !vertical || !horizontal || !text) return null;
    const rect = svg.getBoundingClientRect();
    return {
      absX: rect.left + Number(vertical.getAttribute("x1")),
      absY: rect.top + Number(horizontal.getAttribute("y1")),
      text: text.textContent ?? "",
    };
  });
}

/**
 * Bewegt die Maus an eine Stelle der Grafik und wartet, bis das Fadenkreuz der
 * Anwendung dort steht. Erst danach wird die Koordinate gelesen – so gilt immer
 * genau der Wert, den auch die Nutzerin im Video sieht.
 */
export async function probe(page: Page, x: number, y: number): Promise<{ clock: string; value: number }> {
  await page.mouse.move(x, y, { steps: 8 });
  await expect.poll(async () => (await crosshairState(page))?.absX ?? null).toEqual(expect.closeTo(x, 0));
  return parseCrosshair((await crosshairState(page))!.text);
}

/**
 * Im Kontrollzeit-Modus zeigt die Anwendung die Koordinate nur waehrend eines
 * gedrueckten Zeigers und haelt X auf der Kontrollzeit fest. Gewartet wird daher
 * auf die Hoehe des Fadenkreuzes; die Toleranz liegt deutlich unter dem Abstand
 * der Messfahrten und erkennt eine veraltete Anzeige zuverlaessig.
 */
export async function settleCheckpointCrosshair(page: Page, y: number, x?: number) {
  try {
    await expect
      .poll(async () => {
        const state = await crosshairState(page);
        return state !== null && Math.abs(state.absY - y) <= 12;
      })
      .toBe(true);
  } catch (error) {
    // Aussagekraeftige Diagnose statt eines nackten "false".
    const diagnosis = await page.evaluate(({ x, y }) => ({
      unterZeiger: x === undefined ? null : document.elementFromPoint(x, y)?.tagName ?? "nichts",
      fadenkreuz: Boolean(document.querySelector('[data-testid="timeline-crosshair"]')),
      kontrollzeitAktiv: Boolean(document.querySelector('[data-testid="checkpoint-selection"]')),
    }), { x, y });
    throw new Error(
      `Kontrollzeit-Koordinate erschien nicht auf Hoehe ${Math.round(y)}: ${JSON.stringify(diagnosis)}`,
      { cause: error },
    );
  }
  return parseCrosshair((await crosshairState(page))!.text);
}

export async function plotBoxes(page: Page, kind: string) {
  const band = page.getByTestId(`band-${kind}`);
  await band.scrollIntoViewIfNeeded();
  const [bandBox, areaBox, nowBox] = await Promise.all([
    band.boundingBox(),
    page.getByTestId("timeline-create-area").boundingBox(),
    page.getByTestId("now-dot").boundingBox(),
  ]);
  expect(bandBox).not.toBeNull();
  expect(areaBox).not.toBeNull();
  expect(nowBox).not.toBeNull();

  // Bereits dokumentierte Werte besitzen eigene Bedienflaechen (Messpunkt,
  // NIBP-Griffe). Wer dort hineinfaehrt, bearbeitet den bestehenden Wert statt
  // einen neuen anzulegen. Die Messfahrt weicht diesen Stellen deshalb aus.
  const occupied = await page.evaluate((box) => {
    const svg = document.querySelector('[data-testid="vital-timeline-svg"]');
    if (!svg) return [] as number[];
    return [...svg.querySelectorAll('[role="button"]')].flatMap((element) => {
      const rect = element.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      if (centerY < box.y || centerY > box.y + box.height) return [];
      return [rect.left + rect.width / 2];
    });
  }, { y: bandBox!.y, height: bandBox!.height });

  const nowCenter = nowBox!.x + nowBox!.width / 2;
  const leftLimit = areaBox!.x + 10;
  // Kandidaten links der Jetzt-Linie: dort ist jede Zeit gueltig und die
  // Jetzt-Fangzone (6 px) sicher ausserhalb.
  const candidates: number[] = [];
  for (let offset = 34; offset <= 400; offset += 22) candidates.push(nowCenter - offset);
  const free = candidates.find(
    (x) => x >= leftLimit && occupied.every((taken) => Math.abs(taken - x) >= 26),
  );
  const probeX = free ?? Math.max(leftLimit, nowCenter - 34);
  return { band: bandBox!, area: areaBox!, probeX };
}

/**
 * Ermittelt durch zwei Messfahrten, welche Bildschirm-Y im Band welchem Wert
 * entspricht, und liefert die Y-Position fuer den Zielwert. Die Y-Achse ist
 * dynamisch (sie folgt den vorhandenen Daten), daher wird vor jeder Eingabe neu
 * kalibriert. Der Zielwert wird auf den tatsaechlich darstellbaren Bereich
 * begrenzt – gespeichert wird immer das, was die Grafik hergibt.
 */
export async function calibrateBand(page: Page, kind: string) {
  const { band, probeX } = await plotBoxes(page, kind);
  const yA = band.y + band.height * 0.3;
  const yB = band.y + band.height * 0.72;
  const a = await probe(page, probeX, yA);
  const b = await probe(page, probeX, yB);
  expect(a.value, `Kalibrierfahrt im Band ${kind} liefert zwei verschiedene Werte`).not.toBe(b.value);
  const unitsPerPixel = (b.value - a.value) / (yB - yA);
  const clamp = (y: number) => Math.min(band.y + band.height - 8, Math.max(band.y + 8, y));
  return {
    probeX,
    band,
    yFor: (value: number) => clamp(yA + (value - a.value) / unitsPerPixel),
    clamp,
  };
}

export async function yForValue(page: Page, kind: string, target: number) {
  const { yFor, probeX } = await calibrateBand(page, kind);
  const y = yFor(target);
  const shown = await probe(page, probeX, y);
  return { y, probeX, shown: shown.value, clock: shown.clock };
}

// --- Eingabe per Klick -------------------------------------------------------

/**
 * Legt einen Skalarwert an: Klick in das Band (die Hoehe bestimmt den Wert), im
 * Formular wird ausschliesslich die Uhrzeit gesetzt und gespeichert. Der Wert
 * bleibt exakt der angeklickte.
 */
export async function clickScalar(
  page: Page,
  kind: string,
  targetValue: number,
  options: { x?: number; clock?: string } = {},
) {
  const before = await countOf(page, kind);
  const { y, probeX } = await yForValue(page, kind, targetValue);
  const x = options.x ?? probeX;
  const shown = await probe(page, x, y);
  await page.mouse.click(x, y);
  await expect(page.getByTestId("entry-save")).toBeVisible();

  // Das Formular uebernimmt exakt den angeklickten Wert – nichts wird getippt.
  const drafted = await readDraftValue(page, kind);
  expect(drafted).toBeCloseTo(shown.value, 5);

  if (options.clock) await setTimePicker(page, "entry-time", options.clock);
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("entry-save")).toHaveCount(0);

  const saved = await newestMeasurement(page, kind, before);
  expect(saved.value).toBeCloseTo(shown.value, 5);
  await beat(page, 500);
  return { saved, shown };
}

export async function readDraftValue(page: Page, kind: string): Promise<number> {
  const raw = kind === "temperature"
    ? await page.getByRole("combobox", { name: "Temperatur auswählen" }).inputValue()
    : await page.getByTestId(kind === "nibp" ? "entry-mean" : "entry-value").inputValue();
  return Number(raw.replace(",", "."));
}

/** Legt den Mittelwert des Blutdrucks per Klick an (Systolisch/Diastolisch folgen per Zug). */
export async function clickNibpMean(page: Page, targetMean: number, options: { x?: number; clock?: string } = {}) {
  const before = await countOf(page, "nibp");
  const { y, probeX } = await yForValue(page, "nibp", targetMean);
  const x = options.x ?? probeX;
  const shown = await probe(page, x, y);
  await page.mouse.click(x, y);
  await expect(page.getByTestId("entry-mean")).toBeVisible();
  expect(await readDraftValue(page, "nibp")).toBeCloseTo(shown.value, 5);
  if (options.clock) await setTimePicker(page, "entry-time", options.clock);
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("entry-save")).toHaveCount(0);
  const saved = await newestMeasurement(page, "nibp", before);
  expect(saved.mean).toBeCloseTo(shown.value, 5);
  await beat(page, 500);
  return saved;
}

const UNSET_HANDLE_OFFSET = 16;

/**
 * Fuehrt eine Ziehbewegung aus, die zuverlaessig als Ziehen und nicht als Tippen
 * gewertet wird: erst ein deutlicher Ausschlag ueber die Bewegungsschwelle, dann
 * die Fahrt auf die Zielhoehe. Ein zu kurzer Weg wuerde stattdessen das Formular
 * oeffnen und die Geste abbrechen.
 */
export async function dragVertically(
  page: Page,
  x: number,
  startY: number,
  targetY: number,
  clamp: (y: number) => number,
) {
  const overshoot = clamp(targetY >= startY ? Math.max(targetY, startY + 30) : Math.min(targetY, startY - 30));
  await page.mouse.move(x, startY, { steps: 6 });
  await page.mouse.down();
  await page.mouse.move(x, overshoot, { steps: 10 });
  await page.mouse.move(x, targetY, { steps: 8 });
  await page.mouse.up();
}

/**
 * Zieht den Griff fuer Systolisch bzw. Diastolisch mit der Maus auf den Zielwert.
 * Die Y-Achse folgt den vorhandenen Daten und weitet sich mit jedem Zug; deshalb
 * wird bis zu dreimal nachgezogen, solange der Wert noch Fortschritt macht.
 */
export async function dragNibpHandle(page: Page, id: string, part: "systolic" | "diastolic", target: number) {
  const valueOf = async () => {
    const entry = (await caseData(page)).measurements.find((m) => m.id === id)!;
    return (part === "systolic" ? entry.systolic : entry.diastolic) ?? null;
  };
  let previous: number | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const reached = await valueOf();
    if (reached !== null) {
      if (Math.abs(reached - target) <= 1) break;
      if (previous !== null && Math.abs(reached - previous) < 0.5) break;
      previous = reached;
    }

    const { yFor, clamp } = await calibrateBand(page, "nibp");
    const targetY = yFor(target);
    const handleBox = await page.getByTestId(`nibp-time-handle-${id}`).boundingBox();
    expect(handleBox).not.toBeNull();
    const cx = handleBox!.x + handleBox!.width / 2;
    const meanY = handleBox!.y + handleBox!.height / 2;
    // Noch nicht gesetzte Endpunkte liegen als gestrichelte Griffe dicht am Mittelwert.
    const startY = reached === null
      ? meanY + (part === "systolic" ? -UNSET_HANDLE_OFFSET : UNSET_HANDLE_OFFSET)
      : yFor(reached);

    await dragVertically(page, cx, startY, targetY, clamp);
    // Ein Zug darf niemals das Eingabeformular oeffnen.
    await expect(page.getByTestId("entry-save")).toHaveCount(0);
    await beat(page, 350);
  }

  const value = await valueOf();
  expect(value, `${part} wurde per Ziehen gesetzt`).not.toBeNull();
  return value!;
}

/** Zieht einen bestehenden Skalarpunkt mit der Maus auf einen neuen Y-Wert. */
export async function dragScalarPoint(page: Page, kind: string, id: string, target: number) {
  const { yFor, clamp } = await calibrateBand(page, kind);
  const targetY = yFor(target);
  const pointBox = await page.getByTestId(`point-${kind}-${id}`).boundingBox();
  expect(pointBox).not.toBeNull();
  const x = pointBox!.x + pointBox!.width / 2;
  const startY = pointBox!.y + pointBox!.height / 2;
  const overshoot = clamp(targetY >= startY ? Math.max(targetY, startY + 30) : Math.min(targetY, startY - 30));

  await page.mouse.move(x, startY, { steps: 8 });
  await page.mouse.down();
  // Die Anwendung erkennt ein Ziehen erst ab 9 px Bewegung.
  await page.mouse.move(x, overshoot, { steps: 10 });
  await page.mouse.move(x, targetY, { steps: 8 });
  const live = parseCrosshair((await page.locator(CROSSHAIR).textContent()) ?? "");
  await page.mouse.up();
  await expect(page.getByTestId("entry-save")).toHaveCount(0);
  await expect
    .poll(async () => (await caseData(page)).measurements.find((m) => m.id === id)?.value)
    .toBeCloseTo(live.value, 5);
  await beat(page, 400);
  return live;
}

/**
 * Setzt einen Wert im Kontrollzeit-Modus: der Zeiger wird gedrueckt, die Anzeige
 * folgt der Hoehe, und erst beim Loslassen uebernimmt die Anwendung genau den
 * zuletzt angezeigten Wert. Kalibriert wird innerhalb derselben Geste, weil die
 * Koordinatenanzeige in diesem Modus nur bei gedruecktem Zeiger erscheint.
 */
export async function pressValueAtCheckpoint(page: Page, kind: string, target: number) {
  const { band, probeX } = await plotBoxes(page, kind);
  const yA = band.y + band.height * 0.34;
  const yB = band.y + band.height * 0.64;

  await page.mouse.move(probeX, yA, { steps: 8 });
  await page.mouse.down();
  const a = await settleCheckpointCrosshair(page, yA, probeX);
  await page.mouse.move(probeX, yB, { steps: 10 });
  const b = await settleCheckpointCrosshair(page, yB, probeX);
  expect(a.value, `Kalibrierfahrt im Band ${kind}`).not.toBe(b.value);

  const unitsPerPixel = (b.value - a.value) / (yB - yA);
  const targetY = Math.min(
    band.y + band.height - 10,
    Math.max(band.y + 10, yA + (target - a.value) / unitsPerPixel),
  );
  await page.mouse.move(probeX, targetY, { steps: 10 });
  const shown = await settleCheckpointCrosshair(page, targetY, probeX);
  await page.mouse.up();
  // Im Kontrollzeit-Modus oeffnet sich bewusst kein Formular.
  await expect(page.getByTestId("entry-save")).toHaveCount(0);
  await beat(page, 500);
  return shown;
}

// --- Formulare und Lanes -----------------------------------------------------

export async function setTimePicker(page: Page, testId: string, clock: string) {
  const root = page.getByTestId(testId);
  const nested = root.locator("input");
  const input = (await nested.count()) ? nested : root;
  await input.fill(clock);
  await input.press("Escape");
}

export async function selectBasisOption(page: Page, field: string, label: string) {
  await page.getByTestId(`field-${field}`).getByRole("combobox").click();
  await page.locator(`.ant-select-item-option[title="${label}"]`).click();
}

export async function selectTherapyUnit(page: Page, testId: "medication-unit" | "infusion-unit", label: string) {
  const select = page.getByTestId(testId);
  await select.click();
  const input = select.locator("input");
  await input.fill(label);
  const option = page.locator(
    `.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option[title="${label}"]`,
  );
  await expect(option).toBeVisible();
  await input.press("Enter");
  await expect(select).toContainText(label);
}

/** Fuellt die Basisdatenseite mit einem eindeutig fiktiven Musterfall. */
export async function fillBasisdaten(page: Page, patient = DEMO_PATIENT) {
  await expect(page.getByRole("heading", { name: "Basisdaten des Narkosefalls" })).toBeVisible();
  await page.getByTestId("input-patientName").fill(patient.name);
  await page.getByTestId("input-birthDate").fill(patient.birthDate);
  await page.getByTestId("input-procedure").fill(patient.procedure);
  await page.getByTestId("operation-date-today").click();
  await page.locator("#bodyWeightKg").fill(patient.weight);
  await selectBasisOption(page, "asaClass", patient.asa);
  await selectBasisOption(page, "mallampatiClass", patient.mallampati);
  const noAllergies = page.getByTestId("no-known-allergies");
  await noAllergies.click();
  await expect(noAllergies).toHaveAttribute("aria-pressed", "true");

  await expect(page.getByTestId("input-patientName")).toHaveValue(patient.name);
  await expect(page.getByTestId("input-birthDate")).toHaveValue(patient.birthDate);
  await expect(page.getByTestId("input-procedure")).toHaveValue(patient.procedure);
  await expect(page.getByTestId("input-operationDate")).toHaveValue(DEMO_DATE_DE);
  await expect(page.getByTestId("input-allergies")).toHaveValue("Keine Allergien bekannt");
  await expect(page.getByTestId("global-status")).toContainText("automatisch gespeichert");
}

/** Startet den Fall exakt zur angegebenen Uhrzeit und laesst die Uhr weiterlaufen. */
export async function startCaseAt(page: Page, clock: string) {
  await page.clock.pauseAt(new Date(ts(clock)));
  await page.getByTestId("start-button").click();
  await expect(page.getByTestId("case-started")).toHaveText(`Gestartet um ${clock}`);
  await page.clock.resume();
  await expect(page.getByTestId("now-dot")).toBeVisible();
  await expect(page.getByTestId("timeline-create-area")).toBeVisible();
}

/** Platziert ein Ereignis in der Lane und korrigiert die Zeit im Formular. */
export async function documentEvent(page: Page, eventType: string, clock: string) {
  const tool = page.getByTestId(`select-event-${eventType}`);
  await tool.click();
  await expect(tool).toHaveAttribute("aria-pressed", "true");

  const lane = page.getByTestId("lane-create-event");
  await lane.scrollIntoViewIfNeeded();
  const box = await lane.boundingBox();
  expect(box).not.toBeNull();
  await lane.click({ position: { x: 1, y: box!.height / 2 } });
  await expect(page.getByTestId(`event-${eventType}`)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(tool).toHaveAttribute("aria-pressed", "false");

  await page.getByTestId(`event-hit-${eventType}`).click();
  await expect(page.getByTestId("therapy-time")).toBeVisible();
  await setTimePicker(page, "therapy-time", clock);
  await page.getByTestId("therapy-save").click();
  await expect(page.getByTestId("therapy-save")).toHaveCount(0);

  await expect
    .poll(async () => (await caseData(page)).events.find((event) => event.eventType === eventType)?.time)
    .toBe(ts(clock));
  await expect(page.getByTestId(`event-${eventType}`)).toBeVisible();
  await beat(page, 500);
}

export async function boxOf(locator: Locator) {
  return locator.evaluate((element) => {
    const rect = (element as SVGGraphicsElement).getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  });
}
