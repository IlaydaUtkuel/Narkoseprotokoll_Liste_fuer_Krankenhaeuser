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

  it("legt ein NiBP zuerst nur mit dem Mittelwert an", async () => {
    const user = userEvent.setup();
    const time = Date.now();
    renderDrawer({ mode: "create-nibp", time, mean: 90 });

    const mean = await screen.findByTestId("entry-mean");
    expect(screen.queryByTestId("entry-systolic")).not.toBeInTheDocument();
    expect(screen.queryByTestId("entry-diastolic")).not.toBeInTheDocument();
    await user.clear(mean);
    await user.type(screen.getByTestId("entry-mean"), "90");
    await user.click(screen.getByTestId("entry-save"));

    const measurements = useCaseStore.getState().measurements;
    expect(measurements).toHaveLength(1);
    expect(measurements[0]).toMatchObject({ kind: "nibp", systolic: null, mean: 90, diastolic: null });
  });

  it("erlaubt Systolisch und Diastolisch im Bearbeitungsformular direkt einzugeben", async () => {
    const user = userEvent.setup();
    const time = Date.now();
    useCaseStore.setState({
      measurements: [{
        id: "nibp-edit",
        kind: "nibp",
        time,
        systolic: null,
        mean: 90,
        diastolic: null,
        createdAt: time,
        updatedAt: time,
      }],
    });
    renderDrawer({
      mode: "edit-nibp",
      id: "nibp-edit",
      time,
      systolic: null,
      mean: 90,
      diastolic: null,
      focusPart: "systolic",
    });

    await user.type(await screen.findByTestId("entry-systolic"), "130");
    await user.type(screen.getByTestId("entry-diastolic"), "70");
    await user.click(screen.getByTestId("entry-save"));

    expect(useCaseStore.getState().measurements[0]).toMatchObject({
      kind: "nibp",
      systolic: 130,
      mean: 90,
      diastolic: 70,
    });
  });

  it("zeigt Temperatur als direkt auswählbaren Picker ohne Spinbutton", async () => {
    renderDrawer({ mode: "create-scalar", kind: "temperature", time: Date.now(), value: 36.7 });
    const picker = await screen.findByRole("combobox", { name: "Temperatur auswählen" });
    expect(picker).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("spinbutton", { name: /Temperatur/ })).not.toBeInTheDocument();
  });
});
