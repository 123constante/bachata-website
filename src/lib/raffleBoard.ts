// Raffle v2 board mapping (pure, total). Codes to the keys of raffle_public_board_v1 in the
// admin R0 migration (pool_count, winners_this_month, total_winners,
// nights[{occurrence_id, public_event_id, title, start, venue, winner_first_name}]).
// The real reply has not been read (not applied at the time of writing).
import { addDaysToKey, londonDateKey, weekdayOfKey } from '@/lib/londonDate';

export type RaffleNight = {
  occurrenceId: string;
  publicEventId: string;
  title: string;
  start: string;
  venue: string | null;
  winnerFirstName: string | null;
};

export type RaffleBoard = {
  poolCount: number;
  winnersThisMonth: number;
  totalWinners: number;
  nights: RaffleNight[];
};

export const emptyRaffleBoard = (): RaffleBoard => ({
  poolCount: 0,
  winnersThisMonth: 0,
  totalWinners: 0,
  nights: [],
});

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const count = (v: unknown): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null;

function parseNight(raw: unknown): RaffleNight | null {
  if (!isObj(raw)) return null;
  const occurrenceId = str(raw.occurrence_id);
  const publicEventId = str(raw.public_event_id);
  const start = str(raw.start);
  if (!occurrenceId || !publicEventId || !start || Number.isNaN(Date.parse(start))) return null;
  return {
    occurrenceId,
    publicEventId,
    title: str(raw.title) ?? '',
    start,
    venue: str(raw.venue),
    winnerFirstName: str(raw.winner_first_name),
  };
}

export function parseRaffleBoard(json: unknown): RaffleBoard {
  if (!isObj(json)) return emptyRaffleBoard();
  const nights = Array.isArray(json.nights)
    ? json.nights.map(parseNight).filter((n): n is RaffleNight => n !== null)
    : [];
  return {
    poolCount: count(json.pool_count),
    winnersThisMonth: count(json.winners_this_month),
    totalWinners: count(json.total_winners),
    nights,
  };
}

export type EventBoardState = {
  inRaffle: boolean;
  winnerFirstName: string | null;
  night: RaffleNight | null;
};

/** Earliest upcoming matching night wins (reversible default, R3 open question 1). */
export function boardForEvent(board: RaffleBoard, publicEventId: string): EventBoardState {
  let best: RaffleNight | null = null;
  for (const n of board.nights) {
    if (n.publicEventId !== publicEventId) continue;
    if (!best || Date.parse(n.start) < Date.parse(best.start)) best = n;
  }
  return best
    ? { inRaffle: true, winnerFirstName: best.winnerFirstName, night: best }
    : { inRaffle: false, winnerFirstName: null, night: null };
}

// `start` may be an ISO instant (zone given) or a London wall clock (no zone).
const ZONED = /(Z|[+-]\d\d(:?\d\d)?)$/i;
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
