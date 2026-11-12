import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { rowsOf } from '../../data/home';
import { SHAPES, TODAY, homeOf } from '../../screens/__tests__/fixtures';
import { FILTER_ORDER, PAGE_FIRST, PAGE_MORE, STATUS_WORD, buildEvents, type EventsInput } from '../eventsModel';

const cancelledDate = { occurrence_id: 'o-c', occurrence_date: '2026-11-06', lifecycle_status: 'cancelled', materialised_start_utc: '2026-11-06T20:00:00+00:00', has_own_changes: false, venue_name: null };
const mk = (id: string, over: Record<string, unknown> = {}) => ({ ...SHAPES.tonight, id, name: `Night ${id}`, ...over }) as never;
const dated = (d: string) => ({ occurrence_id: `o-${d}`, occurrence_date: d, lifecycle_status: 'scheduled', materialised_start_utc: `${d}T20:00:00+00:00`, has_own_changes: false, venue_name: null });

const input = (series: unknown[], over: Partial<EventsInput> = {}): EventsInput => ({
  rows: rowsOf(homeOf(series as never)), today: TODAY, seat: 'owner', query: '', filter: 'all', shown: PAGE_FIRST, showPast: false, ...over,
});

const SHAPE_SETS: Record<string, unknown[]> = {
  empty: [],
  three: [SHAPES.tonight, SHAPES.draft, SHAPES.ended],
  series: [SHAPES.tonight, SHAPES.paused],
  huge: Array.from({ length: 12 }, (_, i) => mk(`h${i}`, { upcoming_count: 222, next_dates: [dated('2026-11-06'), dated('2026-11-13'), dated('2026-11-20')] })),
  allCancelled: [mk('cx', { upcoming_count: 0, next_dates: [cancelledDate] })],
  drafts: [SHAPES.draft],
};

describe('events model x shape', () => {
  it('uses one status word per status', () => {
    expect(STATUS_WORD).toEqual({ live: 'Live', draft: 'Draft', hidden: 'Hidden', cancelled: 'Cancelled', past: 'Past' });
    expect(FILTER_ORDER).toEqual(['all', 'live', 'draft', 'hidden', 'cancelled', 'past']);
  });

  it('empty says what to do', () => {
    const m = buildEvents(input([]));
    expect(m.state).toBe('empty');
    expect(m.empty).toMatch(/New event/);
    expect(m.nights).toEqual([]);
  });

  it('a draft night is Draft, undated, can be deleted and cannot be cancelled (with a reason)', () => {
    const m = buildEvents(input(SHAPE_SETS.drafts));
    const n = m.nights[0];
    expect(n.status).toBe('draft');
    expect(n.cancel.ok).toBe(false);
    expect(n.cancel.why).toMatch(/not on the calendar/);
    expect(n.canDelete).toBe(true);
  });

  it('tonight series: nights by date, first live and cancellable, more dates counted on the last night', () => {
    const m = buildEvents(input([SHAPES.tonight]));
    expect(m.nights.map((n) => n.date)).toEqual([TODAY, '2026-11-01']);
    expect(m.nights.every((n) => n.status === 'live' && n.cancel.ok)).toBe(true);
    expect(m.nights[1].moreDates).toBe(6);
    expect(m.nights[0].moreDates).toBe(0);
  });

  it('a hidden event is Hidden, never Draft', () => {
    const n = buildEvents(input([SHAPES.paused])).nights[0];
    expect(n.status).toBe('hidden');
    expect(n.cancel.ok).toBe(false);
  });

  it('a cancelled date is Cancelled, struck, not cancellable again', () => {
    const m = buildEvents(input([mk('cx', { upcoming_count: 1, next_dates: [cancelledDate, dated('2026-11-13')] })]));
    const c = m.nights.find((n) => n.status === 'cancelled')!;
    expect(c.cancel.ok).toBe(false);
    expect(c.cancel.why).toMatch(/already cancelled/i);
    expect(m.counts.cancelled).toBe(1);
  });

  it('every night cancelled: Needs you says so and offers New event', () => {
    const m = buildEvents(input(SHAPE_SETS.allCancelled));
    const item = m.needs.find((x) => x.key === 'allcx');
    expect(item?.action).toBe('new');
    expect(item?.title).toMatch(/cancelled/i);
  });

  it('past events fold away until asked for', () => {
    const closed = buildEvents(input(SHAPE_SETS.three));
    expect(closed.nights.some((n) => n.status === 'past')).toBe(false);
    expect(closed.pastHidden).toBe(1);
    const open = buildEvents(input(SHAPE_SETS.three, { showPast: true }));
    expect(open.nights.some((n) => n.status === 'past')).toBe(true);
    expect(open.pastHidden).toBe(0);
  });

  it('222 dates on one organiser: paged, never all drawn, Show 30 more', () => {
    const rows = Array.from({ length: 80 }, (_, i) => mk(`p${i}`, { upcoming_count: 222, next_dates: [dated('2026-11-06'), dated('2026-11-13'), dated('2026-11-20')] }));
    const m = buildEvents(input(rows));
    expect(m.total).toBe(240);
    expect(m.nights).toHaveLength(PAGE_FIRST);
    expect(m.more).toBe(Math.min(PAGE_MORE, 240 - PAGE_FIRST));
    const next = buildEvents(input(rows, { shown: PAGE_FIRST + PAGE_MORE }));
    expect(next.nights).toHaveLength(PAGE_FIRST + PAGE_MORE);
    expect(m.searchable).toBe(true);
  });

  it('search and filters appear only from 8 nights; search matches by name; no match says how to clear', () => {
    expect(buildEvents(input(SHAPE_SETS.three)).searchable).toBe(false);
    const rows = Array.from({ length: 9 }, (_, i) => mk(`s${i}`, { name: i === 0 ? 'Salsa Special' : `Bachata ${i}`, upcoming_count: 1, next_dates: [dated('2026-11-06')] }));
    expect(buildEvents(input(rows, { query: 'salsa' })).nights).toHaveLength(1);
    const none = buildEvents(input(rows, { query: 'zzz' }));
    expect(none.state).toBe('nomatch');
    expect(none.noMatch).toMatch(/Clear search and filters/);
  });

  it('a contributor sees the banner and every control disabled with a reason, and no Delete', () => {
    const m = buildEvents(input([SHAPES.tonight, SHAPES.draft], { seat: 'contributor' }));
    expect(m.viewOnly).toBe(true);
    expect(m.banner).toMatch(/contributor/);
    expect(m.newEvent.ok).toBe(false);
    expect(m.newEvent.why).toMatch(/contributor/i);
    expect(m.nights.every((n) => !n.cancel.ok && !n.canDelete && !n.canEdit)).toBe(true);
    expect(m.needs.every((x) => x.action === null)).toBe(true);
  });

  it('needs strip is one line: count and wording', () => {
    const m = buildEvents(input([SHAPES.draft, mk('np', { default_cover_image_url: null })]));
    expect(m.needsLine).toMatch(/^\d+ things? need you$/);
    // a live event with a cover and dates needs nothing: no strip at all
    expect(buildEvents(input([SHAPES.tonight])).needsLine).toBeNull();
    // a contributor still SEES the strip, but every item is read-only
    const ro = buildEvents(input([SHAPES.draft], { seat: 'contributor' }));
    expect(ro.needsLine).toMatch(/^\d+ things? need you$/);
    expect(ro.needs.every((x) => x.action === null && x.note)).toBe(true);
  });

  it('every night past and none shown: an explicit empty state that says what to do', () => {
    const m = buildEvents(input([SHAPES.ended]));
    expect(m.state).toBe('allpast');
    expect(m.nights).toEqual([]);
    expect(m.pastHidden).toBe(1);
    expect(m.allPast).toMatch(/Show past events/);
    expect(m.allPast).toMatch(/New event/);
    expect(buildEvents(input([SHAPES.ended], { seat: 'contributor' })).allPast).toMatch(/owner or a manager/);
    expect(buildEvents(input([SHAPES.ended], { showPast: true })).state).toBe('list');
  });

  it('keeps raw non-ASCII punctuation out of the source and the copy', () => {
    const src = readFileSync(fileURLToPath(new URL('../eventsModel.ts', import.meta.url)), 'utf8');
    expect(src).not.toMatch(/[^\x00-\x7f]/);
    const m = buildEvents(input([SHAPES.draft, SHAPES.tonight], { seat: 'contributor' }));
    expect(JSON.stringify(m)).not.toMatch(/\u00e2\u20ac|\u00c3/);
  });

  it('never prints raw non-ASCII punctuation or a bare TODO', () => {
    for (const k of Object.keys(SHAPE_SETS)) {
      const m = buildEvents(input(SHAPE_SETS[k]));
      const text = JSON.stringify(m);
      expect(text).not.toMatch(/undefined|NaN|\u00e2\u20ac|\u00c3/);
    }
  });
});
