import type { RaffleNight } from '../events/raffle/raffleModel';
import type { NightCount } from '../dash/pastNights';
import { shortDay } from './r4EventsModel';
import { gbp, hasSales, moneyQuietOf, type R4MoneyRead } from './r4MoneyModel';

/**
 * Board R4Compare (flag organiserR4): ONE event's past nights ranked by people who came.
 * Reads: organiser_raffle_nights_v1 (every night of the series, with its chip) and ticket_door_list_v3 per
 * past night (in_count = came, total_count = tickets). The board's Money switch ranks the same nights by
 * net money (ticket_sales_by_night_v1). A night with no door count (null or 0 came) is not ranked by people;
 * a night with no sale is not ranked by money.
 */
export const R4_COMPARE_CAP = 8;

export interface R4CompareRow { key: string; occurrenceId: string; date: string; day: string; came: number; line: string; quiet?: string | null }

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

/** "Every Friday" only when every night (a cancelled week still keeps the cadence) is 7 days after the one before; else null. */
export function everyWord(nights: readonly RaffleNight[]): string | null {
  if (nights.length < 2) return null;
  for (let i = 1; i < nights.length; i++) if (dayMs(nights[i].date) - dayMs(nights[i - 1].date) !== 7 * 86_400_000) return null;
  return `Every ${WEEKDAYS[new Date(dayMs(nights[0].date)).getUTCDay()]}`;
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
  const all = i.nights.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const sub = [everyWord(all), nightOfWord(live, i.today)].filter(Boolean).join(', ') || null;
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

// ---- slice (b): the Money switch, ranked by net per night ----

export const R4_COMPARE_MONEY_COPY = {
  empty: 'No night has a ticket sale yet. Once one does, it shows here, most money first.',
  truncated: 'Only the first 400 nights of this event are counted.',
  pool: (amount: string) => `${amount} from tickets not tied to one night is not in this list.`,
} as const;

/** The same past nights as the people ranking, ranked by net money (gross less refunds, booking fees left out). */
export function r4CompareMoneyOf(i: { nights: readonly RaffleNight[]; today: string; money: R4MoneyRead }): R4CompareModel {
  const live = liveNightsOf(i.nights);
  const all = i.nights.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const sub = [everyWord(all), nightOfWord(live, i.today)].filter(Boolean).join(', ') || null;
  const past = pastToReadOf(i.nights, i.today);
  const byId = new Map(i.money.kind === 'ok' ? i.money.nights.map((n) => [n.occurrenceId, n]) : []);
  const rows: (R4CompareRow & { net: number })[] = [];
  for (const n of past) {
    const m = byId.get(n.occurrenceId);
    if (!m || !hasSales(m)) continue;
    const parts = [`${gbp(m.netPence)} in`];
    if (m.ticketsSold > 0) parts.push(`${m.ticketsSold.toLocaleString('en-GB')} ${m.ticketsSold === 1 ? 'ticket' : 'tickets'}`);
    rows.push({ key: n.occurrenceId, occurrenceId: n.occurrenceId, date: n.date, day: shortDay(n.date), came: 0, net: m.netPence, line: parts.join(', '), quiet: moneyQuietOf(m) });
  }
  rows.sort((a, b) => b.net - a.net || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const foot: string[] = [R4_COMPARE_COPY.foot];
  if (i.money.kind === 'ok' && i.money.truncated) foot.push(R4_COMPARE_MONEY_COPY.truncated);
  if (i.money.kind === 'ok' && i.money.noNight && i.money.noNight.netPence !== 0) foot.push(R4_COMPARE_MONEY_COPY.pool(gbp(i.money.noNight.netPence)));
  return {
    sub,
    rows: rows.map(({ net: _net, ...r }) => r),
    empty: rows.length ? null : past.length ? R4_COMPARE_MONEY_COPY.empty : R4_COMPARE_COPY.noPast,
    foot: foot.join(' '),
  };
}
