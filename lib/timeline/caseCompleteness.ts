import { validateBirthDate, validateOpDate } from "../date-utils";
import dayjs from "dayjs";
import type { PatientBaseData } from "../../types/patient";
import type { PersistedCase, TimelineEventType } from "../../types/vitals";
import { deriveCheckpointWarnings } from "./checkpoints";
import { eventDefinition } from "./events";

export type CompletenessStatus = "complete" | "warning" | "information";
export type CompletenessTarget = "/" | "/dokumentation";

export interface CompletenessCheck {
  id: string;
  category: "basisdaten" | "operation" | "vitals" | "therapies" | "events";
  status: CompletenessStatus;
  title: string;
  description: string;
  target?: CompletenessTarget;
}

export interface CompletenessConfiguration {
  requiredEventTypes: readonly TimelineEventType[];
}

export interface CaseCompletenessResult {
  checks: CompletenessCheck[];
  issues: CompletenessCheck[];
  hasWarnings: boolean;
}

// In dieser Demo sind keine medizinischen Ereignisse pauschal verpflichtend.
// Integrationen koennen die Liste explizit konfigurieren, ohne die Fachregel
// im Auswertungsalgorithmus zu verstecken.
export const DEFAULT_COMPLETENESS_CONFIGURATION: CompletenessConfiguration = {
  requiredEventTypes: [],
};

function basisDataCheck(patient: PatientBaseData | null, now: number): CompletenessCheck {
  if (!patient) {
    return {
      id: "basisdaten-fehlen",
      category: "basisdaten",
      status: "information",
      title: "Keine Basisdaten gespeichert",
      description: "Die aktuelle Formularversion definiert keine medizinisch verpflichtenden Textfelder. Es liegen jedoch keine Basisdaten zur Kontrolle vor.",
      target: "/",
    };
  }
  const errors = [
    patient.birthDate ? validateBirthDate(patient.birthDate, dayjs(now)) : null,
    patient.operationDate ? validateOpDate(patient.operationDate, dayjs(now)) : null,
  ].filter((value): value is string => Boolean(value));
  if (errors.length > 0) {
    return {
      id: "basisdaten-ungueltig",
      category: "basisdaten",
      status: "warning",
      title: "Basisdaten enthalten ungültige Datumsangaben",
      description: [...new Set(errors)].join(" "),
      target: "/",
    };
  }
  return {
    id: "basisdaten-formal-gueltig",
    category: "basisdaten",
    status: "complete",
    title: "Basisdaten formal gültig",
    description: "Die vorhandenen Basisdaten entsprechen den bestehenden Formularvalidierungen.",
  };
}

function operationCheck(caseData: PersistedCase): CompletenessCheck {
  if (caseData.startedAt === null) {
    return {
      id: "operation-nicht-gestartet",
      category: "operation",
      status: "warning",
      title: "Eingriff noch nicht gestartet",
      description: "Für den Fall ist keine Startzeit gespeichert.",
      target: "/dokumentation",
    };
  }
  if (caseData.endedAt === null) {
    return {
      id: "operation-laeuft",
      category: "operation",
      status: "warning",
      title: "Eingriff noch nicht beendet",
      description: "Für den begonnenen Eingriff ist keine Endzeit gespeichert.",
      target: "/dokumentation",
    };
  }
  return {
    id: "operation-beendet",
    category: "operation",
    status: "complete",
    title: "Eingriff beendet",
    description: "Start- und Endzeit sind vorhanden.",
  };
}

function vitalCheck(caseData: PersistedCase, now: number): CompletenessCheck {
  if (caseData.startedAt === null) {
    return {
      id: "vitals-nicht-auswertbar",
      category: "vitals",
      status: "information",
      title: "Vitaldokumentation noch nicht auswertbar",
      description: "Ohne Startzeit entstehen keine relativen Fünf-Minuten-Kontrollpunkte.",
      target: "/dokumentation",
    };
  }
  const warnings = deriveCheckpointWarnings(caseData.startedAt, caseData.endedAt, now, caseData.measurements);
  if (warnings.length > 0) {
    const first = warnings[0];
    const labels = first.missing.map((item) => item.detail ? `${item.label} (${item.detail})` : item.label).join(", ");
    return {
      id: "vitals-checkpoints-offen",
      category: "vitals",
      status: "warning",
      title: "Fehlende Vitalwertdokumentation",
      description: `${warnings.length} Kontrollpunkt(e) sind unvollständig. Am ersten offenen Kontrollpunkt fehlen: ${labels}.`,
      target: "/dokumentation",
    };
  }
  return {
    id: "vitals-checkpoints-vollstaendig",
    category: "vitals",
    status: "complete",
    title: "Vitalwert-Kontrollpunkte vollständig",
    description: "Alle abgeschlossenen relativen Fünf-Minuten-Kontrollpunkte sind dokumentiert.",
  };
}

function therapyCheck(caseData: PersistedCase): CompletenessCheck {
  const openMedications = caseData.medications.filter((entry) => entry.administrationType === "continuous" && entry.endedAt === null);
  const openInfusions = caseData.infusions.filter((entry) => entry.ongoing && entry.endedAt === null);
  const invalidUnits = [...caseData.medications, ...caseData.infusions].filter((entry) => !entry.unit.label.trim() || !entry.unit.code.trim());
  const details: string[] = [];
  if (openMedications.length > 0) details.push(`Laufende kontinuierliche Medikamentengabe(n): ${openMedications.map((entry) => entry.name).join(", ")}`);
  if (openInfusions.length > 0) details.push(`Laufende Infusion(en): ${openInfusions.map((entry) => entry.name).join(", ")}`);
  if (invalidUnits.length > 0) details.push(`${invalidUnits.length} Eintrag/Einträge ohne vollständige Einheit`);
  if (details.length > 0) {
    return {
      id: "therapien-offen",
      category: "therapies",
      status: "warning",
      title: "Therapiedokumentation noch offen",
      description: `${details.join(", ")}.`,
      target: "/dokumentation",
    };
  }
  return {
    id: "therapien-abgeschlossen",
    category: "therapies",
    status: "complete",
    title: "Therapiedokumentation ohne offene Dauer-Einträge",
    description: "Es wurden keine offenen kontinuierlichen Gaben oder laufenden Infusionen gefunden.",
  };
}

function eventCheck(caseData: PersistedCase, requiredEventTypes: readonly TimelineEventType[]): CompletenessCheck {
  if (requiredEventTypes.length === 0) {
    return {
      id: "events-nicht-verpflichtend",
      category: "events",
      status: "complete",
      title: "Keine Pflicht-Ereignisse konfiguriert",
      description: "Die Demo erklärt keine medizinischen Ereignisse pauschal für verpflichtend.",
    };
  }
  const missing = requiredEventTypes.filter((type) => !caseData.events.some((event) => event.eventType === type));
  if (missing.length > 0) {
    return {
      id: "events-konfiguriert-fehlen",
      category: "events",
      status: "warning",
      title: "Konfigurierte Ereignisse fehlen",
      description: `Fehlend: ${missing.map((type) => eventDefinition(type).label).join(", ")}.`,
      target: "/dokumentation",
    };
  }
  return {
    id: "events-konfiguriert-vollstaendig",
    category: "events",
    status: "complete",
    title: "Konfigurierte Ereignisse vorhanden",
    description: "Alle ausdrücklich konfigurierten Ereignistypen sind dokumentiert.",
  };
}

export function evaluateCaseCompleteness(
  caseData: PersistedCase,
  patient: PatientBaseData | null,
  configuration: CompletenessConfiguration = DEFAULT_COMPLETENESS_CONFIGURATION,
  now = Date.now(),
): CaseCompletenessResult {
  const checks = [
    basisDataCheck(patient, now),
    operationCheck(caseData),
    vitalCheck(caseData, now),
    therapyCheck(caseData),
    eventCheck(caseData, configuration.requiredEventTypes),
  ];
  const issues = checks.filter((check) => check.status !== "complete");
  return { checks, issues, hasWarnings: checks.some((check) => check.status === "warning") };
}
