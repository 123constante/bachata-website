import { describe, expect, it } from 'vitest';
import { rowOf, type HomeSeriesRow } from '../../data/home';
import { r4EventsOf, shortDay } from '../r4EventsModel';

const TODAY = '2026-11-18';
type Shape = { lifecycle: string; format: string; venue: string | null; dates: string[]; start?: string | null };

/** A home_v1 series row in the prod shapes surveyed 2026-11-18 (lifecycle x format x venue x dates). */
function series(id: string, s: Shape): HomeSeriesRow {
  return {
    id, name: `Event ${id}`, lifecycle_status: s.lifecycle, format: s.format, category: null,
    default_venue_name: s.venue, default_cover_image_url: null, upcoming_count: s.dates.length,
    next_dates: s.dates.map((d) => ({ occurrence_date: d, status: 'scheduled', starts_at: s.start === null ? null : `${d}T21:00:00Z`, start_time: s.start === null ? null : '21:00', venue_name: null })),
  } as unknown as HomeSeriesRow;
}
const rowsOf = (shapes: Record<string, Shape>) => Object.entries(shapes).map(([id, s]) => rowOf(series(id, s), TODAY));

describe('R4 Events: every prod shape lands in one section with an honest pill', () => {
  it.each([
    // [case, shape, section, pill tone]
    ['live recurring, date this week', { lifecycle: 'live', format: 'recurring', venue: 'Soho', dates: ['2026-11-20', '2026-11-27'] }, 'week', 'ok'],
    ['live recurring, next date later', { lifecycle: 'live', format: 'recurring', venue: 'Soho', dates: ['2026-12-04'] }, 'later', 'ok'],
    ['live recurring, nothing coming (warn)', { lifecycle: 'live', format: 'recurring', venue: 'Soho', dates: [] }, 'later', 'live'],
    ['live one-off, run its course', { lifecycle: 'live', format: 'one_off', venue: 'Soho', dates: [] }, 'past', 'grey'],
    ['live festival, later', { lifecycle: 'live', format: 'festival', venue: 'Hall', dates: ['2027-02-10'] }, 'later', 'ok'],
    ['live course this week', { lifecycle: 'live', format: 'course', venue: 'Studio', dates: ['2026-11-19', '2026-11-26'] }, 'week', 'ok'],
    ['draft recurring, no venue, this week', { lifecycle: 'draft', format: 'recurring', venue: null, dates: ['2026-11-21'] }, 'week', 'grey'],
    ['draft one-off, no venue, no dates', { lifecycle: 'draft', format: 'one_off', venue: null, dates: [] }, 'later', 'grey'],
    ['paused recurring, this week', { lifecycle: 'paused', format: 'recurring', venue: 'Soho', dates: ['2026-11-22'] }, 'week', 'grey'],
    ['ended recurring, no dates', { lifecycle: 'ended', format: 'recurring', venue: 'Soho', dates: [] }, 'past', 'grey'],
    ['ended recurring with dates still on file', { lifecycle: 'ended', format: 'recurring', venue: 'Soho', dates: ['2026-11-20'] }, 'past', 'grey'],
    ['archived one-off, no venue', { lifecycle: 'archived', format: 'one_off', venue: null, dates: [] }, 'past', 'grey'],
    ['archived recurring with dates', { lifecycle: 'archived', format: 'recurring', venue: null, dates: ['2026-11-20'] }, 'past', 'grey'],
  ] as const)('%s', (_c, shape, section, tone) => {
    const m = r4EventsOf(rowsOf({ a: shape as Shape }), TODAY);
    const where = (['week', 'later', 'past'] as const).filter((k) => m[k].length === 1);
    expect(where).toEqual([section]);
    expect(m[section][0].pill.tone).toBe(tone);
    expect(m[section][0].pill.word).toBeTruthy();
  });

  it('draft with no place says what it needs; a repeating series counts its dates', () => {
    const m = r4EventsOf(rowsOf({
      d: { lifecycle: 'draft', format: 'recurring', venue: null, dates: ['2026-11-21'] },
      w: { lifecycle: 'live', format: 'recurring', venue: 'Soho', dates: ['2026-11-20', '2026-11-27', '2026-12-04'] },
    }), TODAY);
    const byId = Object.fromEntries(m.week.map((r) => [r.id, r]));
    expect(byId.d.extra).toBe('Needs a place');
    expect(byId.w.extra).toBe('3 dates coming up');
    expect(byId.w.when).toMatch(/^Fri 20 Nov, (.+, )?Soho$/); // no start on file = no time words
  });

  it('the 7-day edge: today + 6 is this week, today + 7 is later', () => {
    const m = r4EventsOf(rowsOf({
      e: { lifecycle: 'live', format: 'one_off', venue: 'X', dates: ['2026-11-24'] },
      f: { lifecycle: 'live', format: 'one_off', venue: 'X', dates: ['2026-11-25'] },
    }), TODAY);
    expect(m.week.map((r) => r.id)).toEqual(['e']);
    expect(m.later.map((r) => r.id)).toEqual(['f']);
  });

  it('no rows = empty; unknown today never claims This week', () => {
    expect(r4EventsOf([], TODAY).empty).toBe(true);
    const m = r4EventsOf(rowsOf({ a: { lifecycle: 'live', format: 'recurring', venue: 'S', dates: ['2026-11-20'] } }), '');
    expect(m.week).toEqual([]);
  });

  it('shortDay reads the calendar day', () => {
    expect(shortDay('2026-11-20')).toBe('Fri 20 Nov');
    expect(shortDay('2027-01-03')).toBe('Sun 3 Jan');
  });
});
