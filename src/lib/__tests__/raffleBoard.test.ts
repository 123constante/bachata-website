import { describe, it, expect } from 'vitest';
import { parseRaffleBoard, boardForEvent, thisWeeksWinners, RAFFLE_BOARD_NIGHT_KEYS } from '../raffleBoard';
import { BOARD_SHAPES } from './raffleBoardFixtures';

const night = (o: Record<string, unknown> = {}) => ({
  occurrence_id: 'o1', public_event_id: 'e1', title: 'T', start_local: '2026-11-12T20:00:00',
  venue_name: 'V', winner_first_name: null, ...o,
});
const board = (nights: unknown[], extra = {}) =>
  ({ pool_count: 10, winners_this_month: 2, total_winners: 766, nights, ...extra });
const EMPTY = { poolCount: 0, winnersThisMonth: 0, totalWinners: 0, nights: [] };
const NOW = new Date('2026-11-11T12:00:00Z');

const shapes: Array<[string, unknown, number, string | null, boolean]> = [
  ['empty object', {}, 0, null, false],
  ['pool only', { pool_count: 5 }, 0, null, false],
  ['night open no winner', board([night()]), 1, null, true],
  ['locked winner', board([night({ winner_first_name: 'Ana' })]), 1, 'Ana', true],
  ['attended winner', board([night({ winner_first_name: 'Ben', start_local: '2026-11-11T20:00:00' })]), 1, 'Ben', true],
  ['released (winner cleared)', board([night({ winner_first_name: null })]), 1, null, true],
  ['event not in raffle', board([night({ public_event_id: 'other' })]), 1, null, false],
  ['null', null, 0, null, false],
  ['array', [night()], 0, null, false],
  ['garbage', 'x', 0, null, false],
  ['wrong-type nights', { nights: 'no', pool_count: 'abc' }, 0, null, false],
];

describe('raffleBoard shapes', () => {
  it.each(shapes)('%s', (_n, json, nights, winner, inRaffle) => {
    const b = parseRaffleBoard(json);
    expect(b.nights).toHaveLength(nights);
    const e = boardForEvent(b, 'e1', NOW);
    expect(e.inRaffle).toBe(inRaffle);
    expect(e.winnerFirstName).toBe(winner);
    expect(Array.isArray(thisWeeksWinners(b, NOW))).toBe(true);
  });
  it('empty board for non-objects', () => {
    for (const j of [null, undefined, [], 3, 'x']) expect(parseRaffleBoard(j)).toEqual(EMPTY);
  });
  it('reads counts, ignores extra keys, drops malformed nights individually', () => {
    const b = parseRaffleBoard(board([night(), { nope: 1 }, null, night({ start_local: 'bad' }), night({ occurrence_id: 'o2' })], { extra: 1 }));
    expect(b.poolCount).toBe(10);
    expect(b.totalWinners).toBe(766);
    expect(b.nights.map((n) => n.occurrenceId)).toEqual(['o1', 'o2']);
  });
  it('thisWeeksWinners: week with a winner only', () => {
    const b = parseRaffleBoard(board([night({ winner_first_name: 'Ben', start_local: '2026-11-10T20:00:00' }), night({ occurrence_id: 'o2' })]));
    expect(thisWeeksWinners(b, NOW).map((n) => n.winnerFirstName)).toEqual(['Ben']);
  });
  it('earliest matching night wins', () => {
    const b = parseRaffleBoard(board([
      night({ occurrence_id: 'late', start_local: '2026-12-01T20:00:00', winner_first_name: 'Z' }),
      night({ occurrence_id: 'early', start_local: '2026-11-12T20:00:00', winner_first_name: 'A' }),
    ]));
    expect(boardForEvent(b, 'e1', NOW).night?.occurrenceId).toBe('early');
  });
  it('25 nights across two London weeks around the DST change (2026-10-25)', () => {
    const nights = Array.from({ length: 25 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 9, 19 + Math.floor(i / 2), i % 2 ? 23 : 0, 30));
      return night({ occurrence_id: `n${i}`, start_local: d.toISOString().slice(0, 19), winner_first_name: 'W' });
    });
    const b = parseRaffleBoard(board(nights));
    expect(b.nights).toHaveLength(25);
    // week of Mon 26 Oct - Sun 1 Nov (London), now = Wed 28 Oct
    const w2 = thisWeeksWinners(b, new Date('2026-10-28T12:00:00Z')).map((n) => n.occurrenceId);
    // week of Mon 19 - Sun 25 Oct
    const w1 = thisWeeksWinners(b, new Date('2026-10-21T12:00:00Z')).map((n) => n.occurrenceId);
    expect(w1.length + w2.length).toBeLessThanOrEqual(25);
    expect(w1.filter((x) => w2.includes(x))).toEqual([]);
    // 23:30Z on 25 Oct is 23:30 London (GMT after change): still week 1; 00:30Z on 26 Oct is Monday: week 2
    expect(w1).toContain('n13'); // i=13: day 25 Oct, 23:30Z
    expect(w2).toContain('n14'); // i=14: 26 Oct 00:30Z
  });
});

describe('real RPC keys (start_local UTC wall clock, venue_name)', () => {
  const REAL = {
    occurrence_id: 'o1', public_event_id: 'e1', title: 'Friday Social',
    start_local: '2026-07-10T22:30:00', venue_name: 'The Cellar', winner_first_name: 'Ana',
  };
  it('maps start_local and venue_name (blank-venue / dropped-night bug)', () => {
    const b = parseRaffleBoard(board([REAL]));
    expect(b.nights).toHaveLength(1);
    expect(b.nights[0].venue).toBe('The Cellar');
    expect(b.nights[0].start).toBe('2026-07-10T22:30:00Z');
  });
  it('BST: 23:30 London (22:30Z) stays on its London day; 23:30Z is next London day', () => {
    const b = parseRaffleBoard(board([
      { ...REAL, occurrence_id: 'a', start_local: '2026-07-12T22:30:00' }, // 23:30 BST Sun 12 Jul
      { ...REAL, occurrence_id: 'b', start_local: '2026-07-12T23:30:00' }, // 00:30 BST Mon 13 Jul
    ]));
    const week1 = thisWeeksWinners(b, new Date('2026-07-08T12:00:00Z')).map((n) => n.occurrenceId);
    const week2 = thisWeeksWinners(b, new Date('2026-07-14T12:00:00Z')).map((n) => n.occurrenceId);
    expect(week1).toEqual(['a']);
    expect(week2).toEqual(['b']);
  });
  it('GMT after the change: no shift', () => {
    const b = parseRaffleBoard(board([{ ...REAL, start_local: '2026-11-01T23:30:00' }]));
    expect(thisWeeksWinners(b, new Date('2026-10-28T12:00:00Z'))).toHaveLength(1);
  });
  it('earliest night is skipped when it is yesterday (London date)', () => {
    const b = parseRaffleBoard(board([
      { ...REAL, occurrence_id: 'yest', start_local: '2026-11-10T20:00:00', winner_first_name: 'Old' },
      { ...REAL, occurrence_id: 'next', start_local: '2026-11-17T20:00:00', winner_first_name: null },
    ]));
    const e = boardForEvent(b, 'e1', new Date('2026-11-11T09:00:00Z'));
    expect(e.night?.occurrenceId).toBe('next');
    expect(e.winnerFirstName).toBeNull();
  });
  it('a night starting 00:30 London today counts as today', () => {
    const b = parseRaffleBoard(board([{ ...REAL, start_local: '2026-07-13T23:30:00' }])); // 00:30 BST 14 Jul
    expect(boardForEvent(b, 'e1', new Date('2026-07-14T10:00:00Z')).inRaffle).toBe(true);
  });
});

describe('fixture keys = real RPC keys (one shared mapping)', () => {
  const nightsOf = (j: unknown): Record<string, unknown>[] =>
    j && typeof j === 'object' && Array.isArray((j as { nights?: unknown }).nights)
      ? ((j as { nights: Record<string, unknown>[] }).nights)
      : [];
  const all = [...BOARD_SHAPES.flatMap((s) => nightsOf(s.json)), night()];
  it('every fixture night uses exactly the raffle_public_board_v1 night keys', () => {
    expect(all.length).toBeGreaterThan(0);
    for (const n of all) expect(Object.keys(n).sort()).toEqual([...RAFFLE_BOARD_NIGHT_KEYS].sort());
  });
  it('a night with made-up keys (start / venue) is dropped, not silently accepted', () => {
    const wrong = { occurrence_id: 'o1', public_event_id: 'e1', title: 'T', start: '2026-11-12T20:00:00', venue: 'V', winner_first_name: null };
    expect(parseRaffleBoard(board([wrong])).nights).toHaveLength(0);
  });
  it('venue is read from venue_name only', () => {
    const n = { ...night(), venue_name: undefined, venue: 'V' };
    expect(parseRaffleBoard(board([n])).nights[0].venue).toBeNull();
  });
});
