import { describe, expect, it } from 'vitest';
import {
  bulkResult, copyPatches, deltaLine, durationWords, endProblem, hasOwnTime, lastEnding, nightStart, previewTimes, shiftRefusal, ticketProblem, timeDelta,
  END_GUARD, PICK_PAST, copyHalfDone, endBoxShown, serverEndTargets, shiftPastProblem,
} from '../changeModel';
import { commandErrorMessage } from '@/modules/organiser/shared/selfServeErrors';

const GENERIC_LINE = 'Something went wrong. Please try again.';

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
  // F-PAR decision 1: prod set_time gives a typed end to the plain-clock max(eff_end), which
  // on this night is the CLASS (21:00 > 02:00). The screen does not copy that: it offers no end box.
  it('class + party night: the server would give a typed end to the class, so the end box is not offered', () => {
    expect(serverEndTargets(night).map((s) => s.key)).toEqual(['a']);
    expect(endBoxShown(night)).toBe(false);
  });
  it('the night still ends with the party (the night clock), which is why the two differ', () => {
    expect(lastEnding(night)?.key).toBe('b');
  });
});

describe('F-PAR decision 1: the end box shows only where the server end target is the night-last session', () => {
  it.each([
    ['class 20:00-21:00 + party 21:00-02:00', false, night],
    ['two daytime sessions', true, [{ key: 'a', start: '14:00', end: '15:00' }, { key: 'b', start: '15:00', end: '17:00' }]],
    ['one session', true, [{ key: 'a', start: '21:00', end: '02:00' }]],
    ['party 21:00-00:00 + after-party 00:30-04:00 (04:00 is both maxima)', true, [{ key: 'p', start: '21:00', end: '00:00' }, { key: 'x', start: '00:30', end: '04:00' }]],
    ['two sessions ending together', false, [{ key: 'a', start: '20:00', end: '23:00' }, { key: 'b', start: '21:00', end: '23:00' }]],
  ] as const)('%s: end box %s', (_n, shown, ss) => expect(endBoxShown([...ss])).toBe(shown));
  it('the guard says what to do instead', () => expect(END_GUARD).toBe('To change when the night ends, change one session’s time'));
  it('an end on a day where the box shows still lands on the last session', () => {
    const day = [{ key: 'a', name: 'A', kind: 'Class', start: '14:00', end: '15:00' }, { key: 'b', name: 'B', kind: 'Class', start: '15:00', end: '17:00' }];
    expect(previewTimes(day, 0, '18:00').map((s) => s.newEnd)).toEqual(['15:00', '18:00']);
  });
});

describe('F-PAR PAR-A S1: whole-call bulk refusals say why', () => {
  it.each([
    'contract_violation: shift would move a date into the past',
    'contract_violation: shift would collide with an existing date',
    'bulk_too_large',
  ])('%s is not the generic line', (message) => {
    const text = commandErrorMessage({ message, code: 'P0001' });
    expect(text).not.toBe(GENERIC_LINE);
    expect(text).not.toMatch(/try again/i);
  });
  it.each([
    [[3], -2, null],
    [[3], -3, null],
    [[3], -4, PICK_PAST],
    [[3, 10], -5, PICK_PAST],
    [[3], 5, null],
  ] as const)('ticked dates %j days from today shifted by %s: %s', (offsets, shift, want) => {
    const today = '2026-10-20';
    const dates = offsets.map((o) => `2026-10-${String(20 + o).padStart(2, '0')}`);
    expect(shiftPastProblem(dates, shift, today)).toBe(want);
  });
});

describe('F-PAR PAR-A S3: a copy that stops partway says what was copied', () => {
  it('names the copied keys, the rest and the reason', () => {
    expect(copyHalfDone(['Note'], ['Ticket link', 'Picture'], 'Enter a full link starting with https://.'))
      .toBe('Note copied, Ticket link and Picture not copied: Enter a full link starting with https://.');
  });
});

describe('words', () => {
  it.each([[60, '1 h'], [30, '30 min'], [90, '1 h 30 min'], [-45, '45 min']] as const)('%s min reads "%s"', (m, w) => expect(durationWords(m)).toBe(w));
  it('says earlier or later', () => {
    // F-PAR PAR-B S2: "moves 30 min later", not "moves by 30 min later".
    expect(deltaLine(60)).toBe('Every session moves 1 h later');
    expect(deltaLine(-30)).toBe('Every session moves 30 min earlier');
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
