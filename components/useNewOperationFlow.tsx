"use client";

import { Modal } from "antd";
import { useRouter } from "next/navigation";
import { clearPatientData } from "../lib/patient-storage";
import { clearCriticalSettings } from "../lib/timeline/criticalSettingsStorage";
import { clearCase, loadCase, saveCase } from "../lib/timeline/casePersistence";
import { clearOpWorkflow, hasActiveDocumentation, hasUnexportedChanges, setPendingAfterSaveAction } from "../lib/opWorkflow";
import { useCaseStore } from "../store/anesthesiaCaseStore";

function clearForNewOperation(caseId?: string) {
  if (caseId) clearCriticalSettings(caseId);
  clearPatientData();
  clearCase();
  clearOpWorkflow();
  useCaseStore.getState().resetCase();
}

export function useNewOperationFlow() {
  const router = useRouter();

  const continueToControl = () => {
    const loaded = loadCase();
    if (loaded.status !== "ok") return;
    if (loaded.data.endedAt !== null) {
      setPendingAfterSaveAction("start-new-case");
      router.push("/abschluss");
      return;
    }
    if (loaded.data.startedAt === null) {
      Modal.warning({
        title: "Eingriff noch nicht gestartet",
        content: "Bitte öffnen Sie die Dokumentation und starten Sie den Eingriff, bevor der Fall beendet und gespeichert wird.",
      });
      return;
    }
    Modal.confirm({
      title: "Eingriff beenden?",
      content: "Möchten Sie den Eingriff wirklich beenden?",
      okText: "Eingriff beenden",
      cancelText: "Abbrechen",
      onOk: () => {
        const current = loadCase();
        if (current.status !== "ok" || current.data.endedAt !== null) return;
        const now = Date.now();
        const next = {
          ...current.data,
          endedAt: now,
          caseRevision: current.data.caseRevision + 1,
          lastSavedAt: now,
        };
        saveCase(next);
        useCaseStore.setState({ ...next, saveStatus: "saved" });
        setPendingAfterSaveAction("start-new-case");
        router.push("/abschluss");
      },
      onCancel: () => setPendingAfterSaveAction(null),
    });
  };

  const requestNewOperation = () => {
    const loaded = loadCase();
    const current = loaded.status === "ok" ? loaded.data : null;
    if (!hasActiveDocumentation(current)) {
      Modal.confirm({
        title: "Neue OP beginnen?",
        content: "Möchten Sie die Basisdaten leeren und eine neue OP vorbereiten?",
        okText: "Neue OP beginnen",
        cancelText: "Abbrechen",
        onOk: () => {
          clearForNewOperation(current?.caseId);
          router.replace("/");
        },
      });
      return;
    }
    if (current && !hasUnexportedChanges(current)) {
      Modal.confirm({
        title: "Neue OP",
        content: "Der aktuelle OP-Fall wurde bereits gespeichert. Möchten Sie jetzt eine neue OP beginnen?",
        okText: "Neue OP beginnen",
        cancelText: "Abbrechen",
        onOk: () => {
          clearForNewOperation(current.caseId);
          router.replace("/");
        },
      });
      return;
    }
    Modal.confirm({
      title: "Aktuellen OP-Fall zuerst speichern",
      content: "Bevor eine neue OP begonnen werden kann, muss der aktuelle OP-Fall geprüft und gespeichert werden.",
      okText: "Aktuellen Fall prüfen und speichern",
      cancelText: "Abbrechen",
      onOk: continueToControl,
    });
  };

  return requestNewOperation;
}
