import type { TimelineLayout } from "../../lib/timeline/geometry";
import type { XScale, YScale } from "../../lib/timeline/scales";
import type { Measurement, ScalarKind, ScalarMeasurement, VitalKind } from "../../types/vitals";

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
  onPointTap: (m: Measurement) => void;
  onScalarDragMove: (m: ScalarMeasurement, clientX: number, clientY: number) => void;
  onScalarDragEnd: (m: ScalarMeasurement) => void;
  onScalarDragCancel: () => void;
}

// Entwurf fuer das Eingabe-/Bearbeitungsformular.
export type EntryDraft =
  | { mode: "create-scalar"; kind: ScalarKind; time: number; value: number }
  | { mode: "edit-scalar"; id: string; kind: ScalarKind; time: number; value: number }
  | { mode: "create-nibp"; time: number }
  | { mode: "edit-nibp"; id: string; time: number; systolic: number; mean: number; diastolic: number };
