import type { RaffleNight } from '../events/raffle/raffleModel';
import type { NightCount } from '../dash/pastNights';
import { shortDay } from './r4EventsModel';

/**
 * Board R4Compare (flag organiserR4): ONE event's past nights ranked by people who came.
 * Reads: organiser_raffle_nights_v1 (every night of the series, with its chip) and ticket_door_list_v3 per
 * past night (in_count = came, total_count = tickets). No money-per-night read exists, so the board's Money
 * toggle and the amount column are not drawn. A night with no door count (null or 0 came) is not ranked.
 */
export const R4_COMPARE_CAP = 8;

export interface R4CompareRow { key: string; occurrenceId: string; date: string; day: string; came: number; line: string }

export interface R4CompareModel {
  /** "Every Friday, night 3 of 13" pieces that have a read; null when none. */
  sub: string | null;
  rows: R4CompareRow[];
  /** Shown when nothing ranks. */
  empty: string | null;
  /** The foot line: cancelled nights always; unscanned nights too when some were left out. */
  foot: string;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayMs = (iso: string) => Date.parse(`${iso}T12:00:00Z`);

/** The nights that count (not cancelled), oldest first. */
export function liveNightsOf(nights: readonly RaffleNight[]): RaffleNight[] {
  return nights.filter((n) => n.chip !== 'cancelled').slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** "Every Friday" only when every live night is 7 days after the one before (two nights at least); else null. */
export function everyWord(live: readonly RaffleNight[]): string | null {
  if (live.length < 2) return null;
  for (let i = 1; i < live.length; i++) if (dayMs(live[i].date) - dayMs(live[i - 1].date) !== 7 * 86_400_000) return null;
  return `Every ${WEEKDAYS[new Date(dayMs(live[0].date)).getUTCDay()]}`;
}

/** "night 3 of 13": the latest night that has happened (today counts) of every live night. Null for one night or none yet. */
export function nightOfWord(live: readonly RaffleNight[], today: string): string | null {
  if (live.length < 2) return null;
  const done = live.filter((n) => n.date <= today).length;
  return done > 0 ? `night ${done} of ${live.length}` : null;
}

/** The past nights to read counts for: live, before today, most recent first, capped. */
export function pastToReadOf(nights: readonly RaffleNight[], today: string, cap = R4_COMPARE_CAP): RaffleNight[] {
  return liveNightsOf(nights).filter((n) => n.date < today).reverse().slice(0, cap);
}

export const R4_COMPARE_COPY = {
  empty: 'No night has a count yet. Scan tickets at the door and each night shows here, most people first.',
  noPast: 'No night has happened yet. Once one has, it shows here.',
  foot: 'Cancelled nights are left out.',
  footUnscanned: 'Cancelled nights and nights with no tickets scanned are left out.',
} as const;

export function r4CompareOf(i: { nights: readonly RaffleNight[]; today: string; counts: ReadonlyMap<string, NightCount | undefined> }): R4CompareModel {
  const live = liveNightsOf(i.nights);
  const sub = [everyWord(live), nightOfWord(live, i.today)].filter(Boolean).join(', ') || null;
  const past = pastToReadOf(i.nights, i.today);
  const rows: R4CompareRow[] = [];
  for (const n of past) {
    const c = i.counts.get(n.occurrenceId);
    if (!c || c.cameIn === null || c.cameIn <= 0) continue;
    const parts = [`${c.cameIn.toLocaleString('en-GB')} came`];
    if (c.ticketsSold !== null) parts.push(`${c.ticketsSold.toLocaleString('en-GB')} ${c.ticketsSold === 1 ? 'ticket' : 'tickets'}`);
    rows.push({ key: n.occurrenceId, occurrenceId: n.occurrenceId, date: n.date, day: shortDay(n.date), came: c.cameIn, line: parts.join(', ') });
  }
  rows.sort((a, b) => b.came - a.came || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const unscanned = past.length - rows.length;
  return {
    sub,
    rows,
    empty: rows.length ? null : past.length ? R4_COMPARE_COPY.empty : R4_COMPARE_COPY.noPast,
    foot: unscanned > 0 && rows.length > 0 ? R4_COMPARE_COPY.footUnscanned : R4_COMPARE_COPY.foot,
  };
}
