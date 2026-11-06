import { describe, expect, it } from 'vitest';
import { parseEventWorkspace } from '../../../events/eventModel';
import { occ, SHAPES, TODAY, weekly, wsRaw } from '../../screens/__tests__/wsFixtures';
import { DIFFERENT_FIELDS, differentDatesCount, differentLine, differentLineFor, type DifferentField } from '../differentDates';
import { ownDetailsOf } from '../../data/dateFacts';

const FUTURE = '2026-11-20';
const mk = (dates: unknown[], meta = {}) => parseEventWorkspace(wsRaw({}, [], dates, meta));
const withKeys = (date: string, keys: unknown, status = 'scheduled') => occ(date, status, { override_keys: keys });

describe('differentDatesCount.matrix', () => {
  const KEY_TO_FIELD: Array<[string, DifferentField]> = [
    ['title', 'name'], ['description', 'about'], ['cover_image_url', 'cover'], ['venue_id', 'where'], ['city_id', 'where'],
    ['ticket_url', 'ticket'], ['gallery', 'photos'], ['passes', 'price'], ['music_styles', 'music'],
  ];
  it.each(KEY_TO_FIELD)('key %s counts under %s only', (key, field) => {
    const c = differentDatesCount(mk([withKeys(FUTURE, [key])]), TODAY);
    for (const f of DIFFERENT_FIELDS) expect(c[f]).toBe(f === field ? 1 : 0);
  });
  it('no overrides, null, absent, non-array, unknown strings and the cancellation reason count nothing', () => {
    for (const keys of [[], null, undefined, 'title', 7, {}, ['cancellation_reason_label'], ['nonsense'], [1, null]]) {
      const c = differentDatesCount(mk([withKeys(FUTURE, keys)]), TODAY);
      expect(Object.values(c).every((n) => n === 0)).toBe(true);
    }
    expect(Object.values(differentDatesCount(mk([occ(FUTURE)]), TODAY)).every((n) => n === 0)).toBe(true);
  });
  it('several keys on one date count once per field', () => {
    const c = differentDatesCount(mk([withKeys(FUTURE, ['venue_id', 'city_id', 'title', 'bogus'])]), TODAY);
    expect(c.where).toBe(1); expect(c.name).toBe(1); expect(c.about).toBe(0);
  });
  it('cancelled and past dates are ignored; today counts', () => {
    const c = differentDatesCount(mk([withKeys(FUTURE, ['title'], 'cancelled'), withKeys('2026-10-01', ['title']), withKeys(TODAY, ['title'])]), TODAY);
    expect(c.name).toBe(1);
  });
  it.each([0, 1, 5])('%s dates own a ticket link', (n) => {
    const dates = weekly('2026-11-06', 6).map((d, i) => (i < n ? withKeys(d, ['ticket_url']) : occ(d)));
    expect(differentDatesCount(mk(dates), TODAY).ticket).toBe(n);
  });
  it('shapes: one-off, festival, over-100 series', () => {
    expect(differentDatesCount(parseEventWorkspace(SHAPES.oneoff), TODAY).name).toBe(0);
    expect(differentDatesCount(parseEventWorkspace(SHAPES.festival), TODAY).where).toBe(0);
    const over = mk(weekly('2026-11-06', 3).map((d) => withKeys(d, ['title'])), { has_more: true, total: 131 });
    expect(differentLineFor(over, 'name', TODAY)).toBe('Different on 3 of the dates shown');
    const exact = mk(weekly('2026-11-06', 3).map((d) => withKeys(d, ['title'])));
    expect(differentLineFor(exact, 'name', TODAY)).toBe('Different on 3 dates');
    expect(differentLineFor(mk(weekly('2026-11-06', 3).map((d) => withKeys(d, ['title'])), { total: 9 }), 'name', TODAY)).toBe('Different on 3 of the dates shown');
  });
  it('wording', () => {
    expect(differentLine(0, false)).toBeNull();
    expect(differentLine(0, true)).toBeNull();
    expect(differentLine(1, false)).toBe('Different on 1 date');
    expect(differentLine(2, false)).toBe('Different on 2 dates');
  });
  it('ownDetailsOf: a date whose only override is music is not plain; cancellation reason alone is', () => {
    const w = mk([withKeys(FUTURE, ['music_styles']), withKeys('2026-11-27', ['cancellation_reason_label']), occ('2026-12-04', 'scheduled', { has_override: true })]);
    expect(ownDetailsOf(w.dates.find((d) => d.occurrence_date === FUTURE)!)).toBe(true);
    expect(ownDetailsOf(w.dates.find((d) => d.occurrence_date === '2026-11-27')!)).toBe(false);
  });
});
