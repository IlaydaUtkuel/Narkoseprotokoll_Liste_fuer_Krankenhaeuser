import { afterEach, describe, expect, it } from "vitest";
import { resetDrawerScrollTop } from "@/lib/timeline/drawerScroll";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("resetDrawerScrollTop", () => {
  it("setzt den Scroll-Container des passenden Drawers auf 0", () => {
    document.body.innerHTML = `
      <div class="vital-entry-drawer"><div class="ant-drawer-body"></div></div>
      <div class="therapy-entry-drawer"><div class="ant-drawer-body"></div></div>`;
    const vitalBody = document.querySelector(".vital-entry-drawer .ant-drawer-body") as HTMLElement;
    const therapyBody = document.querySelector(".therapy-entry-drawer .ant-drawer-body") as HTMLElement;
    vitalBody.scrollTop = 480;
    therapyBody.scrollTop = 480;

    resetDrawerScrollTop("vital-entry-drawer");
    expect(vitalBody.scrollTop).toBe(0);
    // Nur der adressierte Drawer wird zurückgesetzt.
    expect(therapyBody.scrollTop).toBe(480);

    resetDrawerScrollTop("therapy-entry-drawer");
    expect(therapyBody.scrollTop).toBe(0);
  });

  it("ist robust, wenn kein passender Drawer im DOM ist", () => {
    expect(() => resetDrawerScrollTop("vital-entry-drawer")).not.toThrow();
  });
});
