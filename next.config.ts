import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

// Serwist erzeugt beim Produktions-Build (webpack) den Service Worker aus app/sw.ts
// und legt ihn als public/sw.js ab. Der Worker wird automatisch registriert.
const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Automatische Registrierung ist Standard (register: true).
  reloadOnOnline: false,
  cacheOnNavigation: true,
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

// Im Entwicklungsmodus (Turbopack) ohne Serwist-Webpack-Plugin arbeiten;
// fuer den Produktions-Build (npm run build --webpack) mit Serwist umschliessen.
const isDev = process.env.NODE_ENV === "development";

export default isDev ? nextConfig : withSerwist(nextConfig);
