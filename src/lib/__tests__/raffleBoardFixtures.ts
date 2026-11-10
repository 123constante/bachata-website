// Shared board shapes: one fixture feeds the tile and /raffles so they agree.
// Keys are the REAL raffle_public_board_v1 jsonb_build_object keys (prod definition, read-only):
// occurrence_id, public_event_id, title, start_local (UTC wall clock, no zone), venue_name,
// winner_first_name. Do not rename them to what the UI would like.
export const EVENT_ID = 'evt-1';
const night = (over: Record<string, unknown> = {}) => ({
  occurrence_id: 'occ-1', public_event_id: EVENT_ID, title: 'Friday Social',
  start_local: '2026-11-06T19:00:00', venue_name: 'The Cellar', winner_first_name: null, ...over,
});
const base = { pool_count: 12, winners_this_month: 2, total_winners: 7 };

export type Shape = {
  name: string;
  json: unknown; // null = board error
  tileInRaffle: boolean;
  tileNote?: 'empty' | 'loading' | 'error';
  seeWho?: boolean;
  tileWinner: string | null;
  pagePool: number | null;
  pageWeekWinners: string[];
};

export const BOARD_SHAPES: Shape[] = [
  { name: 'empty', json: { pool_count: 0, winners_this_month: 0, total_winners: 0, nights: [] },
    tileInRaffle: false, tileNote: 'empty', seeWho: false, tileWinner: null, pagePool: 0, pageWeekWinners: [] },
  // Prod shape: ~766 attendance pairs counted in total_winners, no night has a winner.
  { name: 'prod: total_winners 766, no winner nights', json: { pool_count: 521, winners_this_month: 40, total_winners: 766, nights: [night()] },
    tileInRaffle: true, seeWho: false, tileWinner: null, pagePool: 521, pageWeekWinners: [] },
  { name: 'pool only (event not in raffle)', json: { ...base, nights: [night({ public_event_id: 'other' })] },
    tileInRaffle: false, tileWinner: null, pagePool: 12, pageWeekWinners: [] },
  { name: 'night open, no winner', json: { ...base, nights: [night()] },
    tileInRaffle: true, seeWho: false, tileWinner: null, pagePool: 12, pageWeekWinners: [] },
  { name: 'locked winner', json: { ...base, nights: [night({ winner_first_name: 'Ana' })] },
    tileInRaffle: true, seeWho: true, tileWinner: 'Ana', pagePool: 12, pageWeekWinners: ['Ana'] },
  { name: 'attended winner', json: { ...base, nights: [night({ winner_first_name: 'Ben' })] },
    tileInRaffle: true, seeWho: true, tileWinner: 'Ben', pagePool: 12, pageWeekWinners: ['Ben'] },
  { name: 'board error', json: null,
    tileInRaffle: false, tileNote: 'error', seeWho: false, tileWinner: null, pagePool: null, pageWeekWinners: [] },
];
