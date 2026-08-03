"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Checkbox, Descriptions, Result, Spin, Typography } from "antd";
import { useRouter } from "next/navigation";
import { loadPatientData } from "../../lib/patient-storage";
import { loadCase } from "../../lib/timeline/casePersistence";
import { archiveAndCloseCompletedCase } from "../../lib/timeline/caseArchive";
import {
  buildCaseExportSnapshot,
  chooseDirectory,
  directoryPickerSupported,
  isPickerCancellation,
  shareOrDownloadSnapshot,
  writeSnapshotToDirectory,
  type CaseExportSnapshot,
  type DirectoryHandleLike,
} from "../../lib/timeline/caseExport";
import { formatClock } from "../../lib/timeline/format";
import { CaseTimelinePreview } from "./CaseTimelinePreview";
import { loadOpWorkflow, clearOpWorkflow } from "../../lib/opWorkflow";
import { saveCase } from "../../lib/timeline/casePersistence";
import { useCaseStore } from "../../store/anesthesiaCaseStore";
import { evaluateCaseCompleteness } from "../../lib/timeline/caseCompleteness";

const CONFIRMATION = "Ich habe die Falldaten und die Dokumentation geprüft und möchte den Fall speichern.";

export function CloseCasePage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<CaseExportSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [directoryCapable, setDirectoryCapable] = useState(false);
  const [directory, setDirectory] = useState<DirectoryHandleLike | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [completenessAcknowledged, setCompletenessAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFile, setSavedFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadCase();
    if (loaded.status !== "ok" || loaded.data.endedAt === null) {
      // localStorage darf erst nach dem Mount gelesen werden (SSR-Hydration).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoadError("Nur ein beendeter Eingriff kann kontrolliert und gespeichert werden.");
      return;
    }
    setSnapshot(buildCaseExportSnapshot(loaded.data, loadPatientData()));
    setDirectoryCapable(directoryPickerSupported());
  }, []);

  const duration = useMemo(() => {
    if (!snapshot || snapshot.startedAt === null || snapshot.endedAt === null) return "Nicht angegeben";
    const seconds = Math.max(0, Math.floor((snapshot.endedAt - snapshot.startedAt) / 1_000));
    const hours = Math.floor(seconds / 3_600);
    const minutes = Math.floor((seconds % 3_600) / 60);
    const rest = seconds % 60;
    return `${hours} h ${minutes} min ${rest} s`;
  }, [snapshot]);

  const completeness = useMemo(
    () => snapshot ? evaluateCaseCompleteness(snapshot, snapshot.basisdaten, undefined, snapshot.endedAt ?? snapshot.startedAt ?? 0) : null,
    [snapshot],
  );

  if (savedFile) {
    return (
      <main className="close-case-page" data-testid="case-close-complete">
        <Result
          status="success"
          title="Der Eingriff wurde als Datei gespeichert und geschlossen."
          subTitle={`Datei: ${savedFile}`}
          extra={<Button type="primary" size="large" onClick={() => router.replace("/")} data-testid="new-case-start">Neuen Fall starten</Button>}
        />
      </main>
    );
  }

  if (loadError) return <main className="close-case-page"><Result status="warning" title={loadError} extra={<Button onClick={() => router.replace("/dokumentation")}>Zur Dokumentation</Button>} /></main>;
  if (!snapshot) return <main className="close-case-page close-case-loading"><Spin size="large" /></main>;

  const patient = snapshot.basisdaten;
  const present = (value: unknown) => value === null || value === undefined || value === "" ? "Nicht angegeben" : String(value);

  const selectDirectory = async () => {
    setError(null);
    try {
      setDirectory(await chooseDirectory());
    } catch (reason) {
      if (!isPickerCancellation(reason)) setError(reason instanceof Error ? reason.message : "Der Ordner konnte nicht ausgewählt werden.");
    }
  };

  const save = async () => {
    if (!confirmed || saving || (completeness?.issues.length && !completenessAcknowledged)) return;
    if (directoryCapable && !directory) {
      setError("Bitte zuerst einen Ordner auswählen.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const receipt = directory
        ? await writeSnapshotToDirectory(snapshot, directory)
        : await shareOrDownloadSnapshot(snapshot);
      const exportedSnapshot = {
        ...snapshot,
        lastSuccessfullyExportedRevision: snapshot.caseRevision,
      };
      saveCase(exportedSnapshot);
      const pendingAction = loadOpWorkflow().pendingAfterSaveAction;
      archiveAndCloseCompletedCase(exportedSnapshot, receipt);
      clearOpWorkflow();
      useCaseStore.getState().resetCase();
      if (pendingAction === "start-new-case") {
        router.replace("/");
        return;
      }
      setSavedFile(receipt.fileName);
    } catch (reason) {
      if (!isPickerCancellation(reason)) setError(reason instanceof Error ? reason.message : "Die Falldatei konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="close-case-page" data-testid="case-close-page">
      <section className="close-case-card close-case-card--wide">
        <Typography.Title level={1}>Kontrolle</Typography.Title>
        <Alert type="info" showIcon message="Bitte prüfen Sie zuerst die Basisdaten und anschließend die vollständige Dokumentation." />

        <Typography.Title level={2}>1. Basisdaten des Narkosefalls</Typography.Title>
        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} data-testid="case-basis-summary">
          <Descriptions.Item label="Patient/-in">{present(patient?.patientName)}</Descriptions.Item>
          <Descriptions.Item label="Geburtsdatum">{present(patient?.birthDate)}</Descriptions.Item>
          <Descriptions.Item label="OP-Datum">{present(patient?.operationDate)}</Descriptions.Item>
          <Descriptions.Item label="Eingriff / Operation">{present(patient?.procedure)}</Descriptions.Item>
          <Descriptions.Item label="Körpergewicht">{patient?.bodyWeightKg == null ? "Nicht angegeben" : `${patient.bodyWeightKg} ${patient.weightUnit}`}</Descriptions.Item>
          <Descriptions.Item label="ASA-Klasse">{present(patient?.asaClass)}</Descriptions.Item>
          <Descriptions.Item label="Mallampati-Klasse">{present(patient?.mallampatiClass)}</Descriptions.Item>
          <Descriptions.Item label="Allergien">{present(patient?.allergies)}</Descriptions.Item>
          <Descriptions.Item label="Beginn">{snapshot.startedAt === null ? "Nicht angegeben" : formatClock(snapshot.startedAt)}</Descriptions.Item>
          <Descriptions.Item label="Ende">{snapshot.endedAt === null ? "Nicht angegeben" : formatClock(snapshot.endedAt)}</Descriptions.Item>
          <Descriptions.Item label="Gesamtdauer">{duration}</Descriptions.Item>
          <Descriptions.Item label="Fall-ID">{snapshot.caseId}</Descriptions.Item>
        </Descriptions>

        <Typography.Title level={2}>2. Grafik und Timeline</Typography.Title>
        <Typography.Paragraph type="secondary">Schreibgeschützte Vorschau der tatsächlich gespeicherten Falldaten.</Typography.Paragraph>
        <CaseTimelinePreview caseData={snapshot} />

        <Typography.Title level={2}>3. Vollständigkeitsprüfung</Typography.Title>
        <section className="completeness-panel" data-testid="case-completeness" aria-live="polite">
          {completeness?.hasWarnings ? (
            <Alert
              type="warning"
              showIcon
              message="Die Falldaten enthalten noch Dokumentationshinweise."
              description="Die Hinweise beruhen ausschließlich auf vorhandenen Daten und bestehenden Formularregeln. Sie sind keine medizinische Bewertung."
            />
          ) : (
            <Alert
              type={completeness?.issues.length ? "info" : "success"}
              showIcon
              message={completeness?.issues.length ? "Bitte beachten Sie die sachlichen Hinweise." : "Keine offenen Dokumentationshinweise gefunden."}
            />
          )}
          <ul className="completeness-list">
            {completeness?.checks.map((check) => (
              <li key={check.id} className={`completeness-item completeness-item--${check.status}`} data-testid={`completeness-${check.id}`}>
                <span className="completeness-item__icon" aria-hidden>{check.status === "complete" ? "✓" : check.status === "warning" ? "!" : "i"}</span>
                <span><strong>{check.title}</strong><small>{check.description}</small></span>
              </li>
            ))}
          </ul>
          {completeness?.issues.some((issue) => issue.target === "/") ? (
            <Button onClick={() => router.push("/")} data-testid="completeness-back-basis">Zu den Basisdaten zurückkehren</Button>
          ) : null}
          {completeness?.issues.some((issue) => issue.target === "/dokumentation") ? (
            <Button onClick={() => router.push("/dokumentation")} data-testid="completeness-back-documentation">Zur Dokumentation zurückkehren</Button>
          ) : null}
          {completeness?.issues.length ? (
            <Checkbox
              checked={completenessAcknowledged}
              onChange={(event) => setCompletenessAcknowledged(event.target.checked)}
              data-testid="completeness-acknowledgement"
            >
              Ich habe die Hinweise der Vollständigkeitsprüfung gesehen und möchte mit der Kontrolle fortfahren.
            </Checkbox>
          ) : null}
        </section>

        <Typography.Title level={2}>4. Datei oder Ordner wählen</Typography.Title>
        {directoryCapable ? (
          <div className="close-case-destination">
            <Button onClick={() => void selectDirectory()} data-testid="choose-directory">Ordner auswählen</Button>
            <span data-testid="selected-directory">{directory ? `Ausgewählt: ${directory.name ?? "Ordner"}` : "Noch kein Ordner ausgewählt"}</span>
          </div>
        ) : (
          <Alert type="info" showIcon message="Die Falldatei wird über die Gerätefreigabe angeboten. Falls diese nicht verfügbar ist, wird eine echte JSON-Datei heruntergeladen, die in Dateien gespeichert werden kann." data-testid="file-delivery-fallback" />
        )}

        <Typography.Title level={2}>5. Letzte Bestätigung</Typography.Title>
        <Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} data-testid="archive-confirmation">
          {CONFIRMATION}
        </Checkbox>
        {error ? <Alert type="error" showIcon message={error} className="close-case-error" data-testid="archive-error" /> : null}
        <div className="close-case-actions">
          <Button
            type="primary"
            size="large"
            disabled={!confirmed || Boolean(completeness?.issues.length && !completenessAcknowledged) || (directoryCapable && !directory)}
            loading={saving}
            onClick={() => void save()}
            data-testid="archive-save"
          >
            Speichern und Schließen
          </Button>
        </div>
      </section>
    </main>
  );
}
