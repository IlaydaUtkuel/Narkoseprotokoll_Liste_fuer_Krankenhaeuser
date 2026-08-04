import type { TimelineLayout } from "../../lib/timeline/geometry";
import type { XScale, YScale } from "../../lib/timeline/scales";
import type {
  InfusionEntry,
  Measurement,
  MedicationEntry,
  ScalarKind,
  ScalarMeasurement,
  TimelineEvent,
  TimelineEventType,
  VitalKind,
} from "../../types/vitals";

export interface DragPreview {
  id: string;
  kind: VitalKind;
  time: number;
  value: number;
}

export interface BandContext {
  layout: TimelineLayout;
  xScale: XScale;
  yScales: Record<VitalKind, YScale>;
  startedAt: number;
  now: number;
  selectedId: string | null;
  dragPreview: DragPreview | null;
  /** Zeit unter dem Zeiger (für Anzeigen, die die aktuelle Stiftposition brauchen). */
  pointerTime: number | null;
  /** Messpunkt, der zum Verschieben ausgewählt ist (schwarzer Ring). */
  armedId: string | null;
  onPointTap: (m: Measurement) => void;
  onScalarDragMove: (m: ScalarMeasurement, clientX: number, clientY: number) => void;
  onScalarDragEnd: (m: ScalarMeasurement) => void;
  onScalarDragCancel: () => void;
}

// Entwurf fuer das Eingabe-/Bearbeitungsformular.
export type EntryDraft =
  | { mode: "create-scalar"; kind: ScalarKind; time: number; value: number }
  | { mode: "edit-scalar"; id: string; kind: ScalarKind; time: number; value: number }
  | { mode: "create-nibp"; time: number; mean: number }
  | {
      mode: "edit-nibp";
      id: string;
      time: number;
      systolic: number | null;
      mean: number;
      diastolic: number | null;
      focusPart?: "systolic" | "diastolic";
    };

export type TherapyDraft =
  | { mode: "create-medication"; startedAt: number }
  | { mode: "edit-medication"; entry: MedicationEntry }
  | { mode: "create-infusion"; startedAt: number }
  | { mode: "edit-infusion"; entry: InfusionEntry }
  | { mode: "create-event"; eventType: TimelineEventType; time: number }
  | { mode: "edit-event"; entry: TimelineEvent };
