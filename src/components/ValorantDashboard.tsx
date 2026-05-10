import { type FormEvent, useLayoutEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { format, isValid } from 'date-fns';

import { computeHabitAnalytics } from '../analytics/computeHabitAnalytics';
import { generateMockValorantMatches } from '../data/generateMockValorantMatches';
import { buildHabitSummaryParagraphs } from '../habits/habitMessaging';
import { deriveConcernFlags } from '../habits/deriveConcernFlags';
import { isLikelyRiotId, normalizeRiotIdInput } from '../utils/riotId';

import type { HabitsAnalytics } from '../analytics/computeHabitAnalytics';
import type { ValorantMatch } from '../types/valorant';

const chartMuted = '#6c7f96';
const chartGrid = '#1f2937';
const chartAccent = '#ff5d75';
const chartSecondary = '#3de1e9';

// TEST UPDATE: dashboard context marker for GitHub timestamp.
const FALLBACK_ANALYTICS: HabitsAnalytics = computeHabitAnalytics([]);

function formatChartHours(value: unknown): string {
  if (value == null) return '-';
  const n = typeof value === 'number' ? value : Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isFinite(n)) return '-';
  return `${n.toFixed(1)}h`;
}

function formatSafeLocal(dateLike: Date, pattern: string) {
  return isValid(dateLike) ? format(dateLike, pattern) : '--';
}

function formatSessionDuration(durationMinutes: number): string {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = Math.round(durationMinutes % 60);

  if (hours <= 0) return `${minutes}m`;
  if (!minutes) return `${hours}h`;

  return `${hours}h ${minutes}m`;
}

function pickChartWidth(): number {
  if (typeof window === 'undefined') return 760;
  const gutter = 72;

  return Math.min(940, Math.max(320, window.innerWidth - gutter));
}

export function ValorantDashboard() {
  const [input, setInput] = useState('');
  const [submittedValue, setSubmittedValue] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [chartWidth, setChartWidth] = useState<number>(760);

  useLayoutEffect(() => {
    const sync = (): void => {
      requestAnimationFrame(() => setChartWidth(pickChartWidth()));
    };

    sync();
    window.addEventListener('resize', sync);

    return () => window.removeEventListener('resize', sync);
  }, []);

  const { matches, analytics, pipelineError } = useMemo(() => {
    if (!submittedValue) {
      return { matches: [] as ValorantMatch[], analytics: FALLBACK_ANALYTICS, pipelineError: null as string | null };
    }

    try {
      const nextMatches = generateMockValorantMatches(submittedValue, 90);
      const nextAnalytics = computeHabitAnalytics(nextMatches);

      return { matches: nextMatches, analytics: nextAnalytics, pipelineError: null };
    } catch (err) {
      console.error('[habit-dashboard] pipeline crashed', err);

      return {
        matches: [],
        analytics: FALLBACK_ANALYTICS,
        pipelineError: err instanceof Error ? err.message : String(err),
      };
    }
  }, [submittedValue]);

  const summary = useMemo(() => buildHabitSummaryParagraphs(analytics), [analytics]);

  const flags = useMemo(() => deriveConcernFlags(analytics), [analytics]);

  const handleAnalyze = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const next = normalizeRiotIdInput(input);

    if (!isLikelyRiotId(next)) {
      setFormError(
        'Use GameName#Tagline with a normal # separating both halves. Spaces and unicode gamer names are fine. If pasted text fails, rewrite the hashtag manually.',
      );
      return;
    }

    setFormError(null);
    setInput(next);
    setSubmittedValue(next);
  };

  const statTiles = [
    {
      label: 'Hours logged',
      value: analytics.totalHoursPlayed.toFixed(1),
      suffix: 'h',
      hint: 'Sum of mocked match lengths',
    },
    {
      label: 'Weekly pace',
      value: analytics.averageHoursPerWeek.toFixed(1),
      suffix: 'h / wk',
      hint: `${analytics.calendarDaysSpan}-day stretch normalized to hrs/wk`,
    },
    {
      label: 'Avg session length',
      value: analytics.averageSessionLengthHours.toFixed(2),
      suffix: 'h',
      hint: '~45 idle gap merges sessions',
    },
    {
      label: 'Distinct gaming days',
      value: String(analytics.gamingDaysCount),
      suffix: 'days',
      hint: `${analytics.gamingDaysAveragePerWeek.toFixed(1)} avg per counted ISO weeks`,
    },
    {
      label: 'Longest binge day',
      value: analytics.longestGamingDay.label,
      suffix: analytics.longestGamingDay.dateKey ?
        `${analytics.longestGamingDay.hours.toFixed(1)}h`
      : '',
      hint: 'Single-calendar-day totals (local TZ)',
    },
    {
      label: 'Peak weekday',
      value: analytics.mostActiveWeekday.label,
      suffix: `${analytics.mostActiveWeekday.hours.toFixed(1)}h credited`,
      hint: 'Credits full queues to whichever local day the match queued',
    },
    {
      label: 'Peak hour window',
      value: analytics.mostActiveHourWindow.label,
      suffix: `${analytics.mostActiveHourWindow.hoursInWindow.toFixed(1)}h`,
      hint: 'Top contiguous four-hour slab',
    },
    {
      label: 'Late-night share',
      value: analytics.percentPlayAfterMidnight.toFixed(1),
      suffix: '% midnight-6 AM',
      hint: 'Minutes sliced into that window',
    },
    {
      label: '40h+ ISO weeks',
      value: String(analytics.fortyPlusHourWeekCount),
      suffix: 'week spikes',
      hint: 'Rolling ISO buckets >= 40h',
    },
  ];

  const chartTooltipStyles = {
    backgroundColor: '#111827',
    border: '1px solid #293548',
    borderRadius: '10px',
    color: '#e5eaf3',
    fontSize: '12px',
  };

  const tickSafe = (v: unknown) => `${Number(v)}`;

  const hourChartHeight = 300;

  return (
    <div className="habit-shell">
      <header className="hero">
        <div>
          <p className="badge">Valorant mock analytics</p>
          <h1>Habit Observatory</h1>
          <p className="lede">
            Feed a public Riot ID and we blueprint the last ninety days locally - no APIs yet - so you can shape the dashboards
            before wires land.
          </p>
          <small className="assist">
            Matches are synthesized from your trimmed ID for deterministic experiments. Tune the generator inside{' '}
            <code className="inline-code">src/data/generateMockValorantMatches.ts</code>.
          </small>
        </div>

        <form className="riot-card" onSubmit={handleAnalyze}>
          <label className="input-label">
            <span>Riot ID</span>
            <input
              className="riot-input"
              autoComplete="off"
              spellCheck={false}
              placeholder="PhantomOperative#Peek"
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
          </label>
          <button className="primary-btn" type="submit">
            Run mock analysis
          </button>
          {formError ?
            <p className="form-error" role="status">
              {formError}
            </p>
          : null}
          {!submittedValue ?
            <p className="form-hint">Example format: NeonPilot#peek</p>
          : (
            <p className="form-meta">
              Current profile <strong>{submittedValue}</strong> -{' '}
              <span>{matches.length}</span> mock matches synthesized
            </p>
          )}
        </form>
      </header>

      {pipelineError ?
        <div className="chart-banner" role="alert">
          <strong>Pipeline error (mock math never reached charts)</strong>
          <pre>{pipelineError}</pre>
        </div>
      : null}

      {submittedValue ?
        <>
          <section className="grid-stats" aria-live="polite">
            {statTiles.map((tile) => (
              <article key={tile.label} className="tile">
                <p className="tile-label">{tile.label}</p>
                <div className="tile-value-row">
                  <span className="tile-value">{tile.value}</span>
                  {tile.suffix ?
                    <span className="tile-unit">{tile.suffix}</span>
                  : null}
                </div>
                {tile.hint ?
                  <p className="tile-hint">{tile.hint}</p>
                : null}
              </article>
            ))}
          </section>

          <div className="split">
            <section className="card elevation">
              <header className="card-header">
                <h2>Habit summary</h2>
                <span className="card-sub">Synthetic but instructive prose</span>
              </header>
              <div className="story">
                {summary.map((paragraph, idx) => (
                  <p key={`summary-${idx}`}>{paragraph}</p>
                ))}
              </div>
            </section>

            <section className="card elevation">
              <header className="card-header">
                <h2>Concern flags</h2>
                <span className="card-sub">Heuristic nudges, not diagnoses</span>
              </header>
              {flags.length ?
                <ul className="concern-list">
                  {flags.map((flag) => (
                    <li
                      key={flag.id}
                      className={`concern-chip ${flag.severity === 'alert' ? 'is-alert' : 'is-watch'}`}
                    >
                      <strong>{flag.title}</strong>
                      <p>{flag.detail}</p>
                    </li>
                  ))}
                </ul>
              :
                <p className="empty-concerns">
                  No scripted flags tripped - the mock profile skews sustainable this run. Swap Riot IDs to stress the
                  heuristics.
                </p>
              }
            </section>
          </div>

          <section className="chart-grid">
            <article className="card elevation chart-pane">
              <header className="card-header slim">
                <h3>Weekly hours</h3>
                <span className="card-sub">ISO buckets (minutes summed to hours)</span>
              </header>
              <div className="chart-body chart-svg-host">
                <BarChart
                  responsive={false}
                  width={chartWidth}
                  height={260}
                  data={analytics.weeklyHoursDistribution}
                  margin={{ top: 8, right: 20, bottom: 8, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} opacity={0.45} vertical={false} />
                  <XAxis
                    dataKey="weekLabel"
                    tick={{ fill: chartMuted, fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: '#2c3647' }}
                  />
                  <YAxis
                    unit=" h"
                    tick={{ fill: chartMuted, fontSize: 11 }}
                    tickFormatter={tickSafe}
                    width={54}
                    axisLine={{ stroke: '#2c3647' }}
                  />
                  <Tooltip formatter={formatChartHours} contentStyle={chartTooltipStyles} />
                  <Bar dataKey="hours" radius={[6, 6, 0, 0]} fill={chartAccent} />
                </BarChart>
              </div>
            </article>

            <article className="card elevation chart-pane">
              <header className="card-header slim">
                <h3>Weekday distribution</h3>
                <span className="card-sub">Minutes pinned to queue-start weekday</span>
              </header>
              <div className="chart-body chart-svg-host">
                <BarChart
                  responsive={false}
                  width={chartWidth}
                  height={260}
                  data={analytics.weekdayDistribution}
                  margin={{ top: 8, right: 20, bottom: 8, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 4" stroke={chartGrid} opacity={0.45} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: chartMuted, fontSize: 13 }}
                    tickLine={false}
                    axisLine={{ stroke: '#2c3647' }}
                  />
                  <YAxis
                    tick={{ fill: chartMuted, fontSize: 11 }}
                    width={54}
                    unit=" h"
                    tickFormatter={tickSafe}
                    axisLine={{ stroke: '#2c3647' }}
                  />
                  <Tooltip formatter={formatChartHours} contentStyle={chartTooltipStyles} />
                  <Bar dataKey="hours" radius={[6, 6, 0, 0]} fill={chartSecondary} />
                </BarChart>
              </div>
            </article>

            <article className="card elevation chart-pane wide">
              <header className="card-header slim">
                <h3>Hourly distribution (local)</h3>
              </header>
              <div className="chart-body chart-svg-host">
                <BarChart
                  responsive={false}
                  width={chartWidth}
                  height={hourChartHeight}
                  data={analytics.hourlyDistribution}
                  margin={{ top: 8, right: 12, bottom: 32, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} opacity={0.45} vertical={false} />
                  <XAxis
                    dataKey="label"
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={70}
                    tick={{ fill: chartMuted, fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: '#2c3647' }}
                  />
                  <YAxis tick={{ fill: chartMuted, fontSize: 11 }} width={54} axisLine={{ stroke: '#2c3647' }} />
                  <Tooltip formatter={formatChartHours} contentStyle={chartTooltipStyles} />
                  <Bar dataKey="hours" radius={[4, 4, 0, 0]} fill="#9d7dff" />
                </BarChart>
              </div>
            </article>
          </section>

          <section className="card elevation table-card">
            <header className="card-header slim">
              <h3>Recent sessions</h3>
              <span className="card-sub">Grouped when idle gaps exceed ~45 minutes</span>
            </header>
            <div className="table-wrap">
              <table className="sessions-table">
                <thead>
                  <tr>
                    <th scope="col">Kickoff (local)</th>
                    <th scope="col">Ends (local)</th>
                    <th scope="col">Length</th>
                    <th scope="col">Matches</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.recentSessions.map((session) => (
                    <tr key={session.id}>
                      <td>{formatSafeLocal(session.startedAt, 'EEE MMM d · h:mm a')}</td>
                      <td>{formatSafeLocal(session.endedAt, 'MMM d · h:mm a')}</td>
                      <td>{formatSessionDuration(session.durationMinutes)}</td>
                      <td>{session.matchIds.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      : null}
    </div>
  );
}
