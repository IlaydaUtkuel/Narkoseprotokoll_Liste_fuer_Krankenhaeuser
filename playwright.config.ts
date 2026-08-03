import { defineConfig } from "@playwright/test";

// Die E2E-Tests laufen gegen den Produktions-Build (npm run build), damit der
// Service Worker aktiv ist. Der Build muss vor "npm run test:e2e" erfolgen.
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    actionTimeout: 15_000,
    // Erfolgreiche Standardlaeufe erzeugen keine Artefaktflut; Videos werden nur
    // bei Fehlern behalten.
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium", viewport: { width: 1280, height: 800 } },
    },
    {
      // iPad-naher Viewport (Hochformat) inkl. Touch. Eigentlich als WebKit-Projekt
      // gedacht; auf diesem Windows-Host laesst sich WebKit nicht starten
      // ("Host system is missing dependencies"), daher hier die Chromium-Engine.
      // Siehe README (Bekannte Einschraenkungen).
      name: "ipad-viewport",
      use: {
        browserName: "chromium",
        viewport: { width: 810, height: 1080 },
        deviceScaleFactor: 2,
        isMobile: false,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
