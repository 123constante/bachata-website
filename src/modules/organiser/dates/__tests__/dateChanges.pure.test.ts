import { describe, expect, it } from 'vitest';
import { toDraft, type WireSession } from '@/modules/organiser/shared/programmeModel';
import { cancelWords, copyRowsFrom, copySources, firstStart, moveDayProblem, ownTag, shiftOptions, shiftRows } from '../dateChanges';

const wire = (id: string, start: string | null, end: string | null, extra: Record<string, unknown> = {}): WireSession => ({
  series_item_id: id, type: 'class', title: id, start_time: start, end_time: end, ends_next_day: false, level_keys: [], removed: false, ...extra,
});
const rows = toDraft([wire('a', '20:00', '21:00'), wire('b', '21:00', '23:30'), wire('c', null, null)]);

describe('time shift (all sessions of the date)', () => {
  it.each([[30, '20:30', '21:30', '21:30', '00:00'], [-120, '18:00', '19:00', '19:00', '21:30'], [0, '20:00', '21:00', '21:00', '23:30']])(
    'by %i minutes', (delta, s1, e1, s2, e2) => {
      const out = shiftRows(rows, delta);
      expect([out[0].start, out[0].end, out[1].start, out[1].end]).toEqual([s1, e1, s2, e2]);
      expect(out[2].start).toBe(''); // an untimed session stays untimed
    });
  it('a removed session is left alone; first start follows rollover', () => {
    const r = toDraft([wire('a', '01:00', '03:00'), wire('b', '22:00', '23:00')]);
    expect(firstStart(r)).toBe('22:00');
    expect(shiftRows([{ ...r[1], removed: true }], 60)[0].start).toBe('22:00');
  });
  it('every option is a valid time and 0 is "now"', () => {
    const o = shiftOptions('20:00');
    expect(o).toHaveLength(17);
    expect(o.find((x) => x.delta === 0)?.label).toBe('20:00 (now)');
    expect(o.every((x) => /^\d{2}:\d{2}( \(now\))?$/.test(x.label))).toBe(true);
  });
});

describe('own-changes tag', () => {
  it.each([
    ['venue of its own', { venueOverride: 'v2', start: '20:00' }, rows, 'Own changes'],
    ['date-only session', { venueOverride: null, start: '20:00' }, toDraft([wire('x', '20:00', '21:00', { series_item_id: undefined, added_session_id: 'z' })]), 'Own changes'],
    ['own time only', { venueOverride: null, start: '20:30' }, rows, 'Own times'],
    ['as usual', { venueOverride: null, start: '20:00' }, rows, null],
  ])('%s', (_n, detail, r, want) => {
    expect(ownTag(detail, r, '20:00:00')).toBe(want);
  });
  it('no detail, no tag', () => expect(ownTag(null, rows, '20:00')).toBeNull());
});

describe('cancel wording, move, copy', () => {
  // ER-FIX2-S6: superseded (decision 11). On the rebuilt screens a one-off's control is
  // "Cancel the event", parked with its reason; off the switch every format cancels its date.
  it('a one-off says Cancel the event (parked) on the rebuilt screens; otherwise Cancel this date', () => {
    expect(cancelWords('one_off', true)).toMatchObject({ label: 'Cancel the event', disabled: true });
    expect(cancelWords('one_off').label).toBe('Cancel this date');
    expect(cancelWords('recurring', true).label).toBe('Cancel this date');
    expect(cancelWords('festival', true).label).toBe('Cancel this date');
  });
  it.each([['', 'Pick a day'], ['2026-10-01', 'Pick a day from today'], ['2026-10-10', 'Pick a different day'], ['2026-10-12', null]])('move to %s', (to, want) => {
    expect(moveDayProblem(to, '2026-10-10', '2026-10-08')).toBe(want);
  });
  // ER-FIX2-S6 (F-C9-14): only dates with their own changes are listed.
  it('copy sources: other, coming, not cancelled, with own changes', () => {
    const d = (id: string, date: string, st = 'scheduled') => ({ id, occurrence_date: date, lifecycle_status: st, has_override: true });
    expect(copySources([d('1', '2026-10-09'), d('2', '2026-10-16', 'cancelled'), d('3', '2026-10-01'), d('4', '2026-10-23'), { ...d('5', '2026-10-30'), has_override: false }], '1', '2026-10-08').map((x) => x.id)).toEqual(['4']);
  });
  // ER-FIX2-S6 (F-C9-2): superseded. Copy no longer removes the series sessions and re-adds
  // them as date-only: the same session is edited (erFix2S6.pure.test.ts holds the shapes).
  it('copying edits the same series sessions, people follow, an unsaved new one is dropped', () => {
    const src = toDraft([wire('a', '19:00', '20:00', { type: 'party' })], [{ series_item_id: 'a', people: [{ profile_id: 'p9', display_name: 'DJ', role: 'djing' }, { profile_id: 'm1', display_name: 'MC', role: 'mc' }] }]);
    const out = copyRowsFrom([...rows, { ...rows[0], key: 'new:x', original: null }], src);
    expect(out.some((r) => r.key === 'new:x')).toBe(false);
    expect(out.every((r) => r.original && !r.removed)).toBe(true);
    const a = out.find((r) => r.original?.series_item_id === 'a');
    expect([a?.start, a?.end]).toEqual(['19:00', '20:00']);
    expect(a?.people?.map((p) => [p.id, p.origin])).toEqual([['p9', 'added']]);
  });
});
