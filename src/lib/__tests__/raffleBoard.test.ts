import { describe, it, expect } from 'vitest';
import { parseRaffleBoard, boardForEvent, thisWeeksWinners } from '../raffleBoard';

const night = (o: Record<string, unknown> = {}) => ({
  occurrence_id: 'o1', public_event_id: 'e1', title: 'T', start: '2026-11-12T20:00:00',
  venue: 'V', winner_first_name: null, ...o,
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
  ['attended winner', board([night({ winner_first_name: 'Ben', start: '2026-11-10T20:00:00' })]), 1, 'Ben', true],
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
    const e = boardForEvent(b, 'e1');
    expect(e.inRaffle).toBe(inRaffle);
    expect(e.winnerFirstName).toBe(winner);
    expect(Array.isArray(thisWeeksWinners(b, NOW))).toBe(true);
  });
  it('empty board for non-objects', () => {
    for (const j of [null, undefined, [], 3, 'x']) expect(parseRaffleBoard(j)).toEqual(EMPTY);
  });
  it('reads counts, ignores extra keys, drops malformed nights individually', () => {
    const b = parseRaffleBoard(board([night(), { nope: 1 }, null, night({ start: 'bad' }), night({ occurrence_id: 'o2' })], { extra: 1 }));
    expect(b.poolCount).toBe(10);
    expect(b.totalWinners).toBe(766);
    expect(b.nights.map((n) => n.occurrenceId)).toEqual(['o1', 'o2']);
  });
  it('thisWeeksWinners: week with a winner only', () => {
    const b = parseRaffleBoard(board([night({ winner_first_name: 'Ben', start: '2026-11-10T20:00:00' }), night({ occurrence_id: 'o2' })]));
    expect(thisWeeksWinners(b, NOW).map((n) => n.winnerFirstName)).toEqual(['Ben']);
  });
  it('earliest matching night wins', () => {
    const b = parseRaffleBoard(board([
      night({ occurrence_id: 'late', start: '2026-12-01T20:00:00', winner_first_name: 'Z' }),
      night({ occurrence_id: 'early', start: '2026-11-12T20:00:00', winner_first_name: 'A' }),
    ]));
    expect(boardForEvent(b, 'e1').night?.occurrenceId).toBe('early');
  });
  it('25 nights across two London weeks around the DST change (2026-10-25)', () => {
    const nights = Array.from({ length: 25 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 9, 19 + Math.floor(i / 2), i % 2 ? 23 : 0, 30));
      return night({ occurrence_id: `n${i}`, start: d.toISOString(), winner_first_name: 'W' });
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
