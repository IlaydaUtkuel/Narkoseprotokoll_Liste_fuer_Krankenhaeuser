import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Nach jedem Test das gerenderte DOM aufraeumen.
afterEach(() => {
  cleanup();
});

// jsdom-Polyfills, die Ant Design zur Laufzeit erwartet.
if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    // Minimaler matchMedia-Ersatz.
    window.matchMedia = (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList;
  }

  if (!("ResizeObserver" in window)) {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (window as unknown as { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver =
      ResizeObserverMock;
  }
}
