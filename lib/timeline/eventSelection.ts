import type { TimelineEventType } from "../../types/vitals";

export function toggleEventSelection(
  current: TimelineEventType | null,
  requested: TimelineEventType,
): TimelineEventType | null {
  return current === requested ? null : requested;
}
