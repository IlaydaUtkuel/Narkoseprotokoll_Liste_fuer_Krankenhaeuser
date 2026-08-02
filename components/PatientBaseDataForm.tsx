"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Input, InputNumber, Modal, Select, Typography } from "antd";
import { AutosaveFieldStatus } from "./AutosaveFieldStatus";
import { DateField } from "./DateField";
import { GlobalSaveStatus } from "./GlobalSaveStatus";
import { OfflineStatus } from "./OfflineStatus";
import { RemoveAllData } from "./RemoveAllData";
import { useDebouncedFieldSave } from "../hooks/useDebouncedFieldSave";
import {
  loadPatientData,
  requestPersistentStorage,
  savePatientData,
} from "../lib/patient-storage";
import {
  ASA_OPTIONS,
  FIELD_LABELS,
  FIELD_ORDER,
  MALLAMPATI_OPTIONS,
  TEXT,
  WEIGHT_UNIT_OPTIONS,
  createEmptyPatientData,
} from "../lib/constants";
import {
  isBirthDateDisabled,
  isOpDateDisabled,
  localTodayDeDate,
  validateBirthDate,
  validateOpDate,
} from "../lib/date-utils";
import type {
  FieldSaveStatus,
  PatientBaseData,
  PatientField,
  WeightUnit,
} from "../types/patient";
import styles from "./PatientBaseDataForm.module.css";
import { noKnownAllergiesPatch } from "../lib/allergy-toggle";
import { BasisDataSummary } from "./BasisDataSummary";
import { loadCase, saveCase } from "../lib/timeline/casePersistence";
import { syncCriticalSettingsBirthDate } from "../lib/timeline/criticalSettingsStorage";
import {
  basisDataChanged,
  discardBasisEditSession,
  hasActiveDocumentation,
  loadOpWorkflow,
  startBasisEditSession,
  updateBasisEditDraft,
  type BasisEditSession,
} from "../lib/opWorkflow";
import { useCaseStore } from "../store/anesthesiaCaseStore";
import { useNewOperationFlow } from "./useNewOperationFlow";

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

interface FieldProps {
  name: PatientField;
  htmlFor: string;
  status?: FieldSaveStatus;
  error?: string | null;
  children: ReactNode;
}

// Einheitliches Layout: Beschriftung oben, Eingabefeld und Status in einer Zeile,
// darunter bei Bedarf eine kurze Fehlermeldung.
function Field({ name, htmlFor, status, error, children }: FieldProps) {
  return (
    <div className={styles.field} data-testid={`field-${name}`}>
      <label className={styles.label} htmlFor={htmlFor}>
        {FIELD_LABELS[name]}
      </label>
      <div className={styles.controlRow}>
        <div className={styles.controlWrap}>
          <div className={styles.control}>{children}</div>
          {error ? (
            <div className="field-error" role="alert" data-testid={`error-${name}`}>
              {error}
            </div>
          ) : null}
        </div>
        <AutosaveFieldStatus status={status} testId={`status-${name}`} />
      </div>
    </div>
  );
}

export function PatientBaseDataForm() {
  const router = useRouter();
  const requestNewOperation = useNewOperationFlow();
  const [data, setData] = useState<PatientBaseData>(() => createEmptyPatientData());
  const [editSession, setEditSession] = useState<BasisEditSession | null>(null);
  const editSessionRef = useRef<BasisEditSession | null>(null);
  const [attempt, setAttempt] = useState<{
    patch: Partial<PatientBaseData>;
    statusField: PatientField;
    oldValue: unknown;
    newValue: unknown;
  } | null>(null);

  // dataRef spiegelt stets den aktuellen Stand und dient als Quelle beim Speichern.
  const dataRef = useRef<PatientBaseData>(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  useEffect(() => {
    editSessionRef.current = editSession;
  }, [editSession]);

  const { statuses, reportSaving, reportError, markSaved, resetStatuses } = useDebouncedFieldSave();

  // Beim ersten Rendern (nur im Browser) gespeicherte Daten laden.
  useEffect(() => {
    void requestPersistentStorage();
    const stored = loadPatientData();
    const workflowSession = loadOpWorkflow().basisEditSession;
    if (workflowSession) {
      // localStorage/modül taslağı yalnızca mount sonrasında okunabilir.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditSession(workflowSession);
      setData(workflowSession.draftBasisData);
    } else if (stored) {
      // localStorage darf erst nach dem Mounten gelesen werden, sonst weicht der
      // Client-Zustand vom serverseitig gerenderten HTML ab (Hydration).
      setData(stored);
      const savedFields = FIELD_ORDER.filter((f) => hasValue(stored[f]));
      if (savedFields.length > 0) markSaved(savedFields);
    }
    // Nur einmal beim Mount ausfuehren.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Zusaetzliche Absicherung: den aktuellsten Stand beim Verlassen/Ausblenden schreiben.
  // Die Hauptspeicherung erfolgt jedoch sofort bei jeder Aenderung (siehe applyChange).
  useEffect(() => {
    const flush = () => {
      if (editSessionRef.current) return;
      try {
        savePatientData(dataRef.current);
      } catch {
        // Bewusst ignoriert – der Wert wurde bereits bei der Aenderung gespeichert.
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Wendet eine Aenderung an: aktualisiert den State und speichert SOFORT (synchron)
  // nach localStorage. Der Anzeige-Status ("Wird gespeichert …" -> "✓ Gespeichert")
  // laeuft davon unabhaengig ueber den Timer im Hook.
  const applyChange = useCallback(
    (patch: Partial<PatientBaseData>, statusField: PatientField) => {
      if (editSessionRef.current) {
        const nextDraft = { ...dataRef.current, ...patch };
        const nextSession = { ...editSessionRef.current, draftBasisData: nextDraft };
        dataRef.current = nextDraft;
        editSessionRef.current = nextSession;
        setData(nextDraft);
        setEditSession(nextSession);
        updateBasisEditDraft(nextDraft);
        return;
      }
      const loadedCase = loadCase();
      if (loadedCase.status === "ok" && hasActiveDocumentation(loadedCase.data)) {
        const changedKey = Object.keys(patch)[0] as keyof PatientBaseData;
        setAttempt({
          patch,
          statusField,
          oldValue: dataRef.current[changedKey],
          newValue: patch[changedKey],
        });
        return;
      }
      const next: PatientBaseData = {
        ...dataRef.current,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      dataRef.current = next;
      setData(next);
      try {
        savePatientData(next);
        reportSaving(statusField);
      } catch {
        reportError(statusField);
      }
    },
    [reportSaving, reportError],
  );

  const handleChange = useCallback(
    <K extends PatientField>(field: K, value: PatientBaseData[K]) => {
      applyChange({ [field]: value } as Partial<PatientBaseData>, field);
    },
    [applyChange],
  );

  const handleWeightUnit = useCallback(
    (unit: WeightUnit) => {
      applyChange({ weightUnit: unit }, "bodyWeightKg");
    },
    [applyChange],
  );

  const handleRemoved = useCallback(() => {
    setData(createEmptyPatientData());
    resetStatuses();
  }, [resetStatuses]);

  const enableNoKnownAllergies = useCallback(() => {
    const patch = noKnownAllergiesPatch(dataRef.current, true);
    if (patch) applyChange(patch, "allergies");
  }, [applyChange]);

  const toggleNoKnownAllergies = useCallback(() => {
    if (dataRef.current.noKnownAllergies) {
      const patch = noKnownAllergiesPatch(dataRef.current, false);
      if (patch) applyChange(patch, "allergies");
      return;
    }
    if (dataRef.current.allergies.trim()) {
      Modal.confirm({
        title: "Allergien entfernen?",
        content: "Die bereits eingetragenen Allergien werden entfernt. Möchten Sie fortfahren?",
        okText: "Fortfahren",
        cancelText: "Abbrechen",
        onOk: enableNoKnownAllergies,
      });
      return;
    }
    enableNoKnownAllergies();
  }, [applyChange, enableNoKnownAllergies]);

  const birthError = validateBirthDate(data.birthDate);
  const opError = validateOpDate(data.operationDate);

  const discardDraft = useCallback(() => {
    const original = editSessionRef.current?.originalBasisData ?? loadPatientData() ?? createEmptyPatientData();
    discardBasisEditSession();
    editSessionRef.current = null;
    dataRef.current = original;
    setEditSession(null);
    setData(original);
    resetStatuses();
  }, [resetStatuses]);

  const applyDraft = useCallback(() => {
    const session = editSessionRef.current;
    if (!session) return;
    const nextBirthError = validateBirthDate(session.draftBasisData.birthDate);
    const nextOpError = validateOpDate(session.draftBasisData.operationDate);
    if (nextBirthError || nextOpError) return;
    const committed = { ...session.draftBasisData, updatedAt: new Date().toISOString() };
    try {
      savePatientData(committed);
      const loaded = loadCase();
      if (loaded.status === "ok") {
        const now = Date.now();
        const nextCase = { ...loaded.data, caseRevision: loaded.data.caseRevision + 1, lastSavedAt: now };
        saveCase(nextCase);
        useCaseStore.setState({ ...nextCase, saveStatus: "saved" });
        syncCriticalSettingsBirthDate(loaded.data.caseId, session.originalBasisData.birthDate, committed.birthDate);
      }
      discardBasisEditSession();
      editSessionRef.current = null;
      dataRef.current = committed;
      setData(committed);
      setEditSession(null);
      markSaved(FIELD_ORDER);
      router.push("/dokumentation");
    } catch {
      reportError("patientName");
    }
  }, [markSaved, reportError, router]);

  const requestNewOperationSafely = useCallback(() => {
    const session = editSessionRef.current;
    if (session && basisDataChanged(session)) {
      Modal.confirm({
        title: "Nicht übernommene Änderungen verwerfen?",
        okText: "Änderungen verwerfen",
        cancelText: "Abbrechen",
        onOk: () => {
          discardDraft();
          requestNewOperation();
        },
      });
      return;
    }
    requestNewOperation();
  }, [discardDraft, requestNewOperation]);

  const hasDirtyBasisDraft = Boolean(editSession && basisDataChanged(editSession));

  useEffect(() => {
    if (!hasDirtyBasisDraft) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "Nicht übernommene Änderungen verwerfen?";
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      Modal.confirm({
        title: "Nicht übernommene Änderungen verwerfen?",
        okText: "Änderungen verwerfen",
        cancelText: "Abbrechen",
        onOk: discardDraft,
      });
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("keydown", escape);
    };
  }, [discardDraft, hasDirtyBasisDraft]);

  useEffect(() => {
    if (!hasDirtyBasisDraft) return;
    const marker = { basisEditGuard: true };
    window.history.pushState(marker, "", window.location.href);
    const onPopState = () => {
      if (window.confirm("Nicht übernommene Änderungen verwerfen?")) {
        window.removeEventListener("popstate", onPopState);
        discardDraft();
        window.history.back();
      } else {
        window.history.pushState(marker, "", window.location.href);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [discardDraft, hasDirtyBasisDraft]);

  return (
    <div className={styles.formWrap}>
      <OfflineStatus />

      {editSession ? (
        <Alert
          type="info"
          showIcon
          message="Sie bearbeiten die Basisdaten des bestehenden OP-Falls."
          data-testid="basis-edit-mode"
        />
      ) : null}

      <div className={styles.fields}>
        <Field name="patientName" htmlFor="patientName" status={statuses.patientName}>
          <Input
            id="patientName"
            data-testid="input-patientName"
            value={data.patientName}
            onChange={(e) => handleChange("patientName", e.target.value)}
            placeholder="z. B. Max Mustermann"
            autoComplete="off"
          />
        </Field>

        <Field name="birthDate" htmlFor="birthDate" status={statuses.birthDate} error={birthError}>
          <DateField
            id="birthDate"
            testId="input-birthDate"
            value={data.birthDate}
            onChange={(raw) => handleChange("birthDate", raw)}
            enforceYearCentury
            disabledDate={isBirthDateDisabled}
            ariaInvalid={Boolean(birthError)}
          />
        </Field>

        <Field name="procedure" htmlFor="procedure" status={statuses.procedure}>
          <Input
            id="procedure"
            data-testid="input-procedure"
            value={data.procedure}
            onChange={(e) => handleChange("procedure", e.target.value)}
            placeholder="z. B. Appendektomie"
            autoComplete="off"
          />
        </Field>

        <Field
          name="operationDate"
          htmlFor="operationDate"
          status={statuses.operationDate}
          error={opError}
        >
          <div className={styles.dateWithAction}>
            <DateField
              id="operationDate"
              testId="input-operationDate"
              value={data.operationDate}
              onChange={(raw) => handleChange("operationDate", raw)}
              disabledDate={isOpDateDisabled}
              ariaInvalid={Boolean(opError)}
              showTodayShortcut
            />
            <Button
              data-testid="operation-date-today"
              onClick={() => handleChange("operationDate", localTodayDeDate())}
            >
              Heute
            </Button>
          </div>
        </Field>

        <Field name="bodyWeightKg" htmlFor="bodyWeightKg" status={statuses.bodyWeightKg}>
          <InputNumber
            id="bodyWeightKg"
            className={styles.weightInput}
            value={data.bodyWeightKg}
            onChange={(v) => handleChange("bodyWeightKg", (v as number | null) ?? null)}
            addonAfter={
              <Select
                value={data.weightUnit}
                onChange={(u) => handleWeightUnit(u as WeightUnit)}
                options={[...WEIGHT_UNIT_OPTIONS]}
                className={styles.weightUnitSelect}
                variant="borderless"
                aria-label="Einheit"
                popupMatchSelectWidth={false}
              />
            }
            min={0}
            max={500}
            step={0.5}
            decimalSeparator=","
            placeholder="z. B. 75"
            style={{ width: "100%" }}
          />
        </Field>

        <Field name="asaClass" htmlFor="asaClass" status={statuses.asaClass}>
          <Select
            id="asaClass"
            value={data.asaClass ?? undefined}
            onChange={(v) => handleChange("asaClass", (v as PatientBaseData["asaClass"]) ?? null)}
            placeholder="ASA-Klasse wählen"
            allowClear
            style={{ width: "100%" }}
          >
            {ASA_OPTIONS.map((o) => (
              <Select.Option key={o.value} value={o.value}>
                {o.label}
              </Select.Option>
            ))}
          </Select>
        </Field>

        <Field name="mallampatiClass" htmlFor="mallampatiClass" status={statuses.mallampatiClass}>
          <Select
            id="mallampatiClass"
            value={data.mallampatiClass ?? undefined}
            onChange={(v) =>
              handleChange("mallampatiClass", (v as PatientBaseData["mallampatiClass"]) ?? null)
            }
            placeholder="Mallampati-Klasse wählen"
            allowClear
            style={{ width: "100%" }}
          >
            {MALLAMPATI_OPTIONS.map((o) => (
              <Select.Option key={o.value} value={o.value}>
                {o.label}
              </Select.Option>
            ))}
          </Select>
        </Field>

        <Field name="allergies" htmlFor="allergies" status={statuses.allergies}>
          <div className={styles.allergyControl}>
            <Input.TextArea
              id="allergies"
              data-testid="input-allergies"
              value={data.allergies}
              onChange={(e) => handleChange("allergies", e.target.value)}
              placeholder="z. B. Penicillin"
              autoSize={{ minRows: 3, maxRows: 6 }}
              disabled={data.noKnownAllergies}
            />
            <button
              type="button"
              className={`${styles.noAllergiesButton} ${data.noKnownAllergies ? styles.noAllergiesButtonActive : ""}`}
              aria-label="Keine Allergien bekannt"
              aria-pressed={data.noKnownAllergies}
              data-testid="no-known-allergies"
              onClick={toggleNoKnownAllergies}
            >
              <span aria-hidden>{data.noKnownAllergies ? "✓" : "○"}</span>
              Keine
            </button>
          </div>
        </Field>
      </div>

      <GlobalSaveStatus statuses={statuses} />

      {editSession ? (
        <div className={styles.editActions}>
          <Button type="primary" size="large" onClick={applyDraft} data-testid="apply-basis-edit">
            Änderungen übernehmen
          </Button>
          <Button size="large" onClick={discardDraft} data-testid="discard-basis-edit">
            Änderungen verwerfen
          </Button>
          <Button size="large" onClick={requestNewOperationSafely}>Neue OP</Button>
        </div>
      ) : (
        <>
          <Button
            type="primary"
            size="large"
            block
            className={styles.weiterButton}
            data-testid="weiter"
            onClick={() => {
              if (birthError || opError) return;
              router.push("/dokumentation");
            }}
          >
            {TEXT.weiterButton}
          </Button>
          <Button size="large" block onClick={requestNewOperationSafely} data-testid="new-operation">
            Neue OP
          </Button>
          <RemoveAllData onRemoved={handleRemoved} />
        </>
      )}

      <Modal
        title="Basisdaten dieses OP-Falls ändern?"
        open={attempt !== null}
        onCancel={() => setAttempt(null)}
        footer={
          <div className="basis-modal-actions">
            <Button onClick={() => setAttempt(null)}>Abbrechen</Button>
            <Button onClick={() => { setAttempt(null); requestNewOperation(); }}>Neue OP</Button>
            <Button
              type="primary"
              data-testid="confirm-direct-basis-edit"
              onClick={() => {
                if (!attempt) return;
                const session = startBasisEditSession(dataRef.current, "direct-edit", attempt.patch);
                editSessionRef.current = session;
                dataRef.current = session.draftBasisData;
                setData(session.draftBasisData);
                setEditSession(session);
                setAttempt(null);
              }}
            >
              Ja, diesen OP-Fall korrigieren
            </Button>
          </div>
        }
      >
        <p>Für diesen OP-Fall liegen bereits Dokumentationsdaten vor. Möchten Sie die Basisdaten desselben OP-Falls korrigieren?</p>
        <BasisDataSummary data={data} />
        {attempt ? (
          <div className={styles.attemptValues} data-testid="basis-attempt-values">
            <Typography.Text strong>Bisheriger Wert</Typography.Text>
            <span>{attempt.oldValue === null || attempt.oldValue === "" ? "Nicht angegeben" : String(attempt.oldValue)}</span>
            <Typography.Text strong>Neuer Wert</Typography.Text>
            <span>{attempt.newValue === null || attempt.newValue === "" ? "Nicht angegeben" : String(attempt.newValue)}</span>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
