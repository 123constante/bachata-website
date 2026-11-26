// Raffle v2 board mapping (pure, total). Codes to the keys of raffle_public_board_v1 in the
// admin R0 migration (pool_count, winners_this_month, total_winners,
// nights[{occurrence_id, public_event_id, title, start_local, venue_name, winner_first_name}]).
// Keys verified against the live function definition on prod (read-only). start_local is a UTC
// wall clock with NO zone ('YYYY-MM-DDTHH24:MI:SS' of materialised_start_utc AT TIME ZONE 'UTC').
import { addDaysToKey, londonDateKey, weekdayOfKey } from '@/lib/londonDate';

/** The jsonb keys each night carries in raffle_public_board_v1 (prod definition, read-only,
 *  2026-11-10). One shared list: the parser reads ONLY these and the fixtures are checked
 *  against it, so a fixture with made-up keys (start / venue) goes red. */
export const RAFFLE_BOARD_NIGHT_KEYS = [
  'occurrence_id',
  'public_event_id',
  'title',
  'start_local',
  'venue_name',
  'winner_first_name',
  'winners_count',
  'seats_left',
  'winners',
] as const;

export type RaffleWinnerChip = { firstName: string; avatarUrl: string | null; profileSlug: string | null };

export type RaffleNight = {
  occurrenceId: string;
  publicEventId: string;
  title: string;
  start: string;
  venue: string | null;
  winnerFirstName: string | null;
  /** Seats the night draws (1..5); absent on an old reply. */
  winnersCount?: number;
  /** Free seats left; absent on an old reply. */
  seatsLeft?: number;
  /** Every locked/attended winner, oldest first; empty when none. */
  winnerNames: string[];
  /** One per listed winner with a first name, same order as winners[]; the extra keys are optional on the wire. */
  winnerChips: RaffleWinnerChip[];
  /** Flyer URL from nights[].poster_url; absent when the board sends none. */
  posterUrl?: string;
};

/** Top-level `winners[]` of the board JSON (claimed + visible only, max 12, last 7 days). */
export type RaffleWinner = { firstName: string; nightTitle: string; wonAt: string | null; profileSlug?: string; lastInitial?: string };

export type RaffleBoard = {
  poolCount: number;
  winnersThisMonth: number;
  totalWinners: number;
  /** All-time totals from winners_ever / entries_ever; null when the key is absent or not a number. */
  winnersEver: number | null;
  entriesEver: number | null;
  nights: RaffleNight[];
  /** Present only when the JSON carried at least one valid winner. */
  winners?: RaffleWinner[];
};

export const emptyRaffleBoard = (): RaffleBoard => ({
  poolCount: 0,
  winnersThisMonth: 0,
  totalWinners: 0,
  winnersEver: null,
  entriesEver: null,
  nights: [],
});

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const count = (v: unknown): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};

const countOrNull = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
};

// A zone-less 'YYYY-MM-DDTHH:MM:SS' from the RPC is UTC: make that explicit.
const ZONE_TAIL = /(Z|[+-]\d\d(:?\d\d)?)$/i;
const asUtcInstant = (s: string): string => (ZONE_TAIL.test(s) ? s : `${s.replace(' ', 'T')}Z`);

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null;

function parseNight(raw: unknown): RaffleNight | null {
  if (!isObj(raw)) return null;
  const occurrenceId = str(raw.occurrence_id);
  const publicEventId = str(raw.public_event_id);
  const rawStart = str(raw.start_local);
  const start = rawStart ? asUtcInstant(rawStart) : null;
  if (!occurrenceId || !publicEventId || !start || Number.isNaN(Date.parse(start))) return null;
  const posterUrl = str(raw.poster_url);
  const winnerFirstName = str(raw.winner_first_name);
  const winnersCount = countOrNull(raw.winners_count);
  const seatsLeft = countOrNull(raw.seats_left);
  const listed = Array.isArray(raw.winners)
    ? raw.winners.map((w) => (isObj(w) ? str(w.first_name) : null)).filter((x): x is string => x !== null)
    : null;
  const winnerNames = listed ?? (winnerFirstName ? [winnerFirstName] : []);
  const winnerChips: RaffleWinnerChip[] = Array.isArray(raw.winners)
    ? raw.winners.flatMap((w) => {
        const firstName = isObj(w) ? str(w.first_name) : null;
        return isObj(w) && firstName
          ? [{ firstName, avatarUrl: str(w.avatar_url), profileSlug: str(w.profile_slug) }]
          : [];
      })
    : [];
  return {
    occurrenceId,
    publicEventId,
    title: str(raw.title) ?? '',
    start,
    venue: str(raw.venue_name),
    winnerFirstName,
    winnerNames,
    winnerChips,
    ...(winnersCount !== null ? { winnersCount } : {}),
    ...(seatsLeft !== null ? { seatsLeft } : {}),
    ...(posterUrl ? { posterUrl } : {}),
  };
}

export function parseRaffleBoard(json: unknown): RaffleBoard {
  if (!isObj(json)) return emptyRaffleBoard();
  const nights = Array.isArray(json.nights)
    ? json.nights.map(parseNight).filter((n): n is RaffleNight => n !== null)
    : [];
  const winners = (Array.isArray(json.winners) ? json.winners : [])
    .map((w): RaffleWinner | null => {
      if (!isObj(w)) return null;
      const firstName = str(w.first_name);
      if (!firstName) return null;
      const profileSlug = str(w.profile_slug);
      const lastInitial = str(w.last_initial)?.charAt(0).toUpperCase();
      return {
        firstName,
        nightTitle: str(w.night_title) ?? '',
        wonAt: str(w.won_at),
        ...(profileSlug ? { profileSlug } : {}),
        ...(lastInitial ? { lastInitial } : {}),
      };
    })
    .filter((w): w is RaffleWinner => w !== null)
    .slice(0, 12);
  return {
    poolCount: count(json.pool_count),
    winnersThisMonth: count(json.winners_this_month),
    totalWinners: count(json.total_winners),
    winnersEver: countOrNull(json.winners_ever),
    entriesEver: countOrNull(json.entries_ever),
    nights,
    ...(winners.length > 0 ? { winners } : {}),
  };
}

/** VITE_ENABLE_RAFFLE_MULTI_WINNER: anything but 'false' = ON; 'false' = today's single-winner rules. */
export const multiWinnerOn = (): boolean => import.meta.env.VITE_ENABLE_RAFFLE_MULTI_WINNER !== 'false';

/** Open while a seat is free; an old reply (no seats_left) keeps today's rule (no winner yet). */
export const nightIsOpen = (n: RaffleNight): boolean =>
  multiWinnerOn() && n.seatsLeft !== undefined ? n.seatsLeft > 0 : !n.winnerFirstName;

/** `Ana`, `Ana, Ben`, `Ana, Ben and Cleo`; null when nobody has won. */
export const winnerNamesLabel = (n: RaffleNight): string | null => {
  const names = multiWinnerOn() ? n.winnerNames : n.winnerFirstName ? [n.winnerFirstName] : [];
  if (names.length === 0) return null;
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

/** Winners (people) across the listed nights; today's night count when the flag is off. */
export const winnersListedCount = (board: RaffleBoard): number =>
  multiWinnerOn()
    ? board.nights.reduce((sum, n) => sum + n.winnerNames.length, 0)
    : nightsWithWinner(board).length;

export type EventBoardState = {
  inRaffle: boolean;
  winnerFirstName: string | null;
  night: RaffleNight | null;
};

/** Earliest night whose London date is today or later (the RPC also sends yesterday's). */
export function boardForEvent(board: RaffleBoard, publicEventId: string, now: Date = new Date()): EventBoardState {
  const today = londonDateKey(now);
  let best: RaffleNight | null = null;
  for (const n of board.nights) {
    if (n.publicEventId !== publicEventId) continue;
    const k = londonKeyOf(n.start);
    if (k === null || k < today) continue;
    if (!best || Date.parse(n.start) < Date.parse(best.start)) best = n;
  }
  return best
    ? { inRaffle: true, winnerFirstName: winnerNamesLabel(best), night: best }
    : { inRaffle: false, winnerFirstName: null, night: null };
}

/** Winners the RPC defines for this raffle: nights carrying a winner_first_name. */
export const nightsWithWinner = (board: RaffleBoard): RaffleNight[] =>
  board.nights.filter((n) => n.winnerFirstName !== null);

/** One night per event: the earliest start for each publicEventId, ordered by that start. */
export const nextNightPerEvent = (nights: RaffleNight[]): RaffleNight[] => {
  const best = new Map<string, RaffleNight>();
  for (const n of nights) {
    const cur = best.get(n.publicEventId);
    if (!cur || n.start < cur.start) best.set(n.publicEventId, n);
  }
  return [...best.values()].sort((x, y) => (x.start < y.start ? -1 : x.start > y.start ? 1 : 0));
};

// `start` is normally an ISO instant (parseNight adds Z); a zone-less value reads as a London date.
const ZONED = ZONE_TAIL;
function londonKeyOf(start: string): string | null {
  if (ZONED.test(start)) {
    const d = new Date(start);
    return Number.isNaN(d.getTime()) ? null : londonDateKey(d);
  }
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(start);
  return m ? m[1] : null;
}

/** Nights WITH a winner whose London date falls in the London Monday-Sunday week of `now`. */
export function thisWeeksWinners(board: RaffleBoard, now: Date): RaffleNight[] {
  const today = londonDateKey(now);
  const sinceMonday = (weekdayOfKey(today) + 6) % 7;
  const monday = addDaysToKey(today, -sinceMonday);
  const nextMonday = addDaysToKey(monday, 7);
  return board.nights
    .filter((n) => {
      if (!n.winnerFirstName) return false;
      const k = londonKeyOf(n.start);
      return k !== null && k >= monday && k < nextMonday;
    })
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}
