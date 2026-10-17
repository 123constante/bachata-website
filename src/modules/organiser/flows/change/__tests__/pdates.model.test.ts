import { describe, expect, it } from 'vitest';
import {
  bulkResult, copyPatches, deltaLine, durationWords, endProblem, hasOwnTime, lastEnding, nightStart, previewTimes, shiftRefusal, ticketProblem, timeDelta,
} from '../changeModel';

// Shapes from prod 2026-10-17 (counts only): socials ending after midnight
// (end before start), class + social nights, dates with their own start.
const night = [
  { key: 'a', name: 'Class', kind: 'Class', start: '20:00', end: '21:00' },
  { key: 'b', name: 'Late Party', kind: 'Party', start: '21:00', end: '02:00' },
];

describe('timeDelta: the shorter way round the clock', () => {
  it.each([
    ['20:00', '21:00', 60],
    ['21:00', '20:30', -30],
    ['23:00', '01:00', 120],
    ['21:00', '08:00', -780],
    ['01:00', '23:00', -120],
    ['20:00', '20:00', 0],
    ['20:00', '', null],
    ['', '20:00', null],
  ] as const)('%s -> %s = %s', (a, b, d) => expect(timeDelta(a, b)).toBe(d));
});

describe('previewTimes: every session moves by the same delta; a typed end lands on the last-ending one', () => {
  it('moves both sessions, wrapping past midnight', () => {
    expect(previewTimes(night, 60, null).map((s) => [s.newStart, s.newEnd])).toEqual([['21:00', '22:00'], ['22:00', '03:00']]);
  });
  it('an end replaces only the social (it ends last, after midnight)', () => {
    expect(previewTimes(night, 0, '03:00').map((s) => s.newEnd)).toEqual(['21:00', '03:00']);
  });
  it('the last-ending session counts an after-midnight end as later', () => {
    expect(lastEnding(night)?.key).toBe('b');
  });
});

describe('words', () => {
  it.each([[60, '1 h'], [30, '30 min'], [90, '1 h 30 min'], [-45, '45 min']] as const)('%s min reads "%s"', (m, w) => expect(durationWords(m)).toBe(w));
  it('says earlier or later', () => {
    expect(deltaLine(60)).toBe('Every session moves by 1 h later');
    expect(deltaLine(-30)).toBe('Every session moves by 30 min earlier');
  });
});

describe('hasOwnTime: Back to usual time only for a date at its own start', () => {
  it.each([
    ['2026-10-23T20:00:00Z', '20:00:00', false],
    ['2026-10-23T21:30:00Z', '20:00:00', true],
    [null, '20:00:00', false],
    ['2026-10-23T21:30:00Z', null, false],
  ] as const)('%s vs usual %s = %s', (own, usual, want) => expect(hasOwnTime({ materialised_start_utc: own }, usual)).toBe(want));
});

describe('copyPatches: one patch per changed key, none for what the target already holds', () => {
  const none = { venueOverride: null, descriptionOverride: null, coverImageOverride: null, ticketUrlOverride: null };
  it('nothing to copy from a date with no changes', () => expect(copyPatches(none, none)).toEqual([]));
  it('copies the keys the source has and the target lacks or differs on', () => {
    expect(copyPatches({ ...none, venueOverride: 'v2', descriptionOverride: 'Band', ticketUrlOverride: 'https://t' }, { ...none, descriptionOverride: 'Band' }))
      .toEqual([{ key: 'venue_id', value: 'v2' }, { key: 'ticket_url', value: 'https://t' }]);
  });
});

describe('bulk', () => {
  it('N done, M not changed, naming the ones the server skipped', () => {
    expect(bulkResult(['a', 'b', 'c'], ['a', 'c'])).toEqual({ done: 2, refused: ['b'], line: '2 done, 1 not changed' });
  });
  it.each([
    [{ mode: 'weekly', weekdays: [5] }, true],
    [{ mode: 'monthly' }, true],
    [{ mode: 'custom', dates: [] }, false],
    [null, false],
  ] as const)('shift refused for %j: %s', (rule, refused) => expect(!!shiftRefusal(rule)).toBe(refused));
});

describe('ticketProblem', () => {
  it.each([['https://x.example/a', null], ['http://x.example', null], ['x.example', 'Start the link with https://'], ['', null]] as const)('%s', (v, p) =>
    expect(ticketProblem(v)).toBe(p));
});

describe('the night clock (round 2): after-midnight sessions sort and end last; an end before its start is refused', () => {
  it('an after-party 00:30-04:00 ends after a party 21:00-00:00', () => {
    expect(lastEnding([{ key: 'p', start: '21:00', end: '00:00' }, { key: 'a', start: '00:30', end: '04:00' }])?.key).toBe('a');
  });
  it('00:30 sorts after 23:00', () => expect((nightStart('00:30') ?? 0) > (nightStart('23:00') ?? 0)).toBe(true));
  it.each([
    ['22:00', '21:00', true],
    ['23:00', '23:00', true],
    ['21:00', '02:00', false],
    ['20:00', '23:30', false],
  ] as const)('start %s, end %s refused: %s', (s, e, bad) => expect(!!endProblem(s, e)).toBe(bad));
});
