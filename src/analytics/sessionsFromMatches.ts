import type { PlaySession, ValorantMatch } from '../types/valorant';

const SESSION_GAP_MS = 45 * 60_000;

function matchEnd(ms: Date, durationMinutes: number): Date {
  return new Date(+ms + durationMinutes * 60_000);
}

/** Consecutive queues where idle time between queues stays under ~45 minutes. */

export function buildSessionsFromMatches(matches: ValorantMatch[]): PlaySession[] {
  if (!matches.length) return [];

  const sorted = [...matches].sort((a, b) => +a.startedAt - +b.startedAt);
  const sessions: PlaySession[] = [];
  let id = 0;

  let start = sorted[0]!.startedAt;
  let end = matchEnd(sorted[0]!.startedAt, sorted[0]!.durationMinutes);
  let durationMinutes = sorted[0]!.durationMinutes;
  const ids: string[] = [sorted[0]!.id];

  const flush = () => {
    id += 1;
    sessions.push({
      id: `session-${id}`,
      startedAt: new Date(+start),
      endedAt: new Date(+end),
      durationMinutes: Math.round(durationMinutes * 10) / 10,
      matchIds: [...ids],
    });
  };

  for (let i = 1; i < sorted.length; i++) {
    const m = sorted[i]!;
    const gap = +m.startedAt - +end;

    if (gap <= SESSION_GAP_MS) {
      end = matchEnd(m.startedAt, m.durationMinutes);
      durationMinutes += m.durationMinutes;
      ids.push(m.id);
      continue;
    }

    flush();
    start = m.startedAt;
    end = matchEnd(m.startedAt, m.durationMinutes);
    durationMinutes = m.durationMinutes;
    ids.length = 0;
    ids.push(m.id);
  }

  flush();

  return sessions;
}
