import { TICK_INTERVAL_MS } from "./config";

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

const MINUTE = 60 * 1000;
const MAJOR_INTERVALS = [5, 10, 15, 30, 60, 120, 180].map((minutes) => minutes * MINUTE);
const MINOR_INTERVALS = [1, 2, 5, 10, 15, 30, 60].map((minutes) => minutes * MINUTE);

function intervalForMinimumGap(
  duration: number,
  plotWidth: number,
  minimumGap: number,
  candidates: number[],
): number {
  if (!Number.isFinite(plotWidth) || plotWidth <= 0 || duration <= 0) return candidates[0];
  const pixelsPerMs = plotWidth / duration;
  return candidates.find((interval) => interval * pixelsPerMs >= minimumGap)
    ?? candidates[candidates.length - 1];
}

// Kurze Faelle behalten das bekannte 1-/5-Minuten-Raster. Bei langen
// Eingriffen wird das Raster anhand der verfuegbaren Pixelbreite ausgeduennt,
// damit Linien, Zeittexte und Messwerte nicht zu einer Flaeche verschmelzen.
export function relativeTimelineTicks(
  startedAt: number,
  domainEnd: number,
  plotWidth: number = Number.POSITIVE_INFINITY,
): TimelineTicks {
  const duration = Math.max(1, domainEnd - startedAt);
  const majorInterval = intervalForMinimumGap(duration, plotWidth, 64, MAJOR_INTERVALS);
  const minorInterval = intervalForMinimumGap(duration, plotWidth, 10, MINOR_INTERVALS);
  const major = relativeTicks(startedAt, domainEnd, majorInterval);
  const majorSet = new Set(major);
  const minor = relativeTicks(startedAt, domainEnd, minorInterval).filter(
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
