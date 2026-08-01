import { MINOR_TICK_INTERVAL_MS, TICK_INTERVAL_MS } from "./config";

export interface TimelineTicks {
  major: number[];
  minor: number[];
}

export function relativeTicks(
  startedAt: number,
  domainEnd: number,
  intervalMs: number,
): number[] {
  if (
    !Number.isFinite(startedAt) ||
    !Number.isFinite(domainEnd) ||
    !Number.isFinite(intervalMs) ||
    intervalMs <= 0 ||
    domainEnd < startedAt
  ) {
    return [];
  }
  const ticks: number[] = [];
  const maxTicks = 5000;
  for (let n = 0; n < maxTicks; n += 1) {
    const t = startedAt + n * intervalMs;
    if (t > domainEnd) break;
    ticks.push(t);
  }
  return ticks;
}

export function relativeTimelineTicks(startedAt: number, domainEnd: number): TimelineTicks {
  const major = relativeTicks(startedAt, domainEnd, TICK_INTERVAL_MS);
  const majorSet = new Set(major);
  const minor = relativeTicks(startedAt, domainEnd, MINOR_TICK_INTERVAL_MS).filter(
    (tick) => !majorSet.has(tick),
  );
  return { major, minor };
}

/**
 * Erzeugt 5-Minuten-Ticks RELATIV zur Startzeit, nicht zur Wanduhr.
 * Beispiel: Start 19:03:27 -> Ticks 19:03, 19:08, 19:13 ... (jeweils startedAt + n*5min).
 * Die Tick-Timestamps behalten die Sekunden der Startzeit; die Beschriftung (HH:mm)
 * erfolgt an anderer Stelle.
 */
export function relativeFiveMinuteTicks(
  startedAt: number,
  domainEnd: number,
  intervalMs: number = TICK_INTERVAL_MS,
): number[] {
  return relativeTicks(startedAt, domainEnd, intervalMs);
}
