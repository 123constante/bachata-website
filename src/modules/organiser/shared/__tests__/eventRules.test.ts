import { describe, expect, it } from 'vitest';
import rules from '../event-rules.json';
import {
  blockers, cancelReasons, endFromSessions, festivalDefaultHours, formatPaymentMethods, paymentCodes, parsePaymentMethods,
  readiness, sessionKindRules, sessionKinds, startFromSessions, validSessionPair, type RuleSeries,
} from '../eventRules';

describe('event-rules.json fixtures (the SAME table the admin repo runs)', () => {
  it.each(rules.fixtures.validSessionPair)('validSessionPair $start-$end', (c) => {
    expect(validSessionPair(c.start, c.end)).toEqual({ valid: c.valid, nextDay: c.nextDay });
  });
  it.each(rules.fixtures.timeFromSessions)('time from sessions: $name', (c) => {
    expect(startFromSessions(c.sessions)).toBe(c.start);
    expect(endFromSessions(c.sessions)).toBe(c.end);
  });
  it.each(rules.fixtures.readiness)('readiness: $name', (c) => {
    const r = readiness(c.series as RuleSeries);
    expect(r.ready).toBe(c.ready);
    expect(r.blockers.map((b) => b.code)).toEqual(c.blockers);
  });
});

describe('blocker reasons', () => {
  it('are 2-4 words and say what to do or what is wrong, never a sentence', () => {
    for (const [code, reason] of Object.entries(rules.blockers)) {
      const words = reason.trim().split(/\s+/).length;
      expect(words, code).toBeGreaterThanOrEqual(2);
      expect(words, code).toBeLessThanOrEqual(4);
      expect(reason, code).not.toMatch(/[.!?]$/);
    }
  });
  it('an empty draft lists one reason per missing thing, with its text', () => {
    const list = blockers({ name: '  ', format: null, status: null, flyer: null, venueId: null, payment: [], firstDate: null, today: '2026-10-21' });
    expect(list.map((b) => b.reason)).toEqual(['Add an event name', 'Pick how often', 'Pick a venue', 'Add a flyer', 'Pick a date', 'Add how to pay']);
  });
});

// The prod shapes (ER-COMMON): formats x lifecycle-free facts the readiness reads.
describe('readiness over prod payment shapes', () => {
  const base: RuleSeries = {
    name: 'X', format: 'recurring', status: 'draft', flyer: 'f.jpg', venueId: 'v', payment: [], ticketUrl: 'https://t.example/x', today: '2026-10-21',
    firstDate: { date: '2026-10-30', sessions: [{ kind: 'party', start: '21:00', end: '02:00' }] },
  };
  it.each([
    ['ticket link (51 live)', ['ticket_link'], true],
    ['passes only (3 live) is not a payment code', ['passes'], false],
    ['none (16 live)', [], false],
    ['door + cash', ['door', 'cash'], true],
  ] as const)('%s', (_n, payment, ready) => {
    expect(readiness({ ...base, payment }).ready).toBe(ready);
  });
  it.each(['recurring', 'one_off', 'course', 'festival'])('format %s with a ticket link is ready', (format) => {
    expect(readiness({ ...base, format, payment: ['ticket_link'] }).ready).toBe(true);
  });
  it('an unknown format is blocked, not guessed', () => {
    expect(blockers({ ...base, format: 'weekly', payment: ['free'] }).map((b) => b.code)).toEqual(['format']);
  });
});

describe('time from sessions: a festival of 14 sessions over 4 days', () => {
  it('start is the earliest and end the latest across a night, wrapping past midnight', () => {
    const night = [
      { start: '14:00', end: '15:00' }, { start: '15:00', end: '16:00' }, { start: '22:00', end: '04:00' },
    ];
    expect(startFromSessions(night)).toBe('14:00');
    expect(endFromSessions(night)).toBe('04:00');
  });
});

describe('session kinds', () => {
  it('are admin\'s six, with the stored type for Showcase', () => {
    expect(sessionKinds).toEqual(['class', 'workshop', 'masterclass', 'party', 'showcase', 'competition']);
    expect(sessionKindRules('showcase')?.storedType).toBe('performance');
    expect(sessionKindRules('show')).toBeNull();
  });
  it('level is allowed on Class and Masterclass only', () => {
    expect(sessionKinds.filter((k) => sessionKindRules(k)?.levelAllowed)).toEqual(['class', 'masterclass']);
  });
  it('lessons get the quick lengths, parties and the rest do not', () => {
    for (const k of ['class', 'workshop', 'masterclass'] as const) expect(sessionKindRules(k)?.quickLengths).toEqual([45, 60, 90, 120]);
    for (const k of ['party', 'showcase', 'competition'] as const) expect(sessionKindRules(k)?.quickLengths).toBeNull();
    expect(rules.lessonLengths.default).toBe(60);
  });
});

describe('payment, festival hours, cancel reasons', () => {
  it('offers five choices, a festival only the ticket link', () => {
    expect(paymentCodes('recurring')).toEqual(['ticket_link', 'door', 'bank_transfer', 'cash', 'free']);
    expect(paymentCodes('festival')).toEqual(['ticket_link']);
  });
  it('round-trips the stored comma list and drops unknown codes', () => {
    expect(parsePaymentMethods('ticket_link, door,ticket_link,bogus')).toEqual(['ticket_link', 'door']);
    expect(parsePaymentMethods(null)).toEqual([]);
    expect(formatPaymentMethods(['ticket_link', 'door'])).toBe('ticket_link,door');
  });
  it('the festival default is 22:00-04:00 and cancel reasons are the server list', () => {
    expect(festivalDefaultHours).toEqual({ start: '22:00', end: '04:00' });
    expect(cancelReasons).toEqual(['Venue closed', 'Teacher unavailable', 'Bank holiday', 'Low signups', 'Other']);
  });
});
