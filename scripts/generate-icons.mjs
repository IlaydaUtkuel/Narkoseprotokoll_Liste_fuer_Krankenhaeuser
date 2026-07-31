// Erzeugt neutrale, selbst erstellte App-Icons (kein reales Logo, keine Patientendaten).
// Motiv: ruhige gruene Flaeche mit einer weissen EKG-/Herzschlag-Linie.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

const BG = "#1f7a63";

function svg({ size, rounded, padded }) {
  const radius = rounded ? Math.round(size * 0.18) : 0;
  const pad = padded ? size * 0.2 : size * 0.14; // Sicherheitsabstand (u.a. maskable)
  const midY = size * 0.5;
  const x0 = pad;
  const x1 = size - pad;
  const w = x1 - x0;
  // Einfache Herzschlag-Polyline, zentriert.
  const points = [
    [x0, midY],
    [x0 + w * 0.26, midY],
    [x0 + w * 0.36, midY - size * 0.17],
    [x0 + w * 0.46, midY + size * 0.21],
    [x0 + w * 0.56, midY],
    [x1, midY],
  ]
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const stroke = Math.max(2, size * 0.05);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="${BG}"/>
    <polyline points="${points}" fill="none" stroke="#ffffff" stroke-width="${stroke.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

async function render(name, size, opts) {
  const buffer = Buffer.from(svg({ size, ...opts }));
  await sharp(buffer).png().toFile(join(outDir, name));
  console.log("Icon erzeugt:", name);
}

await render("icon-192.png", 192, { rounded: true, padded: false });
await render("icon-512.png", 512, { rounded: true, padded: false });
await render("icon-maskable-512.png", 512, { rounded: false, padded: true });
await render("apple-touch-icon.png", 180, { rounded: false, padded: false });

console.log("Alle Icons erzeugt in", outDir);
