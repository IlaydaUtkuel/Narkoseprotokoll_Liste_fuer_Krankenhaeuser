import { TICK_INTERVAL_MS } from "./config";

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
  if (!Number.isFinite(startedAt) || !Number.isFinite(domainEnd) || domainEnd < startedAt) {
    return [];
  }
  const ticks: number[] = [];
  // Obergrenze gegen Endlosschleifen bei extremen Eingaben.
  const maxTicks = 1000;
  for (let n = 0; n < maxTicks; n += 1) {
    const t = startedAt + n * intervalMs;
    if (t > domainEnd) break;
    ticks.push(t);
  }
  return ticks;
}
