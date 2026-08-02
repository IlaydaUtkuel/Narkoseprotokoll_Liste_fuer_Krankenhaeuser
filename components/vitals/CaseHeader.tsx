"use client";

import { useState } from "react";
import { Button, Modal } from "antd";
import { useRouter } from "next/navigation";
import { StartControl } from "./StartControl";
import { SaveStatusView } from "./SaveStatusView";
import { EndControl } from "./EndControl";
import type { PatientBaseData } from "../../types/patient";
import { BasisDataSummary } from "../BasisDataSummary";
import { createEmptyPatientData } from "../../lib/constants";
import { loadCase } from "../../lib/timeline/casePersistence";
import { hasActiveDocumentation, startBasisEditSession } from "../../lib/opWorkflow";
import { useNewOperationFlow } from "../useNewOperationFlow";

interface Props {
  patient: PatientBaseData | null;
}

// Kompakter Kopfbereich der zweiten Seite. Das Sikant-Logo bleibt im Root-Layout
// links oben; hier folgen Fallzusammenfassung (links) und Start/Speicherstatus (rechts).
export function CaseHeader({ patient }: Props) {
  const router = useRouter();
  const requestNewOperation = useNewOperationFlow();
  const [basisModalOpen, setBasisModalOpen] = useState(false);
  const procedure = patient?.procedure?.trim() || "—";
  const opDate = patient?.operationDate?.trim() || "—";
  const patientName = patient?.patientName?.trim();

  return (
    <div className="case-header" data-testid="case-header">
      <div className="case-header__info">
        <div className="case-header__title">Fiktiver Demofall</div>
        <div className="case-header__meta">
          <span>
            <strong>Eingriff:</strong> {procedure}
          </span>
          <span>
            <strong>Datum:</strong> {opDate}
          </span>
          {patientName ? (
            <span>
              <strong>Patient/-in:</strong> {patientName}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="case-header__back case-header__back-button"
          data-testid="back-basisdaten"
          onClick={() => {
            const loaded = loadCase();
            if (loaded.status === "ok" && hasActiveDocumentation(loaded.data)) setBasisModalOpen(true);
            else router.push("/");
          }}
        >
          ← Zurück zu den Basisdaten
        </button>
      </div>
      <div className="case-header__actions">
        <StartControl />
        <EndControl />
        <SaveStatusView />
      </div>
      <Modal
        title="Basisdaten dieses OP-Falls bearbeiten?"
        open={basisModalOpen}
        onCancel={() => setBasisModalOpen(false)}
        footer={
          <div className="basis-modal-actions">
            <Button onClick={() => setBasisModalOpen(false)}>Abbrechen</Button>
            <Button onClick={() => { setBasisModalOpen(false); requestNewOperation(); }}>Neue OP</Button>
            <Button
              type="primary"
              data-testid="confirm-edit-basis"
              onClick={() => {
                startBasisEditSession(patient ?? createEmptyPatientData(), "timeline");
                setBasisModalOpen(false);
                router.push("/");
              }}
            >
              Ja, Basisdaten bearbeiten
            </Button>
          </div>
        }
      >
        <p>Möchten Sie die Patientendaten und Basisdaten für diesen bestehenden OP-Fall korrigieren?</p>
        <BasisDataSummary data={patient ?? createEmptyPatientData()} />
      </Modal>
    </div>
  );
}
