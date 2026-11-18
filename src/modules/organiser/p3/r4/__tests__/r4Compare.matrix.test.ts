import { describe, expect, it } from 'vitest';
import type { RaffleNight } from '../../events/raffle/raffleModel';
import type { NightCount } from '../../dash/pastNights';
import { R4_COMPARE_CAP, R4_COMPARE_COPY, everyWord, nightOfWord, pastToReadOf, r4CompareOf } from '../r4CompareModel';

const TODAY = '2026-11-18';
const night = (date: string, o: Partial<RaffleNight> = {}): RaffleNight => ({
  occurrenceId: `o-${date}`, date, startLocal: null, chip: 'closed', raffleOn: false, entries: 0,
  locked: false, winner: null, canSet: true, refuseReason: null, ...o,
});
/** n weekly nights from `start`. */
const weekly = (start: string, n: number): RaffleNight[] =>
  Array.from({ length: n }, (_, i) => night(new Date(Date.parse(`${start}T12:00:00Z`) + i * 7 * 86_400_000).toISOString().slice(0, 10)));
const counts = (m: Record<string, NightCount>) => new Map(Object.entries(m).map(([d, c]) => [`o-${d}`, c]));

// Prod survey 2026-11-18 (event_occurrence_p5 x tickets, counts only, archived left out): 110 series.
// 9 with no past night (8 one-offs), 38 with 1-3 past (20 one-offs, 1 on two weekdays, 1 with a cancelled
// night), 26 with 4-8 past (4 with a cancelled night, 1 on two weekdays), 38 with 9+ past (26 with a
// cancelled night, 6 on two weekdays). NO past night has a ticket today, so every real series meets the
// empty face; the counted shapes below are the board's and the door read's (null when the seat is refused).
describe('R4 Compare: every prod shape x counts', () => {
  it.each([
    ['one-off, not happened yet (8 series)', [night('2026-12-05')], {}, null, 0, R4_COMPARE_COPY.noPast],
    ['one-off, happened, no tickets (20 series)', [night('2026-10-03')], {}, null, 0, R4_COMPARE_COPY.empty],
    ['weekly, no past yet (1 series)', weekly('2026-11-20', 13), {}, 'Every Friday', 0, R4_COMPARE_COPY.noPast],
    ['weekly 1-3 past, no tickets (16 series)', weekly('2026-11-06', 13), {}, 'Every Friday, night 2 of 13', 0, R4_COMPARE_COPY.empty],
    ['weekly 9+ past with door counts (the board)', weekly('2026-10-02', 13),
      { '2026-11-13': { cameIn: 47, ticketsSold: 35 }, '2026-11-06': { cameIn: 54, ticketsSold: 41 }, '2026-10-30': { cameIn: 38, ticketsSold: 28 } },
      'Every Friday, night 7 of 13', 3, null],
    ['door read refused for every night (null counts)', weekly('2026-10-02', 13),
      { '2026-11-13': { cameIn: null, ticketsSold: null } }, 'Every Friday, night 7 of 13', 0, R4_COMPARE_COPY.empty],
    ['tickets sold but nobody scanned (0 came)', weekly('2026-10-02', 13),
      { '2026-11-13': { cameIn: 0, ticketsSold: 12 } }, 'Every Friday, night 7 of 13', 0, R4_COMPARE_COPY.empty],
    ['two weekdays (8 series): no "Every" line', [night('2026-11-06'), night('2026-11-08'), night('2026-11-13')],
      { '2026-11-08': { cameIn: 5, ticketsSold: null } }, 'night 3 of 3', 1, null],
  ] as const)('%s', (_c, nights, cs, sub, rowCount, empty) => {
    const m = r4CompareOf({ nights, today: TODAY, counts: counts(cs) });
    expect(m.sub).toBe(sub);
    expect(m.rows).toHaveLength(rowCount);
    expect(m.empty).toBe(empty);
  });

  it('ranks by people who came, most first, with the board line', () => {
    const m = r4CompareOf({ nights: weekly('2026-10-02', 13), today: TODAY, counts: counts({
      '2026-11-13': { cameIn: 47, ticketsSold: 35 }, '2026-11-06': { cameIn: 54, ticketsSold: 41 }, '2026-10-30': { cameIn: 38, ticketsSold: 1 },
    }) });
    expect(m.rows.map((r) => [r.day, r.line])).toEqual([
      ['Fri 6 Nov', '54 came, 41 tickets'], ['Fri 13 Nov', '47 came, 35 tickets'], ['Fri 30 Oct', '38 came, 1 ticket'],
    ]);
    // nights with no count were left out alongside the cancelled ones
    expect(m.foot).toBe(R4_COMPARE_COPY.footUnscanned);
  });

  it('a tie goes to the more recent night; no tickets count = came only', () => {
    const m = r4CompareOf({ nights: weekly('2026-10-30', 3), today: TODAY, counts: counts({
      '2026-10-30': { cameIn: 10, ticketsSold: 10 }, '2026-11-06': { cameIn: 10, ticketsSold: null }, '2026-11-13': { cameIn: 10, ticketsSold: 9 },
    }) });
    expect(m.rows.map((r) => r.date)).toEqual(['2026-11-13', '2026-11-06', '2026-10-30']);
    expect(m.rows[1].line).toBe('10 came');
    expect(m.foot).toBe(R4_COMPARE_COPY.foot);
  });

  it('a cancelled night (30 series have one) is never read, ranked or counted in "night N of M"', () => {
    const nights = weekly('2026-10-30', 4).map((n) => (n.date === '2026-11-06' ? { ...n, chip: 'cancelled' as const } : n));
    expect(pastToReadOf(nights, TODAY).map((n) => n.date)).toEqual(['2026-11-13', '2026-10-30']);
    expect(nightOfWord(nights.filter((n) => n.chip !== 'cancelled'), TODAY)).toBe('night 2 of 3');
    // the gap left by the cancelled night breaks the 7-day run: no "Every" claim
    expect(everyWord(nights.filter((n) => n.chip !== 'cancelled'))).toBeNull();
    const m = r4CompareOf({ nights, today: TODAY, counts: counts({ '2026-11-06': { cameIn: 99, ticketsSold: 99 }, '2026-11-13': { cameIn: 3, ticketsSold: 3 } }) });
    expect(m.rows.map((r) => r.date)).toEqual(['2026-11-13']);
  });

  it('reads at most the cap, most recent first; today is not past', () => {
    const nights = weekly('2026-06-05', 30);
    const read = pastToReadOf(nights, '2026-11-20');
    expect(read).toHaveLength(R4_COMPARE_CAP);
    expect(read[0].date).toBe('2026-11-13');
    expect(nightOfWord(nights, '2026-11-20')).toBe('night 25 of 30');
  });

  it('no Money: the model carries no amount (no per-night money read)', () => {
    const m = r4CompareOf({ nights: weekly('2026-10-30', 2), today: TODAY, counts: counts({ '2026-10-30': { cameIn: 4, ticketsSold: 4 } }) });
    expect(Object.keys(m.rows[0]).sort()).toEqual(['came', 'date', 'day', 'key', 'line', 'occurrenceId']);
  });
});
