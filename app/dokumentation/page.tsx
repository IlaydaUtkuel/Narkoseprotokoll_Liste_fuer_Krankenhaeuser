import Link from "next/link";
import styles from "../page.module.css";

// Diese Route ist in dieser Entwicklungsstufe absichtlich leer.
// Es werden hier noch keine Vitalwerte, Medikamente, Infusionen oder Ereignisse
// implementiert.
export default function DokumentationPage() {
  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1 className={styles.title}>Dokumentation</h1>
        <p className={styles.subtitle} data-testid="doku-placeholder">
          Diese Seite ist in dieser Entwicklungsstufe absichtlich leer. Die interaktive
          Vitalwertkurve mit Pointer Events folgt in einem späteren Schritt.
        </p>
        <Link href="/" className={styles.backLink} data-testid="back-home">
          ← Zurück zu den Basisdaten
        </Link>
      </div>
    </main>
  );
}
