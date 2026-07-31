import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App, ConfigProvider } from "antd";
import { VitalEntryDrawer } from "@/components/vitals/VitalEntryDrawer";
import { useCaseStore } from "@/store/anesthesiaCaseStore";
import type { EntryDraft } from "@/components/vitals/timelineTypes";

function resetStore() {
  useCaseStore.setState({
    hydrated: true,
    loadError: false,
    startedAt: Date.now(),
    measurements: [],
    saveStatus: "idle",
    lastSavedAt: null,
  });
}

function renderDrawer(draft: EntryDraft | null, onClose = () => {}) {
  return render(
    <ConfigProvider>
      <App>
        <VitalEntryDrawer draft={draft} onClose={onClose} />
      </App>
    </ConfigProvider>,
  );
}

describe("VitalEntryDrawer", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetStore();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it("speichert einen neuen skalaren Wert (vorbelegt aus dem Pointer) ueber das Formular", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const time = Date.now();
    renderDrawer({ mode: "create-scalar", kind: "spo2", time, value: 95 }, onClose);

    expect(await screen.findByTestId("entry-value")).toBeInTheDocument();
    await user.click(screen.getByTestId("entry-save"));

    const measurements = useCaseStore.getState().measurements;
    expect(measurements).toHaveLength(1);
    expect(measurements[0]).toMatchObject({ kind: "spo2", value: 95, time });
    expect(onClose).toHaveBeenCalled();
  });

  it("legt ein NiBP mit drei Werten an", async () => {
    const user = userEvent.setup();
    const time = Date.now();
    renderDrawer({ mode: "create-nibp", time });

    const sys = await screen.findByTestId("entry-systolic");
    await user.click(sys);
    await user.keyboard("120");
    await user.click(screen.getByTestId("entry-mean"));
    await user.keyboard("90");
    await user.click(screen.getByTestId("entry-diastolic"));
    await user.keyboard("70");
    await user.click(screen.getByTestId("entry-save"));

    const measurements = useCaseStore.getState().measurements;
    expect(measurements).toHaveLength(1);
    expect(measurements[0]).toMatchObject({ kind: "nibp", systolic: 120, mean: 90, diastolic: 70 });
  });
});
