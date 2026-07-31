import { test, expect } from "@playwright/test";
import { TEXT } from "../lib/constants";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("sofortige Speicherung: auch der letzte Buchstabe bleibt ohne Wartezeit erhalten", async ({
  page,
}) => {
  await page.getByTestId("input-patientName").pressSequentially("Anna Musterm", { delay: 20 });
  // Ohne 2,5 Sekunden zu warten sofort neu laden.
  await page.reload();
  await expect(page.getByTestId("input-patientName")).toHaveValue("Anna Musterm");
});

test("Gewichtseinheit kg/lbs wird gespeichert", async ({ page }) => {
  const field = page.getByTestId("field-bodyWeightKg");
  // Standardwert kg.
  await expect(field).toContainText("kg");

  await field.getByRole("combobox").click();
  await page.locator('.ant-select-item-option[title="lbs"]').click();
  await expect(field).toContainText("lbs");

  await page.reload();
  await expect(page.getByTestId("field-bodyWeightKg")).toContainText("lbs");
});

test("Branding 'sikant Med' erscheint auf allen Routen", async ({ page }) => {
  await expect(page.getByTestId("brand-mark")).toBeVisible();
  await expect(page.getByTestId("brand-mark")).toHaveText("sikant Med");

  await page.goto("/dokumentation");
  await expect(page.getByTestId("brand-mark")).toBeVisible();
  await expect(page.getByTestId("brand-mark")).toHaveText("sikant Med");
});

test("Gesamter Speicherstatus ist ein reiner Status ohne Rahmen/Button-Optik", async ({ page }) => {
  const status = page.getByTestId("global-status");
  await expect(status).toBeVisible();
  await expect(status).toHaveText(TEXT.globalSaved);

  const style = await status.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName,
      cursor: cs.cursor,
      borderTopWidth: cs.borderTopWidth,
      borderTopStyle: cs.borderTopStyle,
      boxShadow: cs.boxShadow,
    };
  });
  expect(style.tag).toBe("DIV");
  expect(style.cursor).not.toBe("pointer");
  expect(style.borderTopWidth === "0px" || style.borderTopStyle === "none").toBe(true);
  expect(style.boxShadow).toBe("none");
});
