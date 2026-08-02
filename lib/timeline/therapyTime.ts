import type { TherapyEndMode } from "../../types/vitals";

const MINUTE_MS = 60_000;

export function endFromDuration(startedAt: number, durationMinutes: number): number {
  return startedAt + durationMinutes * MINUTE_MS;
}

export function durationMinutesBetween(startedAt: number, endedAt: number): number {
  return (endedAt - startedAt) / MINUTE_MS;
}

export function resolveEndFromClock(
  startedAt: number,
  clock: { hour: number; minute: number; second?: number },
  explicitDate?: { year: number; month: number; day: number } | null,
): number {
  const candidate = new Date(startedAt);
  if (explicitDate) {
    candidate.setFullYear(explicitDate.year, explicitDate.month, explicitDate.day);
  }
  candidate.setHours(clock.hour, clock.minute, clock.second ?? 0, 0);
  if (!explicitDate && candidate.getTime() <= startedAt) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate.getTime();
}

export function therapyEndMode(ongoing: boolean, endedAt: number | null): TherapyEndMode {
  if (ongoing) return "ongoing";
  return endedAt === null ? "duration" : "end";
}

export function isNextLocalDay(startedAt: number, endedAt: number): boolean {
  const end = new Date(endedAt);
  const next = new Date(startedAt);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + 1);
  return end.getTime() >= next.getTime() && end.getTime() < new Date(next.getFullYear(), next.getMonth(), next.getDate() + 1).getTime();
}

export function formatLocalDateTime(timestamp: number): string {
  const value = new Date(timestamp);
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${pad(value.getDate())}.${pad(value.getMonth() + 1)}.${value.getFullYear()}, ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
}

export function validateTherapyEnd(startedAt: number, endedAt: number | null, ongoing: boolean): boolean {
  return ongoing ? endedAt === null : endedAt !== null && Number.isFinite(endedAt) && endedAt > startedAt;
}
