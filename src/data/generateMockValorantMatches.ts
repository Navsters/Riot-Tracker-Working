import {
  addMinutes,
  eachDayOfInterval,
  eachWeekOfInterval,
  endOfISOWeek,
  max as dateMax,
  min as dateMin,
  startOfDay,
  subDays,
} from 'date-fns';

import type { ValorantMatch } from '../types/valorant';
import { createSeededRandom, hashString } from '../lib/seededRandom';
import { normalizeRiotIdInput } from '../utils/riotId';

const MIN_MATCH = 26;
const MAX_MATCH = 54;

/** ~90 rolling local days emphasizing evening blocks, sporadic sunrise queues, weekly volumes ~39–53h. */

export function generateMockValorantMatches(riotId: string, horizonDays = 90): ValorantMatch[] {
  const canon = normalizeRiotIdInput(riotId);
  const normalized = canon.length ? canon.toUpperCase() : 'AGENT#000';
  const rng = createSeededRandom(hashString(normalized));

  const windowEnd = new Date();
  const windowStart = startOfDay(subDays(windowEnd, horizonDays));

  const weekStarts = eachWeekOfInterval({ start: windowStart, end: windowEnd }, { weekStartsOn: 1 });

  const matches: ValorantMatch[] = [];
  let matchSeq = 0;

  const firstStartAnchor = (day: Date): Date => {
    const midnight = startOfDay(day);
    const roll = rng();

    let offsetMinutes: number;
    if (roll < 0.82) {
      offsetMinutes = Math.round((15 + rng() * 11.75) * 60 + rng() * 45);
    } else if (roll < 0.96) {
      offsetMinutes = Math.round((13 + rng() * 2.5) * 60 + rng() * 50);
    } else {
      offsetMinutes = Math.round((10 + rng() * 1.9) * 60 + rng() * 55);
    }

    return addMinutes(midnight, offsetMinutes);
  };

  const pushDaySessions = (
    playableDay: Date,
    quotaMinutesFloat: number,
  ) => {
    let quota = Math.floor(Math.max(quotaMinutesFloat, 0));
    if (quota < MIN_MATCH) return;

    let cursor = firstStartAnchor(playableDay);

    while (quota >= MIN_MATCH && +cursor <= +windowEnd) {
      const dur = Math.min(
        MAX_MATCH,
        Math.max(MIN_MATCH, Math.round(MIN_MATCH + rng() * (MAX_MATCH - MIN_MATCH))),
        quota,
      );

      const startedAt = new Date(+cursor);

      matches.push({
        id: `mock-${matchSeq++}`,
        startedAt,
        durationMinutes: dur,
      });

      quota -= dur;
      const gapMinutes = Math.round((4 + rng() * 32) ** 1.035);
      cursor = addMinutes(startedAt, dur + gapMinutes);
    }
  };

  for (const weekMonday of weekStarts) {
    const sliceStart = dateMax([windowStart, weekMonday]);
    const sliceEnd = dateMin([windowEnd, endOfISOWeek(weekMonday)]);

    const sliceT0 = sliceStart.getTime();
    const sliceT1 = sliceEnd.getTime();
    if (!Number.isFinite(sliceT0) || !Number.isFinite(sliceT1) || sliceT0 > sliceT1) continue;

    /** `eachDayOfInterval` mutates `interval.start`; never pass `windowStart` by reference or it walks forward every week */

    const intervalStart = new Date(sliceT0);
    const intervalEnd = new Date(sliceT1);

    const calendarDays = eachDayOfInterval({
      start: intervalStart,
      end: intervalEnd,
    });

    /** Empty slice skips all downstream quota math */

    if (!calendarDays.length) continue;

    const playableDaysRaw = calendarDays.map((day) => ({
      day,
      eligible: rng() > 0.18,
      weight: 0.42 + rng() * 2.08,
    }));

    let bucket = playableDaysRaw.filter((d) => d.eligible);

    if (!bucket.length && playableDaysRaw.length > 0) {
      const len = playableDaysRaw.length;
      /** Floor can theoretically land equal to length with float noise near 1 → clamp */

      const idx = Math.min(len - 1, Math.max(0, Math.floor(rng() * len)));
      const pin = playableDaysRaw[idx];

      if (pin) pin.eligible = true;

      bucket = playableDaysRaw.filter((d) => d.eligible);
    }

    /** Need at least one day or `bucket[0]` is undefined in the night-cap block */

    if (!bucket.length) continue;

    const weeklyMinutes = Math.round(
      Math.min(58 * 60, Math.max(39 * 60, (43.5 + (rng() - 0.5) * 8.5) * 60)),
    );

    const weightSum = bucket.reduce((accum, row) => accum + row.weight, 0);

    if (!(weightSum > 0) || !Number.isFinite(weightSum)) continue;

    const quotas = bucket.map((row) => (weeklyMinutes * row.weight) / weightSum);

    bucket.forEach((row, idx) => {
      pushDaySessions(row.day, quotas[idx] ?? 0);
    });

    if (rng() > 0.78 && bucket.length) {
      const row = bucket[Math.floor(rng() * bucket.length)]!;
      pushDaySessions(row.day, Math.round(rng() * 80 + 30));
    }
  }

  return matches
    .filter((m) => +m.startedAt >= +windowStart && +m.startedAt <= +windowEnd)
    .sort((a, b) => +a.startedAt - +b.startedAt);
}
