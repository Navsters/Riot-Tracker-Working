import {
  differenceInCalendarDays,
  eachWeekOfInterval,
  endOfISOWeek,
  format,
  getDay,
  isValid,
  max as dateMax,
  min as dateMin,
  startOfDay,
  startOfISOWeek,
} from 'date-fns';

import type { PlaySession, ValorantMatch } from '../types/valorant';
import {
  accumulateMinutesIntoHours,
  dominantFourHourWindow,
  minutesBetweenMidnightAndSixAm,
} from './timeBuckets';
import { buildSessionsFromMatches } from './sessionsFromMatches';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export interface HabitsAnalytics {
  rangeStart: Date;
  rangeEnd: Date;
  calendarDaysSpan: number;
  totalMinutes: number;
  totalHoursPlayed: number;
  averageHoursPerWeek: number;
  averageSessionLengthHours: number;
  gamingDaysCount: number;
  longestGamingDay: { label: string; hours: number; dateKey: string };
  mostActiveWeekday: { key: number; label: string; hours: number };
  mostActiveHourWindow: { label: string; hoursInWindow: number };
  percentPlayAfterMidnight: number;
  fortyPlusHourWeekCount: number;
  gamingDaysAveragePerWeek: number;
  weeklyHoursDistribution: { weekKey: string; weekLabel: string; hours: number }[];
  weekdayDistribution: { key: number; label: string; hours: number }[];
  hourlyDistribution: { hour: number; label: string; hours: number }[];
  sessions: PlaySession[];
  recentSessions: PlaySession[];
}

function padHour(h: number): string {
  return `${h.toString().padStart(2, '0')}:00`;
}

function weekdayLabel(dayIndex: number): string {
  return WEEKDAY_LABELS[dayIndex] ?? '???';
}

function formatWindowLabel(startHour: number): string {
  const endInclusive = startHour + 3;
  return `${padHour(startHour)}-${padHour(endInclusive)}`;
}

/** Drop corrupt rows instead of poisoning min/max/date-fns formatting. */

function plausibleMatch(match: ValorantMatch): boolean {
  const { startedAt: start, durationMinutes: dur } = match;

  if (!(start instanceof Date) || !isValid(start)) return false;

  if (!Number.isFinite(dur) || dur < 5 || dur > 24 * 60) return false;

  const endTs = start.getTime() + dur * 60_000;
  if (!Number.isFinite(endTs)) return false;

  return true;
}

export function computeHabitAnalytics(matches: ValorantMatch[]): HabitsAnalytics {
  const emptyWeekdays = WEEKDAY_LABELS.map((label, key) => ({ key, label, hours: 0 }));

  const sanitized = matches.filter(plausibleMatch);

  if (!sanitized.length) {
    const now = new Date();
    return {
      rangeStart: now,
      rangeEnd: now,
      calendarDaysSpan: 1,
      totalMinutes: 0,
      totalHoursPlayed: 0,
      averageHoursPerWeek: 0,
      averageSessionLengthHours: 0,
      gamingDaysCount: 0,
      longestGamingDay: { label: '—', hours: 0, dateKey: '' },
      mostActiveWeekday: { key: 0, label: 'Sun', hours: 0 },
      mostActiveHourWindow: { label: '—', hoursInWindow: 0 },
      percentPlayAfterMidnight: 0,
      fortyPlusHourWeekCount: 0,
      gamingDaysAveragePerWeek: 0,
      weeklyHoursDistribution: [],
      weekdayDistribution: emptyWeekdays,
      hourlyDistribution: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        label: padHour(hour),
        hours: 0,
      })),
      sessions: [],
      recentSessions: [],
    };
  }

  const rangeEndRaw = dateMax(
    sanitized.map((m) => new Date(+m.startedAt + m.durationMinutes * 60_000)),
  );
  const rangeStartRaw = dateMin(sanitized.map((m) => m.startedAt));
  const calendarDaysSpan = Math.max(
    1,
    differenceInCalendarDays(rangeEndRaw, rangeStartRaw) + 1,
  );

  let totalMinutes = 0;
  let midnightSliceMinutes = 0;

  const hourlyMinutes = Array(24).fill(0) as number[];
  const weekdayMinutes = Array(7).fill(0) as number[];
  const byDayMinutes = new Map<string, number>();
  const byIsoWeekMinutes = new Map<string, number>();
  const gamingDaysISOWeekSets = new Map<string, Set<string>>();

  for (const m of sanitized) {
    totalMinutes += m.durationMinutes;

    accumulateMinutesIntoHours(m.startedAt, m.durationMinutes, hourlyMinutes);
    midnightSliceMinutes += minutesBetweenMidnightAndSixAm(m.startedAt, m.durationMinutes);

    const d0 = m.startedAt;
    weekdayMinutes[getDay(d0)] += m.durationMinutes;

    const dayKey = format(d0, 'yyyy-MM-dd');
    byDayMinutes.set(dayKey, (byDayMinutes.get(dayKey) ?? 0) + m.durationMinutes);

    const mondayStart = startOfISOWeek(startOfDay(d0));
    const weekKey = format(mondayStart, 'yyyy-MM-dd');
    byIsoWeekMinutes.set(weekKey, (byIsoWeekMinutes.get(weekKey) ?? 0) + m.durationMinutes);

    const set =
      gamingDaysISOWeekSets.get(weekKey) ?? new Set<string>();
    set.add(dayKey);
    gamingDaysISOWeekSets.set(weekKey, set);
  }

  const gamingDaysCount = byDayMinutes.size;

  let longestKey = '';
  let longestMinutes = -1;

  byDayMinutes.forEach((minutes, dateKey) => {
    if (minutes > longestMinutes) {
      longestMinutes = Math.max(minutes, 0);
      longestKey = dateKey;
    }
  });

  let longestHour = longestMinutes <= 0 ? 0 : longestMinutes / 60;
  const longestParsed = longestKey ? parseLocalDate(longestKey) : null;

  const longestDayLabel =
    longestParsed && isValid(longestParsed) ? `${format(longestParsed, 'EEE, MMM d')}` : '—';

  const uniqWeekBuckets = eachWeekOfInterval(
    {
      start: startOfISOWeek(startOfDay(rangeStartRaw)),
      end: rangeEndRaw,
    },
    { weekStartsOn: 1 },
  );

  const gamingDaysTotals = uniqWeekBuckets.map((mondayStart) => {
    const key = format(mondayStart, 'yyyy-MM-dd');
    return gamingDaysISOWeekSets.get(key)?.size ?? 0;
  });

  const gamingDaysAveragePerWeek =
    gamingDaysTotals.length ?
      gamingDaysTotals.reduce((a, b) => a + b, 0) / gamingDaysTotals.length
    : 0;

  const fortyPlusHourWeekCount = uniqWeekBuckets.filter((monday) => {
    const key = format(monday, 'yyyy-MM-dd');
    return (byIsoWeekMinutes.get(key) ?? 0) / 60 >= 40;
  }).length;

  const weekdayDistribution = weekdayMinutes.map((minutes, idx) => ({
    key: idx,
    label: weekdayLabel(idx),
    hours: minutes / 60,
  }));

  const bestWeekIdx = weekdayMinutes.reduce(
    (best, val, idx, arr) => (val > arr[best] ? idx : best),
    0,
  );
  const mostActiveWeekday = {
    key: bestWeekIdx,
    label: weekdayLabel(bestWeekIdx),
    hours: weekdayMinutes[bestWeekIdx]! / 60,
  };

  const four = dominantFourHourWindow(hourlyMinutes);
  const mostActiveHourWindow = {
    label: formatWindowLabel(four.startHour),
    hoursInWindow: four.totalMinutes / 60,
  };

  const hourlyDistribution = hourlyMinutes.map((minutes, hour) => ({
    hour,
    label: padHour(hour),
    hours: minutes / 60,
  }));

  const weeklyHoursDistribution = uniqWeekBuckets.map((weekStartMonday) => {
    const weekKey = format(weekStartMonday, 'yyyy-MM-dd');
    const mins = byIsoWeekMinutes.get(weekKey) ?? 0;
    const labelEnd = dateMin([rangeEndRaw, endOfISOWeek(weekStartMonday)]);

    return {
      weekKey,
      weekLabel: `${format(weekStartMonday, 'MMM d')} - ${format(labelEnd, 'MMM d')}`,
      hours: mins / 60,
    };
  });

  const sessions = buildSessionsFromMatches(sanitized);
  const averageSessionLengthHours =
    sessions.length ? sessions.reduce((a, s) => a + s.durationMinutes, 0) / sessions.length / 60 : 0;

  const recentSessions = [...sessions].sort((a, b) => +b.startedAt - +a.startedAt).slice(0, 20);

  return {
    rangeStart: rangeStartRaw,
    rangeEnd: rangeEndRaw,
    calendarDaysSpan,
    totalMinutes,
    totalHoursPlayed: totalMinutes / 60,
    averageHoursPerWeek: totalMinutes / 60 / (calendarDaysSpan / 7),
    averageSessionLengthHours,
    gamingDaysCount,
    longestGamingDay: {
      label: longestDayLabel,
      hours: longestHour,
      dateKey: longestKey,
    },
    mostActiveWeekday,
    mostActiveHourWindow,
    percentPlayAfterMidnight:
      totalMinutes > 0 ? (midnightSliceMinutes / totalMinutes) * 100 : 0,
    fortyPlusHourWeekCount,
    gamingDaysAveragePerWeek,
    weeklyHoursDistribution,
    weekdayDistribution,
    hourlyDistribution,
    sessions,
    recentSessions,
  };
}

function parseLocalDate(yyyyMmDd: string): Date {
  const [y, m, d] = yyyyMmDd.split('-').map((n) => Number.parseInt(n, 10));
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}
