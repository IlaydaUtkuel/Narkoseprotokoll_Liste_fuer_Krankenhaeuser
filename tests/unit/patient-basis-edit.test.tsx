import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App, ConfigProvider, Modal } from "antd";
import { PatientBaseDataForm } from "@/components/PatientBaseDataForm";
import { createEmptyPatientData } from "@/lib/constants";
import { loadPatientData, savePatientData } from "@/lib/patient-storage";
import { clearOpWorkflow } from "@/lib/opWorkflow";
import { loadCase, saveCase } from "@/lib/timeline/casePersistence";
import { CASE_SCHEMA_VERSION } from "@/lib/timeline/config";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));

const START = new Date(2026, 7, 2, 10, 0, 0).getTime();
const patient = { ...createEmptyPatientData(), patientName: "Alt Patient", procedure: "Alt OP", birthDate: "01.01.1980", operationDate: "02.08.2026" };

function activeCase() {
  saveCase({
    schemaVersion: CASE_SCHEMA_VERSION,
    caseId: "basis-edit-case",
    caseRevision: 3,
    lastSuccessfullyExportedRevision: null,
    startedAt: START,
    endedAt: null,
    measurements: [{ id: "m", kind: "heartRate", time: START, value: 70, createdAt: START, updatedAt: START }],
    medications: [],
    infusions: [],
    events: [],
    lastSavedAt: START,
  });
}

function renderForm() {
  return render(<ConfigProvider><App><PatientBaseDataForm /></App></ConfigProvider>);
}

describe("sichere Basisdaten-Korrektur", () => {
  beforeEach(() => {
    localStorage.clear();
    clearOpWorkflow();
    push.mockClear();
    replace.mockClear();
    savePatientData(patient);
  });
  afterEach(() => Modal.destroyAll());

  it("speichert ohne aktive Dokumentation normal", async () => {
    renderForm();
    const input = await screen.findByTestId("input-patientName");
    fireEvent.change(input, { target: { value: "Normal geändert" } });
    // Namensteile beginnen automatisch gross (siehe formatPersonName).
    expect(loadPatientData()?.patientName).toBe("Normal Geändert");
    expect(document.querySelector(".ant-modal:not(.ant-zoom-leave)")).toBeNull();
  });

  it("öffnet bei aktiver Dokumentation zuerst das Modal und schreibt nicht", async () => {
    activeCase();
    renderForm();
    const input = await screen.findByTestId("input-patientName");
    fireEvent.change(input, { target: { value: "Neu Patient" } });
    expect(await screen.findByText("Basisdaten dieses OP-Falls ändern?")).toBeInTheDocument();
    expect(screen.getByText("Bisher mit der Dokumentation verknüpfte Basisdaten")).toBeInTheDocument();
    expect(screen.getAllByText("Alt Patient").length).toBeGreaterThan(0);
    expect(screen.getByTestId("basis-attempt-values")).toHaveTextContent("Neu Patient");
    expect(loadPatientData()?.patientName).toBe("Alt Patient");
  });

  it("startet nach Bestätigung einen Draft und öffnet bei Folgeänderung kein zweites Modal", async () => {
    activeCase();
    renderForm();
    fireEvent.change(await screen.findByTestId("input-patientName"), { target: { value: "Neu Patient" } });
    await userEvent.click(await screen.findByTestId("confirm-direct-basis-edit"));
    expect(screen.getByTestId("basis-edit-mode")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("input-procedure"), { target: { value: "Neu OP" } });
    expect(document.querySelector(".ant-modal:not(.ant-zoom-leave)")).toBeNull();
    expect(loadPatientData()).toMatchObject({ patientName: "Alt Patient", procedure: "Alt OP" });
  });

  it("verwirft den gesamten Draft und bewahrt aktive Dokumentation", async () => {
    activeCase();
    renderForm();
    fireEvent.change(await screen.findByTestId("input-patientName"), { target: { value: "Neu Patient" } });
    await userEvent.click(await screen.findByTestId("confirm-direct-basis-edit"));
    await userEvent.click(screen.getByTestId("discard-basis-edit"));
    expect(loadPatientData()?.patientName).toBe("Alt Patient");
    expect(loadCase()).toMatchObject({ status: "ok", data: { measurements: [{ id: "m" }], caseRevision: 3 } });
  });

  it("wendet den Draft atomar auf denselben Fall an und erhöht die Revision", async () => {
    activeCase();
    renderForm();
    fireEvent.change(await screen.findByTestId("input-patientName"), { target: { value: "Neu Patient" } });
    await userEvent.click(await screen.findByTestId("confirm-direct-basis-edit"));
    await userEvent.click(screen.getByTestId("apply-basis-edit"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dokumentation"));
    expect(loadPatientData()?.patientName).toBe("Neu Patient");
    expect(loadCase()).toMatchObject({ status: "ok", data: { measurements: [{ id: "m" }], caseRevision: 4 } });
  });

  it("behandelt das X des ersten Modals wie Abbrechen", async () => {
    activeCase();
    renderForm();
    fireEvent.change(await screen.findByTestId("input-patientName"), { target: { value: "Neu Patient" } });
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(dialog.querySelector(".ant-modal-close") as HTMLElement);
    expect(loadPatientData()?.patientName).toBe("Alt Patient");
    expect(screen.queryByTestId("basis-edit-mode")).not.toBeInTheDocument();
  });

  it("fordert bei Escape im geänderten Draft eine Verwerfbestätigung", async () => {
    activeCase();
    renderForm();
    fireEvent.change(await screen.findByTestId("input-patientName"), { target: { value: "Neu Patient" } });
    await userEvent.click(await screen.findByTestId("confirm-direct-basis-edit"));
    fireEvent.keyDown(window, { key: "Escape" });
    expect((await screen.findAllByText("Nicht übernommene Änderungen verwerfen?")).length).toBeGreaterThan(0);
    expect(loadPatientData()?.patientName).toBe("Alt Patient");
  });
});
