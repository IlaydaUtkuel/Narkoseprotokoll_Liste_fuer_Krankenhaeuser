"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, DatePicker, Input, InputNumber, Select } from "antd";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { AutosaveFieldStatus } from "./AutosaveFieldStatus";
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
  DATE_FORMAT,
  FIELD_LABELS,
  FIELD_ORDER,
  MALLAMPATI_OPTIONS,
  TEXT,
  createEmptyPatientData,
} from "../lib/constants";
import type { FieldSaveStatus, PatientBaseData, PatientField } from "../types/patient";
import styles from "./PatientBaseDataForm.module.css";

// Erlaubt das Tippen eines Datums im deutschen Format.
dayjs.extend(customParseFormat);

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

interface FieldProps {
  name: PatientField;
  htmlFor: string;
  status?: FieldSaveStatus;
  children: ReactNode;
}

// Einheitliches Layout: Beschriftung oben, Eingabefeld und Status in einer Zeile.
function Field({ name, htmlFor, status, children }: FieldProps) {
  return (
    <div className={styles.field} data-testid={`field-${name}`}>
      <label className={styles.label} htmlFor={htmlFor}>
        {FIELD_LABELS[name]}
      </label>
      <div className={styles.controlRow}>
        <div className={styles.control}>{children}</div>
        <AutosaveFieldStatus status={status} testId={`status-${name}`} />
      </div>
    </div>
  );
}

export function PatientBaseDataForm() {
  const router = useRouter();
  const [data, setData] = useState<PatientBaseData>(() => createEmptyPatientData());

  // dataRef spiegelt stets den zuletzt bestaetigten Stand und dient als Quelle
  // beim (spaeter ausgeloesten) Speichern. Aktualisierung erfolgt im Effekt.
  const dataRef = useRef<PatientBaseData>(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Schreibt immer den aktuellsten Stand samt frischem Zeitstempel.
  const persist = useCallback(() => {
    savePatientData({ ...dataRef.current, updatedAt: new Date().toISOString() });
  }, []);

  const { statuses, scheduleSave, markSaved, resetStatuses } = useDebouncedFieldSave({ persist });

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

  const handleChange = useCallback(
    <K extends PatientField>(field: K, value: PatientBaseData[K]) => {
      setData((prev) => ({ ...prev, [field]: value }) as PatientBaseData);
      scheduleSave(field);
    },
    [scheduleSave],
  );

  const handleRemoved = useCallback(() => {
    setData(createEmptyPatientData());
    resetStatuses();
  }, [resetStatuses]);

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

        <Field name="birthDate" htmlFor="birthDate" status={statuses.birthDate}>
          <DatePicker
            id="birthDate"
            value={data.birthDate ? dayjs(data.birthDate) : null}
            onChange={(d) => handleChange("birthDate", d ? d.format("YYYY-MM-DD") : null)}
            format={DATE_FORMAT}
            placeholder="TT.MM.JJJJ"
            allowClear
            inputReadOnly={false}
            style={{ width: "100%" }}
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

        <Field name="operationDate" htmlFor="operationDate" status={statuses.operationDate}>
          <DatePicker
            id="operationDate"
            value={data.operationDate ? dayjs(data.operationDate) : null}
            onChange={(d) => handleChange("operationDate", d ? d.format("YYYY-MM-DD") : null)}
            format={DATE_FORMAT}
            placeholder="TT.MM.JJJJ"
            allowClear
            inputReadOnly={false}
            style={{ width: "100%" }}
          />
        </Field>

        <Field name="bodyWeightKg" htmlFor="bodyWeightKg" status={statuses.bodyWeightKg}>
          <InputNumber
            id="bodyWeightKg"
            value={data.bodyWeightKg}
            onChange={(v) => handleChange("bodyWeightKg", (v as number | null) ?? null)}
            addonAfter="kg"
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
