"use client";

import { useEffect, useState } from "react";
import { Button, Result } from "antd";
import { loadPatientData } from "../../lib/patient-storage";
import { useCaseStore } from "../../store/anesthesiaCaseStore";
import { CaseHeader } from "./CaseHeader";
import { VitalTimeline } from "./VitalTimeline";
import type { PatientBaseData } from "../../types/patient";

// Orchestriert die zweite Seite: hydratisiert den Fall-Store, laedt die
// Basisdaten (nur Anzeige) und behandelt beschaedigte Persistenz.
export function VitalDocumentation() {
  const hydrate = useCaseStore((s) => s.hydrate);
  const hydrated = useCaseStore((s) => s.hydrated);
  const loadError = useCaseStore((s) => s.loadError);
  const resetCase = useCaseStore((s) => s.resetCase);
  const [patient, setPatient] = useState<PatientBaseData | null>(null);

  useEffect(() => {
    hydrate();
    // Basisdaten erst nach dem Mounten aus localStorage lesen (Hydration).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPatient(loadPatientData());
  }, [hydrate]);

  if (hydrated && loadError) {
    return (
      <div className="doc-container" data-testid="case-load-error">
        <Result
          status="warning"
          title="Gespeicherte Falldaten konnten nicht geladen werden."
          subTitle="Die lokal gespeicherten Vitaldaten sind beschädigt. Sie können den Demofall zurücksetzen, um neu zu beginnen. Vorhandene Daten werden nicht stillschweigend überschrieben."
          extra={
            <Button danger type="primary" onClick={resetCase} data-testid="reset-case">
              Demofall zurücksetzen
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="doc-container">
      <CaseHeader patient={patient} />
      <VitalTimeline patientBirthDate={patient?.birthDate ?? ""} />
      <p className="timeline-hint">
        Tippen Sie in ein Band, um einen Wert zu dokumentieren. Bestehende Punkte lassen sich
        antippen (bearbeiten) oder ziehen (Wert anpassen).
      </p>
    </div>
  );
}
