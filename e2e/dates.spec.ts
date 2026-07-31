import { test, expect } from "@playwright/test";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function deDate(d: Date): string {
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}
function daysFromToday(offset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("automatische Punkte beim Tippen", async ({ page }) => {
  const birth = page.getByTestId("input-birthDate");
  await birth.pressSequentially("2112");
  await expect(birth).toHaveValue("21.12.");
  // Einfuegen einer vollstaendigen Ziffernfolge.
  await birth.fill("21122026");
  await expect(birth).toHaveValue("21.12.2026");
});

test("unvollstaendiges Datum bleibt nach sofortigem Reload erhalten", async ({ page }) => {
  await page.getByTestId("input-birthDate").pressSequentially("21");
  await expect(page.getByTestId("input-birthDate")).toHaveValue("21.");
  await page.reload();
  await expect(page.getByTestId("input-birthDate")).toHaveValue("21.");
});

test("Kalenderauswahl wird sofort gespeichert und bleibt nach Reload erhalten", async ({ page }) => {
  await page.getByTestId("field-birthDate").getByRole("button", { name: "Kalender öffnen" }).click();
  await expect(page.locator(".ant-picker-dropdown")).toBeVisible();
  // Tag 15 des aktuellen Monats waehlen (nicht in der Zukunft, gueltig).
  await page.locator('.ant-picker-dropdown .ant-picker-cell-in-view[title$="-15"]').first().click();

  const now = new Date();
  const expected = deDate(new Date(now.getFullYear(), now.getMonth(), 15));
  await expect(page.getByTestId("input-birthDate")).toHaveValue(expected);

  await page.reload();
  await expect(page.getByTestId("input-birthDate")).toHaveValue(expected);
});

test("Geburtsdatum-Validierung", async ({ page }) => {
  const birth = page.getByTestId("input-birthDate");
  const error = page.getByTestId("error-birthDate");

  await birth.fill("01.01.1985");
  await expect(error).toHaveCount(0);

  await birth.fill("15.06.2000");
  await expect(error).toHaveCount(0);

  // Ungueltiges Jahrhundert (14) -> blockiert + Meldung.
  await birth.fill("01011426");
  await expect(birth).toHaveValue("01.01.14");
  await expect(error).toHaveText("Das Geburtsjahr muss mit 19 oder 20 beginnen.");

  // Jahr in der Zukunft (naechstes Jahr, Praefix 20) -> Bereichsmeldung.
  const nextYear = new Date().getFullYear() + 1;
  await birth.fill(`01.01.${nextYear}`);
  await expect(error).toHaveText("Das Geburtsjahr muss zwischen 1900 und dem aktuellen Jahr liegen.");
});

test("OP-Datum-Validierung (maximal sieben Tage zurueck)", async ({ page }) => {
  const op = page.getByTestId("input-operationDate");
  const error = page.getByTestId("error-operationDate");

  await op.fill(deDate(new Date()));
  await expect(error).toHaveCount(0);

  await op.fill(deDate(daysFromToday(-7)));
  await expect(error).toHaveCount(0);

  await op.fill(deDate(daysFromToday(-8)));
  await expect(error).toHaveText("Das OP-Datum darf höchstens sieben Tage zurückliegen.");
});
