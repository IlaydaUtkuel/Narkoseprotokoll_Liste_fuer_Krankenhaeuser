import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App, ConfigProvider } from "antd";
import { RemoveAllData } from "@/components/RemoveAllData";
import { STORAGE_KEY, TEXT } from "@/lib/constants";

function renderRemove(onRemoved: () => void = () => {}) {
  return render(
    <ConfigProvider>
      <App>
        <RemoveAllData onRemoved={onRemoved} />
      </App>
    </ConfigProvider>,
  );
}

describe("RemoveAllData", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ patientName: "Test" }));
  });

  it("oeffnet einen Bestaetigungsdialog und loescht dabei noch nichts", async () => {
    const user = userEvent.setup();
    const onRemoved = vi.fn();
    renderRemove(onRemoved);

    await user.click(screen.getByTestId("remove-all"));
    expect(await screen.findByText(TEXT.removeConfirmTitle)).toBeInTheDocument();

    // Vor der Bestaetigung darf nichts geloescht sein.
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(onRemoved).not.toHaveBeenCalled();
  });

  it("behaelt die Daten, wenn der Dialog abgebrochen wird", async () => {
    const user = userEvent.setup();
    const onRemoved = vi.fn();
    renderRemove(onRemoved);

    await user.click(screen.getByTestId("remove-all"));
    await screen.findByText(TEXT.removeConfirmTitle);
    await user.click(screen.getByRole("button", { name: TEXT.removeConfirmCancel }));

    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(onRemoved).not.toHaveBeenCalled();
  });

  it("loescht den Speicherwert erst nach ausdruecklicher Bestaetigung", async () => {
    const user = userEvent.setup();
    const onRemoved = vi.fn();
    renderRemove(onRemoved);

    await user.click(screen.getByTestId("remove-all"));
    await screen.findByText(TEXT.removeConfirmTitle);
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    await user.click(screen.getByRole("button", { name: TEXT.removeConfirmOk }));

    await waitFor(() => {
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
    expect(onRemoved).toHaveBeenCalledTimes(1);
  });
});
