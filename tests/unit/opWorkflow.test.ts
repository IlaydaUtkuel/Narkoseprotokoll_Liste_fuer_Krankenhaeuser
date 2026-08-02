import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyPatientData } from "@/lib/constants";
import {
  OP_WORKFLOW_STORAGE_KEY,
  basisDataChanged,
  clearOpWorkflow,
  discardBasisEditSession,
  hasActiveDocumentation,
  hasUnexportedChanges,
  loadOpWorkflow,
  setPendingAfterSaveAction,
  startBasisEditSession,
  updateBasisEditDraft,
} from "@/lib/opWorkflow";

describe("OP-Workflow und Basisdaten-Draft", () => {
  beforeEach(() => { localStorage.clear(); clearOpWorkflow(); });
  afterEach(() => { localStorage.clear(); clearOpWorkflow(); });

  it("erkennt jede Form aktiver OP-Dokumentation", () => {
    const empty = { startedAt: null, endedAt: null, measurements: [], medications: [], infusions: [], events: [] };
    expect(hasActiveDocumentation(empty)).toBe(false);
    expect(hasActiveDocumentation({ ...empty, startedAt: 1 })).toBe(true);
    expect(hasActiveDocumentation({ ...empty, endedAt: 2 })).toBe(true);
    expect(hasActiveDocumentation({ ...empty, measurements: [{} as never] })).toBe(true);
    expect(hasActiveDocumentation({ ...empty, medications: [{} as never] })).toBe(true);
    expect(hasActiveDocumentation({ ...empty, infusions: [{} as never] })).toBe(true);
    expect(hasActiveDocumentation({ ...empty, events: [{} as never] })).toBe(true);
  });

  it("startet einen vollständigen Draft mit dem ersten Änderungsversuch", () => {
    const original = { ...createEmptyPatientData(), patientName: "Alt" };
    const session = startBasisEditSession(original, "direct-edit", { patientName: "Neu" });
    expect(session).toMatchObject({ source: "direct-edit", originalBasisData: { patientName: "Alt" }, draftBasisData: { patientName: "Neu" } });
    expect(loadOpWorkflow().basisEditSession).toEqual(session);
  });

  it("ändert im Draft nie das Originalobjekt", () => {
    const original = { ...createEmptyPatientData(), procedure: "Alt" };
    const session = startBasisEditSession(original, "timeline");
    updateBasisEditDraft({ ...session.draftBasisData, procedure: "Neu" });
    expect(original.procedure).toBe("Alt");
    expect(loadOpWorkflow().basisEditSession?.draftBasisData.procedure).toBe("Neu");
  });

  it("verwirft den Draft vollständig", () => {
    startBasisEditSession(createEmptyPatientData(), "timeline", { patientName: "Temporär" });
    discardBasisEditSession();
    expect(loadOpWorkflow().basisEditSession).toBeNull();
  });

  it("persistiert temporäre Basisdaten ausdrücklich nicht in localStorage", () => {
    startBasisEditSession(createEmptyPatientData(), "timeline", { patientName: "Nicht persistieren" });
    expect(localStorage.getItem(OP_WORKFLOW_STORAGE_KEY)).not.toContain("Nicht persistieren");
  });

  it("erkennt unveränderte und veränderte Drafts", () => {
    const original = createEmptyPatientData();
    expect(basisDataChanged(startBasisEditSession(original, "timeline"))).toBe(false);
    expect(basisDataChanged(startBasisEditSession(original, "timeline", { procedure: "OP" }))).toBe(true);
  });

  it("bewahrt die beabsichtigte Aktion für den Abschluss-Tab", () => {
    setPendingAfterSaveAction("start-new-case");
    expect(loadOpWorkflow().pendingAfterSaveAction).toBe("start-new-case");
    setPendingAfterSaveAction(null);
    expect(loadOpWorkflow().pendingAfterSaveAction).toBeNull();
  });

  it("bewertet nur gleiche Export- und Fallrevision als aktuell gespeichert", () => {
    expect(hasUnexportedChanges({ caseRevision: 4, lastSuccessfullyExportedRevision: 4 })).toBe(false);
    expect(hasUnexportedChanges({ caseRevision: 5, lastSuccessfullyExportedRevision: 4 })).toBe(true);
    expect(hasUnexportedChanges({ caseRevision: 0, lastSuccessfullyExportedRevision: null })).toBe(true);
  });
});
