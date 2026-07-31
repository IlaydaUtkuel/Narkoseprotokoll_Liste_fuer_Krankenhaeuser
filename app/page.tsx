import { PatientBaseDataForm } from "../components/PatientBaseDataForm";
import { TEXT } from "../lib/constants";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1 className={styles.title}>{TEXT.pageTitle}</h1>
        <p className={styles.subtitle}>{TEXT.subtitle}</p>
        <PatientBaseDataForm />
      </div>
    </main>
  );
}
