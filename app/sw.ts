/// <reference lib="webworker" />

// Service Worker auf Basis von Serwist. Diese Datei wird beim Produktions-Build
// separat gebuendelt (nicht vom App-Router als Route behandelt) und ist in
// tsconfig.json von der Typpruefung ausgenommen.
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Wird von Serwist beim Build mit der Precache-Liste befuellt.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
