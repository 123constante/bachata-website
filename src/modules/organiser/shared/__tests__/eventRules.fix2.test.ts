// ER-FIX-W2 S1: each block here was RED on the unfixed rules (handover ER-FIX2-S1).
// Shapes are prod's (ER-AUDIT-rules-shell section 4): 223 untimed programme items,
// 51 live ticket-link series, 7 live festivals, co-organised events.
import { describe, expect, it } from 'vitest';
import {
  EVENT_RULES,
  blockers,
  formatOffReason,
  isUntimedSession,
  notFoundLines,
  ownerCanCreate,
  readiness,
  serverCodeBlocker,
  validTicketUrl,
  type RuleSeries,
} from '../eventRules';
import { GO_LIVE_LABEL, UNKNOWN_ITEM_LABEL, goLiveLabel } from '../goLiveCheck';
import { isRetrySuccess } from '../selfServeErrors';

const base = (over: Partial<RuleSeries> = {}): RuleSeries => ({
  name: 'Friday Social',
  format: 'recurring',
  status: 'draft',
  venueId: 'v1',
  payment: ['door'],
  flyer: 'https://x/flyer.jpg',
  firstDate: { date: '2026-10-30', sessions: [{ kind: 'party', start: '21:00', end: '02:00' }] },
  today: '2026-10-21',
  ...over,
});
const codes = (s: RuleSeries) => blockers(s).map((b) => b.code);
const reasons = (s: RuleSeries) => blockers(s).map((b) => b.reason);

// F4 + owner decision 3: untimed sessions are VALID; only a half-filled pair or an end equal to the start is wrong.
describe('untimed sessions on the first date (decision 3)', () => {
  const untimedNull = { kind: 'party', start: null, end: null };
  const untimedBlank = { kind: 'class', start: '', end: '' };
  it.each([
    ['live weekly, first date untimed (null)', base({ status: 'live', firstDate: { date: '2026-01-02', sessions: [untimedNull] } }), []],
    ['live weekly, first date untimed (blank strings)', base({ status: 'live', firstDate: { date: '2026-01-02', sessions: [untimedBlank] } }), []],
    ['draft, one timed and one untimed', base({ firstDate: { date: '2026-10-30', sessions: [{ start: '20:00', end: '21:00' }, untimedNull] } }), []],
    ['draft, only untimed', base({ firstDate: { date: '2026-10-30', sessions: [untimedNull] } }), []],
    ['paused one-off, untimed', base({ status: 'paused', format: 'one_off', firstDate: { date: '2026-11-01', sessions: [untimedBlank] } }), []],
    ['half-filled: start only', base({ firstDate: { date: '2026-10-30', sessions: [{ start: '20:00', end: null }] } }), ['sessionTimes']],
    ['half-filled: end only', base({ firstDate: { date: '2026-10-30', sessions: [{ start: '', end: '21:00' }] } }), ['sessionTimes']],
    ['end equals start', base({ firstDate: { date: '2026-10-30', sessions: [{ start: '20:00', end: '20:00' }] } }), ['sessionTimes']],
    ['next-day pair is fine', base({ firstDate: { date: '2026-10-30', sessions: [{ start: '23:00', end: '03:00' }] } }), []],
  ] as const)('%s', (_n, series, want) => {
    expect(codes(series)).toEqual(want);
  });

  it('isUntimedSession: both empty only', () => {
    expect(isUntimedSession({ start: null, end: null })).toBe(true);
    expect(isUntimedSession({ start: '', end: ' ' })).toBe(true);
    expect(isUntimedSession({ start: '20:00', end: null })).toBe(false);
    expect(isUntimedSession({ start: '20:00', end: '21:00' })).toBe(false);
  });

  it('the json fixture rows agree', () => {
    const row = EVENT_RULES.fixtures.readiness.find((r) => r.name === 'live weekly with an untimed first-date session');
    expect(row).toBeTruthy();
    expect(readiness(row!.series as RuleSeries).ready).toBe(true);
  });
});

// F3: prototype v7 okTicket -- a chosen ticket link needs a real https URL.
describe('ticket link needs a URL', () => {
  it.each([
    ['ticket link, no url', ['ticket_link'], undefined, ['payment']],
    ['ticket link, blank url', ['ticket_link'], '  ', ['payment']],
    ['ticket link, not a url', ['ticket_link'], 'tickets at the door', ['payment']],
    ['ticket link, http (prototype wants https)', ['ticket_link'], 'http://t.example/x', ['payment']],
    ['ticket link and door, no url', ['ticket_link', 'door'], null, ['payment']],
    ['ticket link, https url', ['ticket_link'], 'https://t.example/x', []],
    ['door only, no url needed', ['door'], null, []],
  ] as const)('%s', (_n, payment, ticketUrl, want) => {
    expect(codes(base({ payment, ticketUrl }))).toEqual(want);
  });

  it.each(['live', 'paused', 'ended'])('a %s series is never turned Not ready by it (51 live ticket-link series)', (status) => {
    expect(codes(base({ status, firstDate: { date: '2026-01-02', sessions: [{ start: '21:00', end: '02:00' }] }, payment: ['ticket_link'], ticketUrl: null }))).toEqual([]);
  });

  it('says to add the ticket link, not how to pay', () => {
    expect(reasons(base({ payment: ['ticket_link'], ticketUrl: '' }))).toEqual(['Add the ticket link']);
  });

  it('festival with a ticket link and no URL is not ready', () => {
    const fest = base({ format: 'festival', payment: ['ticket_link'], ticketUrl: null });
    expect(readiness(fest).ready).toBe(false);
    expect(validTicketUrl('https://t.example/x')).toBe(true);
  });
});

// F1 + owner decision 1.
describe('owner create formats (decision 1)', () => {
  it.each([
    ['one_off', true],
    ['recurring', true],
    ['festival', true],
    ['course', false],
    ['nonsense', false],
  ] as const)('%s', (format, want) => {
    expect(ownerCanCreate(format)).toBe(want);
  });
  it('an off format carries its reason from the rule set', () => {
    expect(formatOffReason('course')).toBe('Not available yet');
    expect(formatOffReason('festival')).toBeNull();
    expect(EVENT_RULES.ownerCreateFormats).toEqual(['one_off', 'recurring', 'festival']);
  });
});

// F2 + F10: the prototype v7 FIX map (line 328) and checklist labels are the words.
describe('blocker words are prototype v7 actions', () => {
  it.each([
    ['venue', 'Pick a venue'],
    ['date', 'Pick a date'],
    ['session', 'Add a session'],
    ['flyer', 'Add a flyer'],
    ['payment', 'Add how to pay'],
  ] as const)('%s', (code, word) => {
    expect(EVENT_RULES.blockers[code]).toBe(word);
  });
  it('the format word does not ask for a type (rule 6)', () => {
    expect(EVENT_RULES.blockers.format).not.toMatch(/type/i);
  });
  it('a festival reads its own words', () => {
    const fest = base({ format: 'festival', payment: [], firstDate: { date: '2026-11-20', sessions: [] } });
    expect(reasons(fest)).toEqual(['Party hours each night', 'Add a ticket link']);
  });
});

// F2: the five AD1 codes read real words, from the ONE map.
describe('server go-live codes have labels', () => {
  const serverCodes = [...new Set(Object.values(EVENT_RULES.serverCodes).flat())];
  it.each(serverCodes)('%s', (code) => {
    expect(goLiveLabel(code)).not.toBe(UNKNOWN_ITEM_LABEL);
    const key = serverCodeBlocker(code);
    expect(key).not.toBeNull();
    expect(GO_LIVE_LABEL[code]).toBe(EVENT_RULES.blockers[key!]);
  });
  it('no_session_first_date reads Add a session, cover reads Add a flyer', () => {
    expect(goLiveLabel('no_session_first_date')).toBe('Add a session');
    expect(goLiveLabel('cover')).toBe('Add a flyer');
    expect(goLiveLabel('no_payment')).toBe('Add how to pay');
  });
});

// F6: v7 not-found screen (line 569): title + one-line next step.
describe('not-found words are prototype v7', () => {
  it.each([
    ['not-found-archived', 'This event was archived', 'It no longer shows on the calendar. Ask us if you need it back.'],
    ['no-access', 'You can’t open this event', 'It belongs to another organiser page. Ask its owner to add you to their team.'],
    ['gone', 'We can’t find this event', 'The link may be old.'],
  ] as const)('%s', (state, title, line) => {
    expect(notFoundLines(state)).toEqual({ title, line });
  });
});

// F13 + owner decision 5: a retried invite or cancel is a success.
describe('retry counts as success (decision 5)', () => {
  it.each([
    [{ message: 'invalid_payload: already invited' }, true],
    [{ message: 'already linked' }, true],
    [{ message: 'invalid_payload: this invite is no longer open' }, true],
    [{ message: 'permission_denied: x' }, false],
    [null, false],
    ['already invited', false],
  ] as const)('%j', (error, want) => {
    expect(isRetrySuccess(error)).toBe(want);
  });
});
