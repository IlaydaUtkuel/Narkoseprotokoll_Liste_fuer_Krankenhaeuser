import { test, expect } from "@playwright/test";
import { TEXT } from "../lib/constants";

test("Offline: App bleibt nutzbar und Daten bleiben lokal erhalten", async ({ page, context }) => {
  // 1: Zuerst online oeffnen.
  await page.goto("/");

  // 2: Warten, bis der Service Worker aktiv ist und die Seite kontrolliert.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
    timeout: 30_000,
  });

  // 3: Fiktive Daten eingeben und speichern lassen.
  await page.getByTestId("input-patientName").fill("Erika Musterfrau");
  await expect(page.getByTestId("status-patientName")).toHaveText(TEXT.fieldSaved, {
    timeout: 8000,
  });

  // 4: Kontext offline schalten -> der Offline-Hinweis erscheint.
  await context.setOffline(true);
  await expect(page.getByTestId("offline-banner")).toBeVisible();
  await expect(page.getByTestId("offline-banner")).toHaveText(TEXT.offline);

  // Anforderung: Ist die Verbindung wieder vorhanden, verschwindet der Hinweis.
  await context.setOffline(false);
  await expect(page.getByTestId("offline-banner")).toHaveCount(0);

  // Erneut offline schalten fuer den eigentlichen Offline-Reload-Test.
  await context.setOffline(true);
  await expect(page.getByTestId("offline-banner")).toBeVisible();

  // 5-6: Seite offline neu laden -> App laedt weiterhin aus dem Service-Worker-Cache.
  await page.reload();
  await expect(page.getByRole("heading", { name: TEXT.pageTitle })).toBeVisible();

  // 7: Gespeicherte Daten weiterhin sichtbar.
  await expect(page.getByTestId("input-patientName")).toHaveValue("Erika Musterfrau");

  // 8: Offline einen Wert aendern -> wird lokal gespeichert.
  await page.getByTestId("input-patientName").fill("Erika Beispiel");
  await expect(page.getByTestId("status-patientName")).toHaveText(TEXT.fieldSaved, {
    timeout: 8000,
  });

  // 9-10: Erneut (offline) neu laden -> die offline geaenderten Daten bleiben erhalten.
  await page.reload();
  await expect(page.getByTestId("input-patientName")).toHaveValue("Erika Beispiel");

  await context.setOffline(false);
});
