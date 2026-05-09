/** Milliseconds until the next clock-hour rollover from `t` (local). */

function millisUntilNextHourBoundary(tMs: number): number {
  const d = new Date(tMs);
  d.setMilliseconds(0);
  d.setSeconds(0);
  d.setMinutes(0);
  d.setHours(d.getHours() + 1);
  return Math.max(d.getTime() - tMs, 1);
}

/** Split elapsed minutes from `start` into each local clock-hour bucket [0–23]. */
export function accumulateMinutesIntoHours(
  start: Date,
  durationMinutes: number,
  buckets: number[],
): void {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return;

  const t0 = start.getTime();
  if (!Number.isFinite(t0)) return;

  const endMs = t0 + durationMinutes * 60_000;
  if (!Number.isFinite(endMs)) return;

  let t = t0;
  let guard = 0;

  while (t < endMs && guard++ < 10_000) {
    let sliceMs = Math.min(millisUntilNextHourBoundary(t), endMs - t);
    /** Never spin if DST / float noise yields a flat slice */

    if (sliceMs <= 0) sliceMs = Math.min(60_000, endMs - t);
    if (sliceMs <= 0) break;

    const hour = new Date(t).getHours();
    buckets[hour] += sliceMs / 60_000;
    t += sliceMs;
  }
}

/** Minutes of play occurring between local midnight inclusive and 06:00 exclusive. */
export function minutesBetweenMidnightAndSixAm(start: Date, durationMinutes: number): number {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return 0;

  const t0 = start.getTime();
  if (!Number.isFinite(t0)) return 0;

  const endMs = t0 + durationMinutes * 60_000;
  if (!Number.isFinite(endMs)) return 0;

  let t = t0;
  let mins = 0;
  let guard = 0;

  while (t < endMs && guard++ < 10_000) {
    let sliceMs = Math.min(millisUntilNextHourBoundary(t), endMs - t);
    if (sliceMs <= 0) sliceMs = Math.min(60_000, endMs - t);
    if (sliceMs <= 0) break;

    const hour = new Date(t).getHours();
    if (hour >= 0 && hour < 6) mins += sliceMs / 60_000;
    t += sliceMs;
  }

  return mins;
}

/** Best 4-hour span (hours `startHour`…`startHour+3`) maximizing total attributed minutes — no midnight wrap. */
export function dominantFourHourWindow(hourBuckets: readonly number[]): {
  startHour: number;
  totalMinutes: number;
} {
  let bestSum = -1;
  let bestStart = 0;

  for (let start = 0; start <= 20; start++) {
    let sum = 0;
    for (let i = 0; i < 4; i++) sum += hourBuckets[start + i] ?? 0;
    if (sum > bestSum) {
      bestSum = sum;
      bestStart = start;
    }
  }

  return {
    startHour: bestStart,
    totalMinutes:
      hourBuckets.reduce((accum, slice) => accum + slice, 0) > 0 ?
        Math.max(0, bestSum)
      : 0,
  };
}
