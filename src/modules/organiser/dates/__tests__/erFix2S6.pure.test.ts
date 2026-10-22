// ER-FIX2-S6 (audit ER-AUDIT-dates.md): table-driven over the prod shapes the
// copy, move and night-start rules meet. Every case here was RED on 0a6fcce.
import { describe, expect, it } from 'vitest';
import { buildPayload, toDraft, validateProgramme, type WireSession } from '@/modules/organiser/shared/programmeModel';
import { cancelWords, copyFromDate, copySources, moveDayOptions, nightStartOptions } from '../dateChanges';

const item = (id: string, start: string | null, end: string | null, extra: Record<string, unknown> = {}): WireSession => ({
  series_item_id: id, type: 'party', title: id, start_time: start, end_time: end, ends_next_day: false, level_keys: [], removed: false, ...extra,
});
const added = (id: string, start: string | null, end: string | null, extra: Record<string, unknown> = {}): WireSession => ({
  added_session_id: id, type: 'class', title: id, start_time: start, end_time: end, ends_next_day: false, level_keys: [], removed: false, ...extra,
});
const people = (id: string, list: [string, string][], key = 'series_item_id') =>
  ({ [key]: id, people: list.map(([pid, role]) => ({ profile_id: pid, display_name: pid, role })) });

// The prod shapes (survey 2026-10-22): series sessions untimed (223) or untitled (239)
// on live series; date-only sessions all timed and titled (2 coming).
const SHAPES = [
  { name: 'untimed series party', target: [item('p', null, null)], source: [item('p', null, null)] },
  { name: 'untitled series party', target: [item('p', '21:00', '02:00', { title: null, ends_next_day: true })], source: [item('p', '21:00', '02:00', { title: null, ends_next_day: true })] },
  { name: 'untimed and untitled', target: [item('p', null, null, { title: null })], source: [item('p', null, null, { title: null })] },
  { name: 'timed, source has a date-only class', target: [item('p', '21:00', '23:00')], source: [item('p', '21:00', '23:00'), added('x', '20:00', '21:00')] },
  { name: 'source moved the party', target: [item('p', '21:00', '23:00')], source: [item('p', '22:00', '00:00', { ends_next_day: true })] },
];

describe('copy changes from another date (F-C9-1, F-C9-2)', () => {
  it.each(SHAPES)('$name: the copy validates and never re-creates a series session', ({ target, source }) => {
    const out = copyFromDate(toDraft(target), toDraft(source));
    expect(validateProgramme(out.rows).ok).toBe(true);
    const sent = buildPayload(out.rows);
    // Every series session of the target is still sent as itself, never removed.
    for (const t of target) {
      const el = sent.find((s) => s.series_item_id === t.series_item_id);
      expect(el, String(t.series_item_id)).toBeDefined();
      expect(el?.removed).toBe(false);
    }
  });

  it('a series session takes the source date\'s own time', () => {
    const out = copyFromDate(toDraft([item('p', '21:00', '23:00')]), toDraft([item('p', '22:00', '00:00', { ends_next_day: true })]));
    expect([out.rows[0].start, out.rows[0].end, out.rows[0].removed]).toEqual(['22:00', '00:00', false]);
  });

  it('an untimed source keeps the target\'s times (a stored time cannot be cleared)', () => {
    const out = copyFromDate(toDraft([item('p', '21:00', '23:00')]), toDraft([item('p', null, null)]));
    expect([out.rows[0].start, out.rows[0].end]).toEqual(['21:00', '23:00']);
    expect(validateProgramme(out.rows).ok).toBe(true);
  });

  it('a source date-only session goes on as new; the target\'s own date-only one comes off', () => {
    const out = copyFromDate(toDraft([item('p', '21:00', '23:00'), added('mine', '19:00', '20:00')]), toDraft([item('p', '21:00', '23:00'), added('x', '20:00', '21:00')]));
    expect(out.rows.find((r) => r.original?.added_session_id === 'mine')?.removed).toBe(true);
    const fresh = out.rows.filter((r) => !r.original);
    expect(fresh.map((r) => [r.title, r.start, r.end])).toEqual([['x', '20:00', '21:00']]);
  });

  it('a source date-only session with no time cannot be added: it is counted, not sent', () => {
    const out = copyFromDate(toDraft([item('p', '21:00', '23:00')]), toDraft([item('p', '21:00', '23:00'), added('x', null, null)]));
    expect(out.rows.filter((r) => !r.original)).toHaveLength(0);
    expect(out.skipped).toBe(1);
  });

  it('an untitled source date-only session gets its default name (the server needs one)', () => {
    const out = copyFromDate([], toDraft([added('x', '20:00', '21:00', { title: null })]));
    expect(out.rows[0].title).toBe('Class');
    expect(validateProgramme(out.rows).ok).toBe(true);
  });

  it('a session cancelled on the source comes off the target; people follow; an MC stays', () => {
    const target = toDraft([item('p', '21:00', '23:00'), item('q', '23:00', '01:00')],
      [people('p', [['dj1', 'djing'], ['mc1', 'mc']])]);
    const source = toDraft([item('p', '21:00', '23:00'), item('q', '23:00', '01:00', { removed: true })],
      [people('p', [['dj2', 'djing']])]);
    const out = copyFromDate(target, source);
    const p = out.rows.find((r) => r.original?.series_item_id === 'p');
    expect(p?.people?.map((x) => [x.id, x.origin, x.removed])).toEqual([['dj1', 'stored', true], ['mc1', 'stored', false], ['dj2', 'added', false]]);
    expect(out.rows.find((r) => r.original?.series_item_id === 'q')?.removed).toBe(true);
  });

  it('an unsaved new session of the target is dropped', () => {
    const out = copyFromDate([{ key: 'new:1', original: null, type: 'class', title: 'X', start: '19:00', end: '20:00', levels: [], removed: false, people: [] }], []);
    expect(out.rows).toHaveLength(0);
  });
});

describe('copy sources: only dates with their own changes (F-C9-14)', () => {
  const d = (id: string, date: string, own: Partial<{ has_override: boolean; added_sessions_count: number; session_overrides_count: number }> = {}, st = 'scheduled') =>
    ({ id, occurrence_date: date, lifecycle_status: st, has_override: false, added_sessions_count: 0, session_overrides_count: 0, ...own });
  it.each([
    ['as usual', {}, false],
    ['own venue', { has_override: true }, true],
    ['own session', { added_sessions_count: 1 }, true],
    ['session changed', { session_overrides_count: 2 }, true],
  ] as const)('%s', (_n, own, listed) => {
    expect(copySources([d('a', '2026-10-30', own)], 'me', '2026-10-22').length).toBe(listed ? 1 : 0);
  });
});

describe('one-off move: a list of valid days (F-C9-8)', () => {
  it('next 30 days from today, minus its own day and any taken day', () => {
    const days = moveDayOptions('2026-10-22', '2026-10-25', ['2026-10-25', '2026-10-27']);
    expect(days).toHaveLength(28);
    expect(days[0].date).toBe('2026-10-22');
    expect(days.some((x) => x.date === '2026-10-25' || x.date === '2026-10-27')).toBe(false);
    expect(days.every((x) => x.date >= '2026-10-22' && x.label.length > 0)).toBe(true);
  });
});

describe('night starts: inline choices marked (usual) (F-C9-12)', () => {
  it.each([
    ['20:00', '20:00:00', '20:00 (usual)'],
    ['20:30', '20:00:00', '20:00 (usual)'],
    ['20:00', null, null],
  ])('first %s, usual %s', (first, usual, want) => {
    const o = nightStartOptions(first, usual);
    expect(o.find((x) => x.delta === 0)?.time).toBe(first);
    expect(o.find((x) => x.label.endsWith('(usual)'))?.label ?? null).toBe(want);
    expect(o.every((x) => /^\d{2}:\d{2}$/.test(x.time))).toBe(true);
  });
});

describe('one-off "Cancel the event" is parked (F-C9-6, decision 11)', () => {
  it('rebuilt screens: disabled with the reason, never a date cancel', () => {
    expect(cancelWords('one_off', true)).toEqual({ label: 'Cancel the event', sub: 'Not available yet', disabled: true });
  });
  it.each([['recurring'], ['festival'], ['course']])('%s still cancels this date', (f) => {
    expect(cancelWords(f, true).disabled).toBe(false);
  });
});
