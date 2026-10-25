import { ROLLOVER_HOUR } from '@/lib/programDayRollover';
import type { SessionFields } from './types';

/**
 * Minutes from the event day's midnight. A start before ROLLOVER_HOUR belongs to the
 * night before (the one day-rollover rule, src/lib/programDayRollover.ts, mirrored
 * with admin); '24:00' is midnight at the end of the day.
 */
export function mins(t: string): number {
  const h = Number(t.slice(0, 2));
  return (h < ROLLOVER_HOUR ? h + 24 : h) * 60 + Number(t.slice(3, 5));
}

/** '20:00' -> '8pm', '20:30:00' -> '8:30pm', '00:15' -> '12:15am', '24:00' -> '12am'. */
export function timeWord(t: string): string {
  const h = Number(t.slice(0, 2)) % 24;
  const m = t.slice(3, 5);
  return `${h % 12 || 12}${m !== '00' ? `:${m}` : ''}${h < 12 ? 'am' : 'pm'}`;
}

/** By start; a session with no time yet goes after every timed one. */
export function byStart(a: { start: string | null }, b: { start: string | null }): number {
  if (!a.start || !b.start) return (a.start ? 0 : 1) - (b.start ? 0 : 1);
  return mins(a.start) - mins(b.start);
}

/**
 * The session ends on the next calendar day. The stored `ends_next_day` wins when it
 * is set; otherwise it is worked out from the times (79 prod items end past midnight).
 */
export function endsNextDay(s: Pick<SessionFields, 'start' | 'end'> & { endsNextDay?: boolean | null }): boolean {
  if (typeof s.endsNextDay === 'boolean') return s.endsNextDay;
  if (!s.start || !s.end) return false;
  return mins(s.end) > 24 * 60 || mins(s.end) <= mins(s.start);
}
