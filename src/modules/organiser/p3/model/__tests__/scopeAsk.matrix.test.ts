import { describe, expect, it } from 'vitest';
import { upsertCommand, groupChatCommand } from '../../../shared/seriesCommands';
import {
  FIELD_WORD, needsScopeAsk, previewKeysOf, previewLine, scopeChoices, scopedChangesOf, ONE_DATE_WHY, MORE_DATES_NOTE,
  type PreviewTotals, type PreviewDate,
} from '../scopeAsk';
import { keptDatesLine } from '../saveWords';

const up = (p: Record<string, unknown>) => [upsertCommand({ name: 'N', ...p })];
const COVER = { default_cover_image_url: 'https://x.test/c.jpg' };
const GALLERY = { default_gallery: ['https://x.test/1.jpg'] };
const VENUE = { default_venue_id: 'v1', default_city_id: 'c1' };
const PASSES = { default_passes: [{ id: 'a', name: 'Entry', price: 10 }] };

describe('scopedChangesOf: which fields of a plan the scoped call can carry', () => {
  const rows: Array<[string, Record<string, unknown>, string[], boolean]> = [
    ['cover alone', COVER, ['cover_image_url'], false],
    ['gallery alone', GALLERY, ['gallery'], false],
    ['venue alone (both keys travel)', VENUE, ['venue'], false],
    ['passes alone', PASSES, ['passes'], false],
    ['cover + passes', { ...COVER, ...PASSES }, ['cover_image_url', 'passes'], false],
    ['description alone is not scoped', { default_description: 'x' }, [], true],
    ['cover + description', { ...COVER, default_description: 'x' }, ['cover_image_url'], true],
    ['venue without a city is refused by the model (stays an all-dates upsert)', { default_venue_id: 'v1', default_city_id: null }, [], true],
  ];
  it.each(rows)('%s', (_n, payload, fields, unscoped) => {
    const s = scopedChangesOf(up(payload));
    expect(s.fields).toEqual(fields);
    expect(s.unscopedChanged).toBe(unscoped);
  });
  it('the changes carry the values, venue with city_id, keys without the default_ prefix', () => {
    expect(scopedChangesOf(up(VENUE)).changes).toEqual({ venue_id: 'v1', city_id: 'c1' });
    expect(scopedChangesOf(up({ ...COVER, ...PASSES })).changes).toEqual({ cover_image_url: 'https://x.test/c.jpg', passes: PASSES.default_passes });
  });
  it('a name change, or the chat command, counts as an unscoped change', () => {
    expect(scopedChangesOf(up(COVER), true).unscopedChanged).toBe(true);
    expect(scopedChangesOf([...up(COVER), groupChatCommand('https://chat.test')]).unscopedChanged).toBe(true);
  });
  it('an empty plan has nothing', () => {
    expect(scopedChangesOf([])).toEqual({ fields: [], changes: {}, unscopedChanged: false });
  });
  it('the preview asks venue as venue_id, each key once', () => {
    expect(previewKeysOf(['cover_image_url', 'venue', 'passes'])).toEqual(['cover_image_url', 'venue_id', 'passes']);
  });
});

describe('needsScopeAsk: field x future dates', () => {
  const cases: Array<[string[], number, boolean]> = [];
  for (const f of [['cover_image_url'], ['gallery'], ['venue'], ['passes'], ['cover_image_url', 'passes'], []]) {
    for (const n of [0, 1, 2, 52]) cases.push([f, n, f.length > 0 && n >= 2]);
  }
  it.each(cases)('fields %j, %i future dates -> %s', (fields, n, want) => {
    expect(needsScopeAsk({ changedScoped: fields as never, unscopedChanged: false, futureDates: n })).toBe(want);
    expect(needsScopeAsk({ changedScoped: fields as never, unscopedChanged: true, futureDates: n })).toBe(want);
  });
});

describe('scopeChoices: the sheet\'s two buttons', () => {
  it('scoped only: both enabled', () => {
    expect(scopeChoices({ unscopedChanged: false })).toEqual({ oneEnabled: true, oneWhy: null, allSendsPlain: false });
  });
  it('scoped + unscoped: one date disabled with its reason; all dates is today\'s single upsert', () => {
    expect(scopeChoices({ unscopedChanged: true })).toEqual({ oneEnabled: false, oneWhy: ONE_DATE_WHY, allSendsPlain: true });
    expect(ONE_DATE_WHY).toBe('Name, description, music and the other details change every date. Save those first, then change this one.');
  });
});

const totals = (t: Partial<PreviewTotals>): PreviewTotals => ({ dates: 3, applied: 3, kept: 0, curated_but_inherits: 0, ...t });
const d = (id: string, date: string, kept: string[] = []): PreviewDate => ({ occurrence_id: id, occurrence_date: date, kept_fields: kept, applied_fields: kept.length ? [] : ['x'] });

describe('previewLine: exact copy', () => {
  it('none kept', () => {
    expect(previewLine(totals({}), [d('a', '2026-11-07'), d('b', '2026-11-14'), d('c', '2026-11-21')], ['cover_image_url'])).toBe('Every date changes.');
  });
  it('1 of 3 kept pictures', () => {
    const dates = [d('a', '2026-11-07'), d('b', '2026-11-14', ['cover_image_url']), d('c', '2026-11-21')];
    expect(previewLine(totals({ applied: 2, kept: 1 }), dates, ['cover_image_url'])).toBe('2 dates change. 1 keeps its own pictures because you edited it by hand.');
  });
  it('3 of 3 kept', () => {
    const dates = ['2026-11-07', '2026-11-14', '2026-11-21'].map((x, i) => d(String(i), x, ['gallery']));
    expect(previewLine(totals({ applied: 0, kept: 3 }), dates, ['gallery'])).toBe('No date changes. All 3 keep their own pictures because you edited them by hand.');
  });
  it('kept on the venue says place; 2 kept', () => {
    const dates = [d('a', '2026-11-07'), d('b', '2026-11-14', ['venue_id', 'city_id']), d('c', '2026-11-21', ['venue_id'])];
    expect(previewLine(totals({ applied: 1, kept: 2 }), dates, ['venue'])).toBe('1 date changes. 2 keep their own place because you edited them by hand.');
  });
  it('a date curated but inheriting is not kept and is not mentioned', () => {
    const dates = [d('a', '2026-11-07'), d('b', '2026-11-14'), d('c', '2026-11-21')];
    expect(previewLine(totals({ curated_but_inherits: 1 }), dates, ['passes'])).toBe('Every date changes.');
  });
  it('field words', () => {
    expect(FIELD_WORD).toEqual({ cover_image_url: 'pictures', gallery: 'pictures', venue: 'place', passes: 'prices' });
  });
});

describe('keptDatesLine: the post-save line, from the reply', () => {
  it('none -> empty; one; many', () => {
    expect(keptDatesLine(0, 'pictures')).toBe('');
    expect(keptDatesLine(1, 'prices')).toBe('1 date kept its own prices.');
    expect(keptDatesLine(4, 'place')).toBe('4 dates kept their own place.');
  });
  it('more than 8 dates has the plain note, no link', () => {
    expect(MORE_DATES_NOTE).toBe('Use the date’s own page for later dates.');
  });
});

describe('real shapes (prod counts, 2026-11-04): 385 override rows, 10 series with a future overridden date', () => {
  const four = ['2026-11-07', '2026-11-14', '2026-11-21', '2026-11-28'];
  it('a series with 0 overridden dates: one calm line', () => {
    const dates = four.map((x, i) => d(String(i), x));
    expect(previewLine(totals({ dates: 4, applied: 4 }), dates, ['cover_image_url'])).toBe('Every date changes.');
  });
  it('1 of 4 overridden for cover', () => {
    const dates = four.map((x, i) => d(String(i), x, i === 1 ? ['cover_image_url'] : []));
    expect(previewLine(totals({ dates: 4, applied: 3, kept: 1 }), dates, ['cover_image_url'])).toBe('3 dates change. 1 keeps its own pictures because you edited it by hand.');
  });
  it('all overridden for gallery', () => {
    const dates = four.map((x, i) => d(String(i), x, ['gallery']));
    expect(previewLine(totals({ dates: 4, applied: 0, kept: 4 }), dates, ['gallery'])).toBe('No date changes. All 4 keep their own pictures because you edited them by hand.');
  });
});
