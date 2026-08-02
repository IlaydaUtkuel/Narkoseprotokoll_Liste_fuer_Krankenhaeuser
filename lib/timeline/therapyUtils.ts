export interface DurationSource {
  startedAt: number;
  endedAt: number | null;
  ongoing: boolean;
}

export function explicitEndTime(entry: DurationSource): number | null {
  return entry.endedAt;
}

export function displayEndTime(
  entry: DurationSource,
  currentTime: number,
  endedAt: number | null,
): number | null {
  const runningLimit = endedAt === null ? currentTime : Math.min(currentTime, endedAt);
  if (entry.ongoing) return Math.max(entry.startedAt, runningLimit);
  const explicit = explicitEndTime(entry);
  if (explicit === null) return null;
  const explicitLimit = endedAt === null ? explicit : Math.min(explicit, endedAt);
  return Math.max(entry.startedAt, explicitLimit);
}
