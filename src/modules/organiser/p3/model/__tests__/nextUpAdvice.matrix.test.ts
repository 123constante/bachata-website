import { describe, expect, it } from 'vitest';
import type { HomeSeriesRow } from '../../data/home';
import { rowsOf } from '../../data/home';
import { nextUpAdviceOf } from '../status';
import { SHAPES, homeOf } from '../../screens/__tests__/fixtures';

/**
 * FIXLIST F-16 (HOME-COPY): the ONE mapping behind Home's "Nothing coming up" card, over every
 * prod shape INVENTORY.md names (prod 2026-10-31: 9 live-but-past one-offs, 5 live-but-past
 * courses). An event tagged Finished is never told to add dates; "Add an event" goes with the
 * New event control; every other state points at Events, where its fix lives.
 */
const archived: HomeSeriesRow = { ...SHAPES.ended, id: 'archived', lifecycle_status: 'archived' };
const pausedEmpty: HomeSeriesRow = { ...SHAPES.paused, upcoming_count: 0, next_dates: [] };

const CASES: Array<[string, HomeSeriesRow[], 'events' | 'new', RegExp]> = [
  ['ended', [SHAPES.ended], 'new', /Add an event and its next date shows here/],
  ['live-past one-off', [SHAPES.oneoffPast], 'events', /cannot take new dates/],
  ['live-past course', [SHAPES.courseDone], 'events', /cannot take new dates/],
  ['live-past one-off beside ended', [SHAPES.oneoffPast, SHAPES.ended], 'events', /cannot take new dates/],
  ['live weekly, no future dates', [SHAPES.allCancelled], 'events', /Your repeating event has no dates coming up. Open it in Events and add dates/],
  ['live weekly no future beside a finished course', [SHAPES.courseDone, SHAPES.allCancelled], 'events', /add dates/],
  ['draft', [SHAPES.draft], 'events', /A draft is not live yet. Open it in Events and put it live/],
  ['paused, nothing coming', [pausedEmpty], 'events', /One of your events is hidden. Open it in Events and show it again/],
  ['draft beside ended', [SHAPES.draft, SHAPES.ended], 'events', /put it live/],
];

describe('F-16 nextUpAdviceOf x every prod shape', () => {
  it.each(CASES)('%s', (_n, series, action, says) => {
    const rows = rowsOf(homeOf(series));
    const a = nextUpAdviceOf(rows);
    expect(a.action).toBe(action);
    expect(a.copy).toMatch(says);
    // dates are never offered when every listed event is Finished
    if (rows.every((r) => r.status.key === 'finished')) expect(a.copy).not.toMatch(/add dates/i);
    // "Add an event" only with the New event control; Events named only with the Events control
    expect(/Add an event/.test(a.copy)).toBe(action === 'new');
    expect(/Events/.test(a.copy)).toBe(action === 'events');
  });

  it('archived is not listed (Home shows its 0-events state, which carries Add an event)', () => {
    expect(rowsOf(homeOf([archived]))).toHaveLength(0);
    expect(nextUpAdviceOf(rowsOf(homeOf([archived, SHAPES.ended]))).action).toBe('new');
  });

  it('a shape with a date coming up never reaches the card (Next up shows instead)', () => {
    for (const s of [SHAPES.weekly, SHAPES.over100, SHAPES.course, SHAPES.oneoff]) {
      expect(rowsOf(homeOf([s]))[0].next).not.toBeNull();
    }
  });
});
