"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, InputNumber, Select } from "antd";
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
  const [data, setData] = useState<PatientBaseData>(() => createEmptyPatientData());

  // dataRef spiegelt stets den aktuellen Stand und dient als Quelle beim Speichern.
  const dataRef = useRef<PatientBaseData>(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const { statuses, reportSaving, reportError, markSaved, resetStatuses } = useDebouncedFieldSave();

  // Beim ersten Rendern (nur im Browser) gespeicherte Daten laden.
  useEffect(() => {
    void requestPersistentStorage();
    const stored = loadPatientData();
    if (stored) {
      // localStorage darf erst nach dem Mounten gelesen werden, sonst weicht der
      // Client-Zustand vom serverseitig gerenderten HTML ab (Hydration).
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const birthError = validateBirthDate(data.birthDate);
  const opError = validateOpDate(data.operationDate);

  return (
    <div className={styles.formWrap}>
      <OfflineStatus />

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
          <DateField
            id="operationDate"
            testId="input-operationDate"
            value={data.operationDate}
            onChange={(raw) => handleChange("operationDate", raw)}
            disabledDate={isOpDateDisabled}
            ariaInvalid={Boolean(opError)}
            showTodayShortcut
          />
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
          <Input.TextArea
            id="allergies"
            data-testid="input-allergies"
            value={data.allergies}
            onChange={(e) => handleChange("allergies", e.target.value)}
            placeholder="z. B. keine bekannt"
            autoSize={{ minRows: 3, maxRows: 6 }}
          />
        </Field>
      </div>

      <GlobalSaveStatus statuses={statuses} />

      <Button
        type="primary"
        size="large"
        block
        className={styles.weiterButton}
        data-testid="weiter"
        onClick={() => router.push("/dokumentation")}
      >
        {TEXT.weiterButton}
      </Button>

      <RemoveAllData onRemoved={handleRemoved} />
    </div>
  );
}
