import { ticketsClock } from '../tickets/a/clockState';
import type { HomeClock } from './dashModel';

/**
 * Slice 2: which face Home is in, from the ONE ticketing clock (tickets/a/clockState).
 * night = the next live night is inside its door window; after = the last night was today
 * (door closed) or yesterday; else before.
 */
export function homeClockOf(nextStartIso: string | null, nextDate: string | null, lastDate: string | null, today: string, now: number): HomeClock {
  const c = nextStartIso ? ticketsClock(nextStartIso, now) : null;
  if (c === 'door') return 'night';
  if (c === 'after' && nextDate === today) return 'after';
  return lastDate !== null && lastDate >= yesterdayOf(today) && lastDate <= today ? 'after' : 'before';
}

/** 'YYYY-MM-DD' minus one day, pure calendar arithmetic (no time zone). */
export function yesterdayOf(today: string): string {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
