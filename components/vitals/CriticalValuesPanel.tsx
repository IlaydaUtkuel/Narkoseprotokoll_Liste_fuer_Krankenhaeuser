"use client";

import { useState } from "react";
import { Alert, Button, InputNumber, Modal, Typography } from "antd";
import { ageDefaults, calculatePatientAge, EMPTY_CRITICAL_THRESHOLDS, validateCriticalThresholds, type CriticalThresholds } from "../../lib/timeline/criticalValues";
import { saveCriticalSettings, type CriticalSettings } from "../../lib/timeline/criticalSettingsStorage";

const FIELDS: { key: keyof CriticalThresholds; label: string; step?: number }[] = [
  { key: "spo2Lower", label: "SpO₂ Untergrenze (%)" },
  { key: "mapLower", label: "MAP Untergrenze (mmHg)" },
  { key: "systolicLower", label: "Systolisch Untergrenze (mmHg)" },
  { key: "systolicUpper", label: "Systolisch Obergrenze (mmHg)" },
  { key: "diastolicUpper", label: "Diastolisch Obergrenze (mmHg)" },
  { key: "heartRateLower", label: "Herzfrequenz Untergrenze (/min)" },
  { key: "heartRateUpper", label: "Herzfrequenz Obergrenze (/min)" },
  { key: "temperatureLower", label: "Temperatur Untergrenze (°C)", step: 0.1 },
  { key: "temperatureUpper", label: "Temperatur Obergrenze (°C)", step: 0.1 },
  { key: "temperatureRiseDelta", label: "Temperaturanstieg (°C)", step: 0.1 },
  { key: "temperatureRiseWindowMinutes", label: "Zeitraum für Temperaturanstieg (Minuten)" },
];

export function CriticalValuesPanel({ settings, birthDate, onChange }: { settings: CriticalSettings; birthDate: string; onChange: (settings: CriticalSettings) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CriticalThresholds>(settings.thresholds);
  const [draftSource, setDraftSource] = useState(settings.source);
  const [errors, setErrors] = useState<ReturnType<typeof validateCriticalThresholds>>({});
  const age = calculatePatientAge(birthDate);

  const openPanel = () => {
    setDraft(settings.thresholds);
    setDraftSource(settings.source);
    setErrors({});
    setOpen(true);
  };

  const apply = () => {
    const nextErrors = validateCriticalThresholds(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const next: CriticalSettings = {
      ...settings,
      birthDate,
      thresholds: { ...draft },
      source: draftSource,
      ageChangedNotice: draftSource === "automatic" ? false : settings.ageChangedNotice,
    };
    saveCriticalSettings(next);
    onChange(next);
    setOpen(false);
  };

  return (
    <>
      <div className="critical-values-launcher">
        <Button onClick={openPanel} data-testid="critical-values-button">Kritische Werte</Button>
        <span>Nur visuelle Orientierung – keine automatische klinische Bewertung.</span>
        {settings.ageChangedNotice ? <span className="critical-age-notice">Das Patientenalter wurde geändert. Bitte prüfen Sie die individuell eingestellten kritischen Werte.</span> : null}
      </div>
      <Modal
        title="Kritische Werte"
        open={open}
        onCancel={() => setOpen(false)}
        width={720}
        footer={null}
        destroyOnHidden
      >
        <Alert type="info" showIcon message="Diese Werte dienen nur als optionale visuelle Orientierung und ersetzen keine klinische Beurteilung." />
        <Typography.Paragraph className="critical-age-info" data-testid="critical-patient-age">
          <strong>Berechnetes Patientenalter:</strong> {age === null ? "Nicht berechenbar" : `${age} Jahre`}.
        </Typography.Paragraph>
        {age !== null && age < 18 ? <Typography.Paragraph className="critical-age-info">Für Patientinnen und Patienten unter 18 Jahren sind keine Standardwerte vorbelegt.</Typography.Paragraph> : null}
        {age !== null && age >= 65 ? <Typography.Paragraph className="critical-age-info">Bitte prüfen Sie, ob die kritischen Werte für Patientinnen und Patienten ab 65 Jahren individuell angepasst werden müssen.</Typography.Paragraph> : null}
        <div className="critical-values-grid">
          {FIELDS.map((field) => (
            <label key={field.key} className="critical-value-field">
              <span>{field.label}</span>
              <InputNumber
                value={draft[field.key]}
                step={field.step ?? 1}
                controls={false}
                placeholder="Optional"
                aria-invalid={Boolean(errors[field.key])}
                data-testid={`critical-${field.key}`}
                onChange={(value) => {
                  setDraft((current) => ({ ...current, [field.key]: typeof value === "number" && Number.isFinite(value) ? value : null }));
                  setDraftSource("custom");
                  setErrors((current) => ({ ...current, [field.key]: undefined }));
                }}
              />
              {errors[field.key] ? <span className="critical-value-error" role="alert">{errors[field.key]}</span> : null}
            </label>
          ))}
        </div>
        <div className="critical-values-actions">
          <Button type="primary" onClick={apply} data-testid="critical-apply">Übernehmen</Button>
          <Button onClick={() => setOpen(false)}>Abbrechen</Button>
          <Button onClick={() => { setDraft(ageDefaults(age)); setDraftSource("automatic"); setErrors({}); }}>Altersabhängige Ausgangswerte wiederherstellen</Button>
          <Button onClick={() => { setDraft({ ...EMPTY_CRITICAL_THRESHOLDS }); setDraftSource("custom"); setErrors({}); }}>Alle Werte leeren</Button>
        </div>
      </Modal>
    </>
  );
}
