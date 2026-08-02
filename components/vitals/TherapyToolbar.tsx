"use client";

import { TIMELINE_EVENT_DEFINITIONS } from "../../lib/timeline/events";
import type { TimelineLayout } from "../../lib/timeline/geometry";
import type { TimelineEventType } from "../../types/vitals";

interface Props {
  layout: TimelineLayout;
  disabled: boolean;
  selected: TimelineEventType | null;
  onSelect: (type: TimelineEventType) => void;
}

// Die Ereigniswerkzeuge sind bewusst Teil der linken Gutter-Zone der
// Ereignis-Lane. Dadurch bleibt die Seite kompakt und die Auswahl steht direkt
// dort, wo das Symbol anschließend zeitlich platziert wird.
export function EventLaneTools({ layout, disabled, selected, onSelect }: Props) {
  const lane = layout.therapyLanes[2];
  return (
    <foreignObject
      x={8}
      y={lane.top + 34}
      width={160}
      height={66}
      data-testid="event-lane-tools"
      aria-label="Ereignissymbol auswählen"
    >
      <div className="event-tool-list">
        {TIMELINE_EVENT_DEFINITIONS.map((definition) => {
          const isSelected = selected === definition.type;
          return (
            <button
              key={definition.type}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              aria-label={`${definition.label} auswählen`}
              title={definition.label}
              data-testid={`select-event-${definition.type}`}
              className={`event-tool ${isSelected ? "event-tool--selected" : ""}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(definition.type);
              }}
            >
              <span aria-hidden>{definition.symbol}</span>
            </button>
          );
        })}
      </div>
    </foreignObject>
  );
}
