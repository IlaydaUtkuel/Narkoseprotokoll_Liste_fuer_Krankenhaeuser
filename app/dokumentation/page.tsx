import { VitalDocumentation } from "../../components/vitals/VitalDocumentation";

// Zweite Seite (nach "Okay und Weiter"): Vitalparameter-Dokumentation mit gemeinsamer
// SVG-Zeitgrafik. Das Sikant-Logo bleibt links oben (Root-Layout).
export default function DokumentationPage() {
  return (
    <main className="doc-main">
      <VitalDocumentation />
    </main>
  );
}
