export type TimelineTimeError = "beforeStart" | "future" | "afterEnd";

export const TIME_ERROR_MESSAGES: Record<TimelineTimeError, string> = {
  beforeStart: "Der Zeitpunkt darf nicht vor dem Beginn des Eingriffs liegen.",
  future: "Der Zeitpunkt darf nicht in der Zukunft liegen.",
  afterEnd: "Nach dem Ende des Eingriffs können keine neuen Einträge dokumentiert werden.",
};

export function timestampFromClockParts(
  caseTimestamp: number,
  hours: number,
  minutes: number,
  seconds: number,
): number {
  const date = new Date(caseTimestamp);
  date.setHours(hours, minutes, seconds, 0);
  return date.getTime();
}

export function validateTimelineTime(
  time: number,
  startedAt: number,
  now: number,
  endedAt: number | null,
): TimelineTimeError | null {
  if (!Number.isFinite(time) || time < startedAt) return "beforeStart";
  if (time > now) return "future";
  if (endedAt !== null && time > endedAt) return "afterEnd";
  return null;
}

export function maxDocumentableTime(now: number, endedAt: number | null): number {
  return endedAt === null ? now : Math.min(now, endedAt);
}
