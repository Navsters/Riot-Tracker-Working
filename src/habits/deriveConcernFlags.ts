import type { HabitsAnalytics } from '../analytics/computeHabitAnalytics';

export type ConcernSeverity = 'alert' | 'watch';

export interface ConcernFlag {
  id: string;
  severity: ConcernSeverity;
  title: string;
  detail: string;
}

/** Deterministic heuristic flags — informational, not medical advice. */

export function deriveConcernFlags(a: HabitsAnalytics): ConcernFlag[] {
  if (!a.totalMinutes) return [];

  const flags: ConcernFlag[] = [];

  if (a.fortyPlusHourWeekCount > 0) {
    flags.push({
      id: 'heavy-week-volume',
      severity: 'alert',
      title: '40+ hour Valorant weeks detected',
      detail: `${a.fortyPlusHourWeekCount} ISO week bucket${a.fortyPlusHourWeekCount === 1 ? '' : 's'} cleared 40 queued hours - that is full-time-role territory if sustained.`,
    });
  }

  if (a.averageSessionLengthHours >= 5) {
    flags.push({
      id: 'marathon-session',
      severity: 'alert',
      title: 'Long average sessions',
      detail: `Your average stint sits at ${a.averageSessionLengthHours.toFixed(1)}h. Back-to-back blocks reduce recovery time between aim sessions and sleep.`,
    });
  }

  if (a.percentPlayAfterMidnight >= 26) {
    flags.push({
      id: 'late-night-ratio',
      severity: 'watch',
      title: 'Frequent midnight-to-dawn queues',
      detail: `${a.percentPlayAfterMidnight.toFixed(1)}% of tracked minutes bleed into midnight-6 AM, which routinely cannibalizes deep sleep.`,
    });
  }

  if (a.gamingDaysAveragePerWeek >= 6) {
    flags.push({
      id: 'daily-streak-density',
      severity: 'watch',
      title: 'Near-daily stacking',
      detail: `You average ~${a.gamingDaysAveragePerWeek.toFixed(1)} gaming days weekly (unique days ≥1 ranked block). Few off-days means less unstructured recovery.`,
    });
  }

  return flags.sort((lhs, rhs) => {
    if (lhs.severity !== rhs.severity) {
      return lhs.severity === 'alert' ? -1 : 1;
    }

    return lhs.id.localeCompare(rhs.id);
  });
}
