import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App, Button, ConfigProvider, Modal } from "antd";
import { useNewOperationFlow } from "@/components/useNewOperationFlow";
import { createEmptyPatientData } from "@/lib/constants";
import { loadPatientData, savePatientData } from "@/lib/patient-storage";
import { clearOpWorkflow, loadOpWorkflow } from "@/lib/opWorkflow";
import { loadCase, saveCase } from "@/lib/timeline/casePersistence";
import { CASE_SCHEMA_VERSION } from "@/lib/timeline/config";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));

function Trigger() {
  const request = useNewOperationFlow();
  return <Button onClick={request}>Neue OP</Button>;
}

function seed(endedAt: number | null, exportedRevision: number | null = null) {
  savePatientData({ ...createEmptyPatientData(), patientName: "Noch aktiv" });
  saveCase({
    schemaVersion: CASE_SCHEMA_VERSION,
    caseId: "new-op-case",
    caseRevision: 4,
    lastSuccessfullyExportedRevision: exportedRevision,
    startedAt: 1_000,
    endedAt,
    measurements: [{ id: "v", kind: "heartRate", value: 70, time: 1_000, createdAt: 1_000, updatedAt: 1_000 }],
    medications: [],
    infusions: [],
    events: [],
    lastSavedAt: 1_000,
  });
}

function renderTrigger() {
  return render(<ConfigProvider><App><Trigger /></App></ConfigProvider>);
}

async function activeDialog(): Promise<HTMLElement> {
  return waitFor(() => {
    const dialogs = [...document.querySelectorAll<HTMLElement>(".ant-modal:not(.ant-zoom-leave)")];
    const dialog = dialogs.at(-1);
    if (!dialog) throw new Error("Aktiver Dialog fehlt");
    return dialog;
  });
}

describe("Neue-OP-Schutzfluss", () => {
  beforeEach(() => {
    document.querySelectorAll(".ant-modal-root").forEach((item) => item.remove());
    localStorage.clear(); clearOpWorkflow(); push.mockClear(); replace.mockClear();
  });
  afterEach(() => {
    Modal.destroyAll();
    document.querySelectorAll(".ant-modal-root").forEach((item) => item.remove());
  });

  it("warnt bei unexportierter OP und löscht beim Abbrechen nichts", async () => {
    seed(2_000);
    renderTrigger();
    await userEvent.click(screen.getByRole("button", { name: "Neue OP" }));
    expect(within(await activeDialog()).getAllByText("Aktuellen OP-Fall zuerst speichern").length).toBeGreaterThan(0);
    await userEvent.click(within(await activeDialog()).getByRole("button", { name: "Abbrechen" }));
    expect(loadCase()).toMatchObject({ status: "ok", data: { caseId: "new-op-case", measurements: [{ id: "v" }] } });
    expect(loadPatientData()?.patientName).toBe("Noch aktiv");
  });

  it("fordert bei laufender OP nach dem Save-Hinweis zuerst die bestehende Endbestätigung", async () => {
    seed(null);
    renderTrigger();
    await userEvent.click(screen.getByRole("button", { name: "Neue OP" }));
    await userEvent.click(within(await activeDialog()).getByRole("button", { name: "Aktuellen Fall prüfen und speichern" }));
    await waitFor(() => expect([...document.querySelectorAll<HTMLElement>(".ant-modal:not(.ant-zoom-leave)")].some((item) => item.textContent?.includes("Eingriff beenden?"))).toBe(true));
    const endDialog = [...document.querySelectorAll<HTMLElement>(".ant-modal:not(.ant-zoom-leave)")].find((item) => item.textContent?.includes("Eingriff beenden?"))!;
    expect(within(endDialog).getAllByText("Eingriff beenden?").length).toBeGreaterThan(0);
    expect(loadCase()).toMatchObject({ status: "ok", data: { endedAt: null } });
    await userEvent.click(within(endDialog).getByRole("button", { name: "Abbrechen" }));
    expect(loadOpWorkflow().pendingAfterSaveAction).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it("leitet einen bereits beendeten Fall mit Pending-Aktion zur Kontrolle", async () => {
    seed(2_000);
    renderTrigger();
    await userEvent.click(screen.getByRole("button", { name: "Neue OP" }));
    await userEvent.click(within(await activeDialog()).getByRole("button", { name: "Aktuellen Fall prüfen und speichern" }));
    expect(loadOpWorkflow().pendingAfterSaveAction).toBe("start-new-case");
    expect(push).toHaveBeenCalledWith("/abschluss");
    expect(loadCase().status).toBe("ok");
  });

  it("löscht einen aktuell exportierten Fall erst nach eigener Bestätigung", async () => {
    seed(2_000, 4);
    renderTrigger();
    await userEvent.click(screen.getByRole("button", { name: "Neue OP" }));
    expect(within(await activeDialog()).getByText("Der aktuelle OP-Fall wurde bereits gespeichert. Möchten Sie jetzt eine neue OP beginnen?")).toBeInTheDocument();
    expect(loadCase().status).toBe("ok");
    await userEvent.click(within(await activeDialog()).getByRole("button", { name: "Neue OP beginnen" }));
    expect(loadCase().status).toBe("empty");
    expect(loadPatientData()).toBeNull();
    expect(replace).toHaveBeenCalledWith("/");
  });
});
