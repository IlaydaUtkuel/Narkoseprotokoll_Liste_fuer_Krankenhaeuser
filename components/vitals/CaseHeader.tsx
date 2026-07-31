"use client";

import Link from "next/link";
import { StartControl } from "./StartControl";
import { SaveStatusView } from "./SaveStatusView";
import type { PatientBaseData } from "../../types/patient";

interface Props {
  patient: PatientBaseData | null;
}

// Kompakter Kopfbereich der zweiten Seite. Das Sikant-Logo bleibt im Root-Layout
// links oben; hier folgen Fallzusammenfassung (links) und Start/Speicherstatus (rechts).
export function CaseHeader({ patient }: Props) {
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
        <Link href="/" className="case-header__back" data-testid="back-basisdaten">
          ← Zurück zu den Basisdaten
        </Link>
      </div>
      <div className="case-header__actions">
        <StartControl />
        <SaveStatusView />
      </div>
    </div>
  );
}
