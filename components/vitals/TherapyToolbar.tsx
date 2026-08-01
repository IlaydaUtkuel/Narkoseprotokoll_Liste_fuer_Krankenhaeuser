"use client";

import { Button, Flex } from "antd";
import { TIMELINE_EVENT_DEFINITIONS } from "../../lib/timeline/events";
import type { TimelineEventType } from "../../types/vitals";

interface Props {
  disabled: boolean;
  onAddMedication: () => void;
  onAddInfusion: () => void;
  onSelectEvent: (type: TimelineEventType) => void;
}

export function TherapyToolbar({ disabled, onAddMedication, onAddInfusion, onSelectEvent }: Props) {
  return (
    <div className="therapy-toolbar" aria-label="Therapie und Ereignisse dokumentieren">
      <Flex gap={8} wrap>
        <Button disabled={disabled} onClick={onAddMedication} data-testid="add-medication">
          Medikament hinzufügen
        </Button>
        <Button disabled={disabled} onClick={onAddInfusion} data-testid="add-infusion">
          Infusion hinzufügen
        </Button>
      </Flex>
      <Flex gap={6} wrap className="event-actions">
        {TIMELINE_EVENT_DEFINITIONS.map((event) => (
          <Button
            key={event.type}
            disabled={disabled}
            onClick={() => onSelectEvent(event.type)}
            aria-label={`${event.label} dokumentieren`}
            data-testid={`add-event-${event.type}`}
          >
            <span aria-hidden>{event.symbol}</span> {event.label}
          </Button>
        ))}
      </Flex>
    </div>
  );
}
