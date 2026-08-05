import { defineConfig } from "@playwright/test";

// Eigene Konfiguration ausschliesslich fuer das Demo-Video (e2e-demo/).
// Sie laeuft absichtlich getrennt von "npm run test:e2e": nur ein Projekt
// (kein iPad-Duplikat), Video immer an und eine sichtbare Verlangsamung,
// damit die Aufnahme fuer Menschen nachvollziehbar bleibt.
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  // Nur die Demoaufnahmen; die Standard-Suite unter ./e2e bleibt unberuehrt.
  testDir: "./e2e-demo",
  outputDir: "./demo-artifacts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Das Video laeuft bewusst langsam ab; das Zeitbudget ist entsprechend grosszuegig.
  timeout: 4 * 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    video: "on",
    trace: "retain-on-failure",
    actionTimeout: 20_000,
    launchOptions: {
      slowMo: 250,
    },
  },
  projects: [
    {
      name: "demo",
      use: { browserName: "chromium", viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
