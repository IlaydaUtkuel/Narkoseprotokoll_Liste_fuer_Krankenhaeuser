import type { PatientBaseData } from "../types/patient";
import type { PersistedCase } from "../types/vitals";

export const OP_WORKFLOW_STORAGE_KEY = "sikant-op-workflow:v1";

export interface BasisEditSession {
  originalBasisData: PatientBaseData;
  draftBasisData: PatientBaseData;
  source: "timeline" | "direct-edit";
}

export interface OpWorkflowState {
  basisEditSession: BasisEditSession | null;
  pendingAfterSaveAction: "start-new-case" | null;
}

const EMPTY_WORKFLOW: OpWorkflowState = {
  basisEditSession: null,
  pendingAfterSaveAction: null,
};

let memoryBasisEditSession: BasisEditSession | null = null;

function storage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

export function hasActiveDocumentation(caseData: Pick<PersistedCase, "startedAt" | "endedAt" | "measurements" | "medications" | "infusions" | "events"> | null): boolean {
  return Boolean(caseData && (
    caseData.startedAt !== null ||
    caseData.endedAt !== null ||
    caseData.measurements.length > 0 ||
    caseData.medications.length > 0 ||
    caseData.infusions.length > 0 ||
    caseData.events.length > 0
  ));
}

export function hasUnexportedChanges(caseData: Pick<PersistedCase, "caseRevision" | "lastSuccessfullyExportedRevision">): boolean {
  return caseData.caseRevision !== caseData.lastSuccessfullyExportedRevision;
}

export function loadOpWorkflow(): OpWorkflowState {
  try {
    const raw = storage()?.getItem(OP_WORKFLOW_STORAGE_KEY);
    if (!raw) return { ...EMPTY_WORKFLOW, basisEditSession: memoryBasisEditSession };
    const parsed = JSON.parse(raw) as Partial<OpWorkflowState>;
    return {
      basisEditSession: memoryBasisEditSession,
      pendingAfterSaveAction: parsed.pendingAfterSaveAction === "start-new-case" ? "start-new-case" : null,
    };
  } catch {
    return { ...EMPTY_WORKFLOW, basisEditSession: memoryBasisEditSession };
  }
}

export function saveOpWorkflow(next: OpWorkflowState): void {
  memoryBasisEditSession = next.basisEditSession;
  storage()?.setItem(OP_WORKFLOW_STORAGE_KEY, JSON.stringify({ pendingAfterSaveAction: next.pendingAfterSaveAction }));
}

export function startBasisEditSession(
  basisData: PatientBaseData,
  source: BasisEditSession["source"],
  initialPatch: Partial<PatientBaseData> = {},
): BasisEditSession {
  const session: BasisEditSession = {
    originalBasisData: structuredClone(basisData),
    draftBasisData: { ...structuredClone(basisData), ...initialPatch },
    source,
  };
  saveOpWorkflow({ ...loadOpWorkflow(), basisEditSession: session });
  return session;
}

export function updateBasisEditDraft(draftBasisData: PatientBaseData): void {
  const workflow = loadOpWorkflow();
  if (!workflow.basisEditSession) return;
  saveOpWorkflow({
    ...workflow,
    basisEditSession: { ...workflow.basisEditSession, draftBasisData: structuredClone(draftBasisData) },
  });
}

export function discardBasisEditSession(): void {
  saveOpWorkflow({ ...loadOpWorkflow(), basisEditSession: null });
}

export function setPendingAfterSaveAction(action: OpWorkflowState["pendingAfterSaveAction"]): void {
  saveOpWorkflow({ ...loadOpWorkflow(), pendingAfterSaveAction: action });
}

export function clearOpWorkflow(): void {
  memoryBasisEditSession = null;
  try { storage()?.removeItem(OP_WORKFLOW_STORAGE_KEY); } catch { /* best effort */ }
}

export function basisDataChanged(session: BasisEditSession): boolean {
  return JSON.stringify(session.originalBasisData) !== JSON.stringify(session.draftBasisData);
}
