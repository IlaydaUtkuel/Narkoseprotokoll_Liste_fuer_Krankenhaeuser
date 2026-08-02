import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App, ConfigProvider } from "antd";
import { CaseHeader } from "@/components/vitals/CaseHeader";
import { createEmptyPatientData } from "@/lib/constants";
import { clearOpWorkflow, loadOpWorkflow } from "@/lib/opWorkflow";
import { saveCase } from "@/lib/timeline/casePersistence";
import { CASE_SCHEMA_VERSION } from "@/lib/timeline/config";
import { useCaseStore } from "@/store/anesthesiaCaseStore";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const patient = { ...createEmptyPatientData(), patientName: "Bestehender Patient", procedure: "Bestehende OP" };

function renderHeader() {
  return render(<ConfigProvider><App><CaseHeader patient={patient} /></App></ConfigProvider>);
}

describe("Zurück zu den Basisdaten", () => {
  beforeEach(() => {
    localStorage.clear();
    clearOpWorkflow();
    push.mockClear();
    useCaseStore.setState({ hydrated: true, startedAt: 1_000, endedAt: null, measurements: [], medications: [], infusions: [], events: [] });
    saveCase({ schemaVersion: CASE_SCHEMA_VERSION, caseId: "header-case", caseRevision: 1, lastSuccessfullyExportedRevision: null, startedAt: 1_000, endedAt: null, measurements: [], medications: [], infusions: [], events: [], lastSavedAt: 1_000 });
  });

  it("wechselt nicht direkt die Route und zeigt die verknüpften Daten", async () => {
    renderHeader();
    await userEvent.click(screen.getByTestId("back-basisdaten"));
    expect(push).not.toHaveBeenCalled();
    expect(await screen.findByText("Basisdaten dieses OP-Falls bearbeiten?")).toBeInTheDocument();
    expect(screen.getAllByText("Bestehender Patient").length).toBeGreaterThan(0);
  });

  it("startet erst nach Ja eine Timeline-Edit-Session", async () => {
    renderHeader();
    await userEvent.click(screen.getByTestId("back-basisdaten"));
    await userEvent.click(await screen.findByTestId("confirm-edit-basis"));
    expect(loadOpWorkflow().basisEditSession).toMatchObject({ source: "timeline", originalBasisData: { patientName: "Bestehender Patient" } });
    expect(push).toHaveBeenCalledWith("/");
  });

  it("bleibt bei Abbrechen auf der Timeline und verändert keinen State", async () => {
    renderHeader();
    await userEvent.click(screen.getByTestId("back-basisdaten"));
    await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(push).not.toHaveBeenCalled();
    expect(loadOpWorkflow().basisEditSession).toBeNull();
    expect(useCaseStore.getState().startedAt).toBe(1_000);
  });
});
