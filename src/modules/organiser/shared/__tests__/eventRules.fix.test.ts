// ER-FIX-W1 C3-2..C3-7: each row here was RED on the unfixed rules (handover ER-FIX-C3).
import { describe, expect, it } from 'vitest';
import {
  EVENT_RULES,
  blockers,
  endFromSessions,
  formatPaymentMethods,
  maxSessionMinutes,
  ownerCanCreate,
  parsePaymentMethods,
  readiness,
  startFromSessions,
  validSessionPair,
  type RuleSeries,
} from '../eventRules';
import { LIMITS } from '../programmeModel';
import { ROLLOVER_HOUR } from '@/lib/programDayRollover';

const complete = (over: Partial<RuleSeries> = {}): RuleSeries => ({
  name: 'Friday Social',
  format: 'recurring',
  status: 'draft',
  venueId: 'v1',
  payment: ['ticket_link'],
  ticketUrl: 'https://tickets.example/x',
  flyer: 'https://x/flyer.jpg',
  firstDate: { date: '2026-10-30', sessions: [{ kind: 'party', start: '21:00', end: '02:00' }] },
  today: '2026-10-21',
  ...over,
});
const codes = (s: RuleSeries) => blockers(s).map((b) => b.code);
const past = { date: '2026-01-01', sessions: [{ kind: 'party', start: '21:00', end: '02:00' }] };

describe('C3-2: the past-first-date blocker follows the series status', () => {
  it.each([
    ['live', []],
    ['paused', []],
    ['ended', []],
    ['draft', ['dateInPast']],
    ['rejected', ['dateInPast']],
    ['pending_review', ['dateInPast']],
  ])('%s weekly with a past first date -> %j', (status, want) => {
    expect(codes(complete({ status, firstDate: past }))).toEqual(want);
  });
  it('a live weekly with a past first date is ready', () => {
    expect(readiness(complete({ status: 'live', firstDate: past })).ready).toBe(true);
  });
});

describe('C3-3: flyer and festival days, description stays server-only', () => {
  it('no flyer blocks, and maps to the server codes no_flyer / cover', () => {
    expect(codes(complete({ flyer: null }))).toEqual(['flyer']);
    expect(codes(complete({ flyer: '  ' }))).toEqual(['flyer']);
    expect(EVENT_RULES.serverCodes.flyer).toEqual(['no_flyer', 'cover']);
  });
  it('a festival day without a timed session blocks (no_session_first_date)', () => {
    const fest = complete({
      format: 'festival',
      firstDate: { date: '2026-11-20', sessions: [{ kind: 'party', start: '22:00', end: '04:00' }] },
      programmeDays: [
        { date: '2026-11-20', sessions: [{ kind: 'party', start: '22:00', end: '04:00' }] },
        { date: '2026-11-21', sessions: [{ kind: 'class', start: null, end: null }] },
      ],
    });
    expect(codes(fest)).toEqual(['festivalDay']);
    expect(EVENT_RULES.serverCodes.festivalDay).toEqual(['no_session_first_date']);
    const fine = { ...fest, programmeDays: [fest.programmeDays![0]] };
    expect(codes(fine)).toEqual([]);
  });
  it('a weekly ignores programmeDays (the check is festival only)', () => {
    expect(codes(complete({ programmeDays: [{ date: '2026-10-31', sessions: [] }] }))).toEqual([]);
  });
  it('description is never a client blocker but always named as a server check', () => {
    const r = readiness(complete());
    expect(r.ready).toBe(true);
    expect(r.serverOnlyBlockers).toEqual(['description']);
    expect(readiness(complete({ name: '' })).serverOnlyBlockers).toEqual(['description']);
  });
});

// ER-FIX-W2 (owner decision 1): festival create is ON (AD2); course stays off.
describe('C3-4: owner create offers only what the server accepts', () => {
  it.each([
    ['one_off', true],
    ['recurring', true],
    ['course', false],
    ['festival', true],
    ['', false],
    [null, false],
    ['constructor', false],
  ])('ownerCanCreate(%j) -> %s', (format, want) => {
    expect(ownerCanCreate(format)).toBe(want);
  });
  it('formats is unchanged (readiness still knows all four)', () => {
    expect(EVENT_RULES.formats).toEqual(['recurring', 'one_off', 'course', 'festival']);
    expect(EVENT_RULES.ownerCreateFormats).toEqual(['one_off', 'recurring', 'festival']);
  });
});

describe('C3-5: the rollover hour is the admin one and daytime programmes stay put', () => {
  it('rolloverBefore is the admin ROLLOVER_HOUR', () => {
    expect(EVENT_RULES.time.rolloverBefore).toBe(`${String(ROLLOVER_HOUR).padStart(2, '0')}:00`);
  });
  it.each([
    ['morning then late morning', [['07:30', '09:00'], ['10:00', '12:00']], '07:30', '12:00'],
    ['party then after-party', [['22:00', '23:00'], ['00:30', '03:00']], '22:00', '03:00'],
    ['class then party past midnight then after-party', [['20:00', '21:00'], ['21:00', '02:00'], ['02:00', '05:00']], '20:00', '05:00'],
    ['only an early session', [['06:00', '07:00']], '06:00', '07:00'],
  ])('%s', (_n, pairs, start, end) => {
    const sessions = pairs.map(([s, e]) => ({ start: s, end: e }));
    expect([startFromSessions(sessions), endFromSessions(sessions)]).toEqual([start, end]);
  });
});

describe('C3-6: one session length cap shared with the programme editor', () => {
  it('maxSessionMinutes is the programme editor cap', () => {
    expect(maxSessionMinutes).toBe(LIMITS.sessionMaxMinutes);
    expect(maxSessionMinutes).toBe(720);
  });
  it.each([
    ['20:00', '19:59', false],
    ['20:00', '08:00', true],
    ['20:00', '08:01', false],
    ['22:00', '04:00', true],
    ['09:00', '21:00', true],
    ['09:00', '21:01', false],
  ])('%s-%s valid=%s', (s, e, valid) => {
    expect(validSessionPair(s, e).valid).toBe(valid);
  });
  it('a live festival keeps its stored 10:00-07:00 session ready (prod shape, rule 28)', () => {
    const fest = complete({ status: 'live', format: 'festival', firstDate: { date: '2026-11-20', sessions: [{ kind: 'party', start: '10:00', end: '07:00' }] } });
    expect(codes(fest)).toEqual([]);
    expect(codes({ ...fest, status: 'draft' })).toEqual(['sessionTimes']);
  });
  it('a 23 h 59 class is a readiness blocker', () => {
    expect(codes(complete({ firstDate: { date: '2026-10-30', sessions: [{ kind: 'class', start: '20:00', end: '19:59' }] } }))).toEqual(['sessionTimes']);
  });
});

describe('C3-7: own properties only, no repeats', () => {
  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])('parsePaymentMethods(%j) -> []', (s) => {
    expect(parsePaymentMethods(s)).toEqual([]);
  });
  it('formatPaymentMethods drops repeats and unknown codes', () => {
    expect(formatPaymentMethods(['door', 'door'])).toBe('door');
    expect(formatPaymentMethods(['door', 'constructor', 'cash', 'door'])).toBe('door,cash');
  });
  it('an inherited name is not a payment choice', () => {
    expect(codes(complete({ payment: ['constructor'] }))).toEqual(['payment']);
  });
});
