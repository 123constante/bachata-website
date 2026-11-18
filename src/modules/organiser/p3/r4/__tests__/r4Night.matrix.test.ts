import { describe, expect, it } from 'vitest';
import { rowOf, type HomeSeriesRow } from '../../data/home';
import { NO_NAME, r4NightOf } from '../r4NightModel';

const TODAY = '2026-11-18';
type Shape = { lifecycle: string; format: string; venue: string | null; dates: readonly string[]; status?: string };

/** A home_v1 series row in the prod shapes surveyed 2026-11-18 (lifecycle x format x venue x dates). */
function rowFor(s: Shape) {
  return rowOf({
    id: 's1', name: 'Friday Social', lifecycle_status: s.lifecycle, format: s.format, category: null,
    default_venue_name: s.venue, default_cover_image_url: null, default_local_start_time: '21:00:00', upcoming_count: s.dates.length,
    next_dates: s.dates.map((d) => ({ occurrence_date: d, lifecycle_status: s.status ?? 'scheduled', status: s.status ?? 'scheduled', starts_at: `${d}T21:00:00Z`, start_time: '21:00', venue_name: null })),
  } as unknown as HomeSeriesRow, TODAY);
}

const door = { sold: 41, cameIn: 0 };

describe('R4 Night: every prod shape gets an honest screen', () => {
  it.each([
    // [case, shape, door, cancellable, expect: nightDate, tiles, cancel on, pill tone]
    ['live weekly, night this week, tickets sold', { lifecycle: 'live', format: 'recurring', venue: 'Soho', dates: ['2026-11-20', '2026-11-27'] }, door, true, '2026-11-20', ['sold'], true, 'ok'],
    ['live weekly, no ticket read', { lifecycle: 'live', format: 'recurring', venue: 'Soho', dates: ['2026-11-20'] }, null, true, '2026-11-20', [], true, 'ok'],
    ['live weekly, nothing coming up', { lifecycle: 'live', format: 'recurring', venue: 'Soho', dates: [] }, null, false, null, [], false, 'live'],
    ['live one-off, run its course', { lifecycle: 'live', format: 'one_off', venue: 'Soho', dates: [] }, null, false, null, [], false, 'grey'],
    ['live festival later, door says 0 sold', { lifecycle: 'live', format: 'festival', venue: 'Hall', dates: ['2027-02-10'] }, { sold: 0, cameIn: 0 }, true, '2027-02-10', ['sold'], true, 'ok'],
    ['on the night, people in', { lifecycle: 'live', format: 'recurring', venue: 'Soho', dates: ['2026-11-18'] }, { sold: 41, cameIn: 12 }, true, '2026-11-18', ['sold', 'in'], true, 'ok'],
    ['draft, no venue, dated', { lifecycle: 'draft', format: 'recurring', venue: null, dates: ['2026-11-21'] }, null, false, '2026-11-21', [], false, 'grey'],
    ['draft one-off, nothing', { lifecycle: 'draft', format: 'one_off', venue: null, dates: [] }, null, false, null, [], false, 'grey'],
    ['paused, dated', { lifecycle: 'paused', format: 'recurring', venue: 'Soho', dates: ['2026-11-22'] }, null, true, '2026-11-22', [], true, 'grey'],
    ['ended with dates on file', { lifecycle: 'ended', format: 'recurring', venue: 'Soho', dates: ['2026-11-20'] }, null, false, '2026-11-20', [], false, 'grey'],
    ['live course, nothing coming (run its course)', { lifecycle: 'live', format: 'course', venue: 'Studio', dates: [] }, null, false, null, [], false, 'grey'],
    ['paused one-off, nothing', { lifecycle: 'paused', format: 'one_off', venue: 'Soho', dates: [] }, null, false, null, [], false, 'grey'],
    ['ended, only a cancelled date ahead', { lifecycle: 'ended', format: 'recurring', venue: 'Soho', dates: ['2026-11-20'], status: 'cancelled' }, null, false, null, [], false, 'grey'],
    ['next night cancelled', { lifecycle: 'live', format: 'recurring', venue: 'Soho', dates: ['2026-11-20'], status: 'cancelled' }, null, false, null, [], false, 'ok'],
  ] as const)('%s', (_c, shape, d, cancellable, nightDate, tiles, cancelOn, tone) => {
    const row = rowFor(shape as Shape);
    const m = r4NightOf({ row, name: 'Friday Social', place: (shape as Shape).venue, repeatWords: null, door: d, cancellable });
    expect(m.title).toBe('Friday Social');
    expect(m.nightDate).toBe(nightDate);
    expect(m.tiles.map((t) => t.key)).toEqual(tiles);
    expect(m.cancel.on).toBe(cancelOn);
    // a control that cannot work says why
    if (!m.cancel.on) expect(m.cancel.why).toBeTruthy();
    expect(m.pill?.tone).toBe(tone);
    // never a number without a read
    for (const t of m.tiles) expect(t.value).toMatch(/^\d+$/);
  });

  it('no home row yet (home_v1 reloading): the workspace name and place, no pill, no tiles', () => {
    const m = r4NightOf({ row: null, name: '  ', place: 'Soho', repeatWords: 'Every Friday', door: null, cancellable: true });
    expect(m).toMatchObject({ title: NO_NAME, when: 'Soho', repeat: 'Every Friday', pill: null, tiles: [], nightDate: null, doorRead: false });
  });

  it('repeat line joins the rule words with the dates coming up; "Needs a place" never lands there', () => {
    const live = r4NightOf({ row: rowFor({ lifecycle: 'live', format: 'recurring', venue: 'Soho', dates: ['2026-11-20', '2026-11-27', '2026-12-04'] }), name: 'x', place: 'Soho', repeatWords: 'Every Friday.', door: null, cancellable: true });
    expect(live.repeat).toBe('Every Friday, 3 dates coming up');
    expect(live.when).toMatch(/^Fri 20 Nov, 9(pm|:00pm), Soho$/);
    const draft = r4NightOf({ row: rowFor({ lifecycle: 'draft', format: 'recurring', venue: null, dates: ['2026-11-21'] }), name: 'x', place: null, repeatWords: null, door: null, cancellable: false });
    expect(draft.repeat).toBeNull();
  });
});
