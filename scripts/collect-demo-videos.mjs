// Kopiert die Videos eines Demo-Laufs aus der Playwright-Rohausgabe in den
// versionierten Ordner docs/videos. Nur die hier gelisteten Aufnahmen werden
// ausgeliefert; demo-artifacts/ bleibt ueber .gitignore ausserhalb von Git.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SOURCE = "demo-artifacts";
const TARGET = join("docs", "videos");

const VIDEOS = [
  { prefix: "narkoseprotokoll-demo-", file: "00-gesamtablauf.webm" },
  { prefix: "01-basisdaten-vitalwerte-", file: "01-basisdaten-vitalwerte-persistence.webm" },
  { prefix: "02-therapien-ereignisse-", file: "02-therapien-ereignisse-bearbeiten.webm" },
  { prefix: "03-abschluss-export-", file: "03-abschluss-kontrolle-export.webm" },
];

if (!existsSync(SOURCE)) {
  console.error(`Keine Playwright-Ausgabe unter "${SOURCE}" gefunden. Zuerst einen Demo-Lauf ausfuehren.`);
  process.exit(1);
}
mkdirSync(TARGET, { recursive: true });

const runDirectories = readdirSync(SOURCE).filter((entry) => statSync(join(SOURCE, entry)).isDirectory());
let copied = 0;

for (const { prefix, file } of VIDEOS) {
  const directory = runDirectories.find((entry) => entry.startsWith(prefix));
  if (!directory) continue;
  const source = join(SOURCE, directory, "video.webm");
  if (!existsSync(source)) {
    console.error(`Lauf "${directory}" enthaelt kein video.webm.`);
    process.exit(1);
  }
  const target = join(TARGET, file);
  copyFileSync(source, target);
  const { size } = statSync(target);
  if (size === 0) {
    console.error(`Kopiertes Video ist leer: ${target}`);
    process.exit(1);
  }
  console.log(`${target} (${(size / 1024 / 1024).toFixed(1)} MiB)`);
  copied += 1;
}

if (copied === 0) {
  console.error("Kein passendes Demo-Video gefunden.");
  process.exit(1);
}
