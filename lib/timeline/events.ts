import type { TimelineEventType } from "../../types/vitals";

export interface TimelineEventDefinition {
  type: TimelineEventType;
  label: string;
  symbol: string;
}

export const TIMELINE_EVENT_DEFINITIONS: TimelineEventDefinition[] = [
  { type: "anesthesiaStart", label: "Beginn Anästhesie", symbol: "▶" },
  { type: "incision", label: "Schnitt", symbol: "✂" },
  { type: "suture", label: "Naht", symbol: "⌁" },
  { type: "emergenceEnd", label: "Ende Ausleitung", symbol: "✓" },
  { type: "patientOut", label: "Patient aus dem Saal", symbol: "⇥" },
];

export function eventDefinition(type: TimelineEventType): TimelineEventDefinition {
  return TIMELINE_EVENT_DEFINITIONS.find((item) => item.type === type)!;
}
