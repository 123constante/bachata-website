import { describe, expect, it } from 'vitest';
import {
  L,
  byStart,
  daySessions,
  endsNextDay,
  kindWordFromSessions,
  sessionKindLabel,
  span,
  spanText,
  startPhrase,
  timeWord,
  type P3Event,
  type P3Session,
} from '..';

/*
 * Shapes read from prod (event_series_program_item_p5, read-only SELECT, 25 Oct 2026):
 * type party 370 / class 280 / masterclass 19 / performance 3 / workshop 2 / competition 1 / show 1;
 * start_time NULL on 223 items (220 of them parties); times are 'HH:MM:SS'; 80 end <= start.
 * Red first: these failed on the first cut of the model (kind 'social', start always a string).
 */
const S = (id: string, kind: P3Session['kind'], start: string | null, end: string | null): P3Session =>
  ({ id, kind, title: null, start, end, people: [] });

const prodTimes: P3Event = {
  kind: 'weekly',
  sessions: [S('p', 'party', '21:00:00', '01:00:00'), S('c', 'class', '20:00:00', '21:00:00')],
  dates: [{ date: '2026-10-30', status: 'scheduled' }],
};
const untimedParty: P3Event = {
  kind: 'weekly',
  sessions: [S('p', 'party', null, null), S('c', 'class', '19:30:00', '20:30:00')],
  dates: [{ date: '2026-10-30', status: 'scheduled' }],
};
const allUntimed: P3Event = { kind: 'oneoff', sessions: [S('p', 'party', null, null)], dates: [] };

describe('prod item types', () => {
  it.each<[P3Session['kind'], string]>([
    ['party', 'Party'], ['class', 'Class'], ['workshop', 'Workshop'], ['show', 'Show'],
    ['masterclass', 'Masterclass'], ['performance', 'Performance'], ['competition', 'Competition'],
  ])('%s -> %s', (k, w) => {
    expect(sessionKindLabel(k)).toBe(w);
  });
  it('the party (stored "party") is the main session of the long phrase', () => {
    expect(startPhrase(prodTimes.sessions, { long: true })).toBe('Party 9pm, class from 8pm');
  });
  it('kind word from prod types goes through eventCategory', () => {
    expect(kindWordFromSessions('recurring', prodTimes.sessions)).toBe('Night');
    expect(kindWordFromSessions('recurring', [S('m', 'masterclass', '12:00:00', '13:00:00')])).toBe('Masterclass');
  });
});

describe('HH:MM:SS times', () => {
  it('read like HH:MM', () => {
    expect(timeWord('21:30:00')).toBe('9:30pm');
    expect(spanText(daySessions(prodTimes))).toBe('8pm to 1am (ends the next day)');
    expect(endsNextDay({ start: '21:00:00', end: '01:00:00' })).toBe(true);
  });
});

describe('sessions with no start time (223 prod items)', () => {
  it('never crash and never decide the start', () => {
    expect(startPhrase(untimedParty.sessions, { long: true })).toBe('7:30pm');
    expect(spanText(daySessions(untimedParty))).toBe('7:30pm to 8:30pm');
  });
  it('sort after every timed session', () => {
    expect(daySessions(untimedParty).map((m) => m.id)).toEqual(['c', 'p']);
    expect([S('a', 'party', null, null), S('b', 'class', '20:00', '21:00')].sort(byStart).map((s) => s.id)).toEqual(['b', 'a']);
  });
  it('all untimed = no time yet, never "12am"', () => {
    expect(startPhrase(allUntimed.sessions, { long: true })).toBe(L.noTime);
    expect(span(daySessions(allUntimed))).toBeNull();
    expect(spanText(daySessions(allUntimed))).toBe(L.noTime);
    expect(endsNextDay({ start: null, end: null })).toBe(false);
  });
  it('a start with no end still gives the start', () => {
    expect(spanText([{ start: '21:00:00', end: null }])).toBe('From 9pm');
  });
});
