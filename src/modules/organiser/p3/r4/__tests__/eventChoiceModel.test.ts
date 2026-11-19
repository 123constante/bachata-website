// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { EVENT_STORE_KEY, defaultEventId, readStoredEvent, resolveEventId, storeEvent, type ChoiceRow } from '../eventChoiceModel';

const T = '2026-11-17';
const row = (id: string, name: string, lifecycle: string, next: string | null): ChoiceRow => ({ id, name, lifecycle, next: next ? { date: next } : null });

afterEach(() => window.sessionStorage.clear());

describe('defaultEventId: the organiser’s next event', () => {
  it.each<[string, ChoiceRow[], string | null]>([
    ['no events', [], null],
    ['soonest live coming date wins', [row('a', 'Alpha', 'live', '2026-11-30'), row('b', 'Beta', 'live', '2026-11-20')], 'b'],
    ['tonight counts as coming', [row('a', 'Alpha', 'live', T), row('b', 'Beta', 'live', '2026-11-18')], 'a'],
    ['a live coming date beats a sooner draft date', [row('d', 'Draft', 'draft', '2026-11-18'), row('l', 'Live', 'live', '2026-12-01')], 'l'],
    ['only drafts with dates: soonest draft', [row('d1', 'D1', 'draft', '2026-12-05'), row('d2', 'D2', 'draft', '2026-12-01')], 'd2'],
    ['a past next date is not coming', [row('p', 'Past', 'live', '2026-11-01'), row('q', 'Quiet', 'paused', null)], 'p'],
    ['nothing coming, no live: first by name', [row('z', 'Zed', 'draft', null), row('m', 'Mid', 'paused', null)], 'm'],
    ['same date: name breaks the tie', [row('2', 'Bachata B', 'live', '2026-11-20'), row('1', 'Bachata A', 'live', '2026-11-20')], '1'],
  ])('%s', (_n, rows, want) => {
    expect(defaultEventId(rows, T)).toBe(want);
    // order of the list never changes the answer
    expect(defaultEventId([...rows].reverse(), T)).toBe(want);
  });
});

describe('resolveEventId: URL, then this visit, then the default', () => {
  const rows = [row('a', 'Alpha', 'live', '2026-11-30'), row('b', 'Beta', 'live', '2026-11-20')];
  it.each<[string, string | null, string | null, string | null]>([
    ['URL choice kept on refresh', 'a', null, 'a'],
    ['URL beats the stored one', 'a', 'b', 'a'],
    ['bare tab URL: the stored one', null, 'a', 'a'],
    ['an unknown URL id is ignored', 'nope', null, 'b'],
    ['an unknown stored id is ignored', null, 'gone', 'b'],
    ['nothing given: the default', null, null, 'b'],
  ])('%s', (_n, urlId, storedId, want) => {
    expect(resolveEventId({ urlId, storedId, rows, today: T })).toBe(want);
  });
  it('no events: nothing is chosen, whatever the URL says', () => {
    expect(resolveEventId({ urlId: 'a', storedId: 'a', rows: [], today: T })).toBeNull();
  });
});

describe('storage: a convenience only', () => {
  it('stores and reads back', () => {
    storeEvent('a');
    expect(window.sessionStorage.getItem(EVENT_STORE_KEY)).toBe('a');
    expect(readStoredEvent()).toBe('a');
  });
  it('a throwing storage reads as nothing and never throws', () => {
    const orig = Object.getOwnPropertyDescriptor(window, 'sessionStorage')!;
    Object.defineProperty(window, 'sessionStorage', { configurable: true, get: () => { throw new Error('blocked'); } });
    try {
      expect(readStoredEvent()).toBeNull();
      expect(() => storeEvent('a')).not.toThrow();
    } finally {
      Object.defineProperty(window, 'sessionStorage', orig);
    }
  });
});
