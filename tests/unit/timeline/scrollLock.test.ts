import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isBodyScrollLocked,
  lockBodyScroll,
  resetBodyScrollLockForTests,
  unlockBodyScroll,
} from "@/lib/timeline/scrollLock";

afterEach(() => {
  resetBodyScrollLockForTests();
  document.body.style.overflow = "";
  document.body.style.overscrollBehavior = "";
});

describe("scrollLock", () => {
  it("sperrt beim Start der Interaktion und gibt bei Ende frei", () => {
    expect(isBodyScrollLocked()).toBe(false);
    lockBodyScroll();
    expect(isBodyScrollLocked()).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.dataset.timelineScrollLock).toBe("true");
    unlockBodyScroll();
    expect(isBodyScrollLocked()).toBe(false);
    expect(document.body.dataset.timelineScrollLock).toBeUndefined();
  });

  it("stellt die vorherige Scroll-Position wieder her", () => {
    Object.defineProperty(window, "scrollY", { value: 240, configurable: true });
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    lockBodyScroll();
    unlockBodyScroll();
    expect(scrollTo).toHaveBeenCalledWith(0, 240);
    scrollTo.mockRestore();
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });

  it("stellt eine zuvor gesetzte overflow-Angabe wieder her", () => {
    document.body.style.overflow = "auto";
    lockBodyScroll();
    expect(document.body.style.overflow).toBe("hidden");
    unlockBodyScroll();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("zaehlt verschachtelte Sperren korrekt (Reference-Counting)", () => {
    lockBodyScroll();
    lockBodyScroll();
    expect(isBodyScrollLocked()).toBe(true);
    unlockBodyScroll();
    expect(isBodyScrollLocked()).toBe(true);
    unlockBodyScroll();
    expect(isBodyScrollLocked()).toBe(false);
  });
});
