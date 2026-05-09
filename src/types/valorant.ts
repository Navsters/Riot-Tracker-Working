export interface ValorantMatch {
  id: string;
  /** Wall-clock timestamp when this match begins (session grouping uses this plus duration). */
  startedAt: Date;
  durationMinutes: number;
}

export interface PlaySession {
  id: string;
  startedAt: Date;
  endedAt: Date;
  durationMinutes: number;
  matchIds: string[];
}
