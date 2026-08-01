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
  const runningLimit = endedAt === null ? currentTime : Math.min(currentTime, endedAt);
  if (entry.ongoing) return Math.max(entry.startTime, runningLimit);
  const explicit = explicitEndTime(entry);
  if (explicit === null) return null;
  const explicitLimit = endedAt === null ? explicit : Math.min(explicit, endedAt);
  return Math.max(entry.startTime, explicitLimit);
}
