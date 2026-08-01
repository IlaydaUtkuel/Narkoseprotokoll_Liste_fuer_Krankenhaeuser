export interface DurationSource {
  startTime: number;
  durationMinutes: number | null;
  endTime: number | null;
  ongoing: boolean;
}

export function explicitEndTime(entry: DurationSource): number | null {
  if (entry.endTime !== null) return entry.endTime;
  if (entry.durationMinutes !== null && entry.durationMinutes > 0) {
    return entry.startTime + entry.durationMinutes * 60_000;
  }
  return null;
}

export function displayEndTime(
  entry: DurationSource,
  currentTime: number,
  endedAt: number | null,
): number | null {
  const hardLimit = endedAt === null ? currentTime : Math.min(currentTime, endedAt);
  if (entry.ongoing) return Math.max(entry.startTime, hardLimit);
  const explicit = explicitEndTime(entry);
  return explicit === null ? null : Math.max(entry.startTime, Math.min(explicit, hardLimit));
}
