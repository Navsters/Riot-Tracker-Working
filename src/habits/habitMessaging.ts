import type { HabitsAnalytics } from '../analytics/computeHabitAnalytics';

const fmtHours = (h: number) => `${h >= 100 ? Math.round(h) : h.toFixed(1)}h`;
const pct = (n: number) => `${n >= 100 ? Math.round(n) : n.toFixed(1)}%`;

/** Plain-language synopsis for dashboard card copy. */

export function buildHabitSummaryParagraphs(a: HabitsAnalytics): string[] {
  if (!a.totalMinutes) {
    return [
      'No matches found in this window yet. Plug in your Riot ID and run the mock generator to visualize the habit engine.',
    ];
  }

  const peakShare =
    a.mostActiveHourWindow.hoursInWindow > 0 && a.totalHoursPlayed > 0 ?
      Math.min(
        100,
        Math.max(
          0,
          (a.mostActiveHourWindow.hoursInWindow / a.totalHoursPlayed) * 100,
        ),
      )
    : 0;

  return [
    `Across ${fmtHours(a.totalHoursPlayed)} (${a.calendarDaysSpan} counted days), you average about ${fmtHours(a.averageHoursPerWeek)} per week - similar to treating Valorant like a brisk part-time commitment.`,
    `Sessions average ${fmtHours(a.averageSessionLengthHours)} each, you actually show up on ${a.gamingDaysCount} separate days (≈${a.gamingDaysAveragePerWeek.toFixed(1)} days each week when weeks exist), with your heaviest grind landing on ${a.longestGamingDay.label} at ${fmtHours(a.longestGamingDay.hours)}.`,
    `${a.mostActiveWeekday.label} edges out as your most active weekday, while ${a.mostActiveHourWindow.label} local captures the densest contiguous four-hour spike (~${pct(peakShare)} of tracked time). Roughly ${pct(a.percentPlayAfterMidnight)} of match time overlaps with midnight-6 AM.`,
    `${a.fortyPlusHourWeekCount} ISO week${a.fortyPlusHourWeekCount === 1 ? '' : 's'} breached 40 queued hours alone - double-check burnout risk if that's recurring rather than seasonal.`,
  ];
}
