/* eslint-disable @typescript-eslint/no-explicit-any -- the reviewer's appendix test, kept verbatim: payload trees are walked loosely */
// REVIEW-SW1 (reviewer's appendix test, merged by FIX-SW1): every stored field series.set_program re-inserts
// must come back unchanged for every prod shape, after an unrelated edit.
import { describe, expect, it } from 'vitest';
import { buildDays, parseTree, setPersonRole, updateItem, allItems } from '../programmeSeriesModel';

const P = (id: string, type: string, role: string | null, level: string | null, sort: number) =>
  ({ id: `pp-${id}`, profile_id: id, profile_type: type, role, level, sort_order: sort, display_name: id, avatar_url: null });
const I = (id: string, type: string, extra: Record<string, unknown>, people: unknown[]) => ({
  item: { id, title: `T ${id}`, type, start_time: '19:00:00', end_time: '01:30:00', room: null, venue_room_id: null, level_keys: [],
    style: null, theme: null, track_id: null, parallel_group_id: null, sort_order: 0, ...extra }, people });
const S = (id: string, kind: string, label: string | null, items: unknown[]) => ({ section: { id, kind, sort_order: 0, label_override: label }, items });
const D = (id: string, idx: number, offset: number, label: string | null, sections: unknown[]) => ({ day: { id, day_index: idx, date_offset_days: offset, label, sort_order: idx }, sections });

const FULL = {
  room: 'Studio 2', venue_room_id: '11111111-1111-1111-1111-111111111111', style: 'sensual', theme: 'Footwork',
  track_id: '22222222-2222-2222-2222-222222222222', parallel_group_id: '33333333-3333-3333-3333-333333333333',
};
const SHAPES: Record<string, unknown[]> = {
  'recurring classes+party': [D('d0', 0, 0, null, [
    S('s0', 'classes', null, [I('a', 'class', { ...FULL, level_keys: ['beginner', 'improver'] }, [P('t1', 'teacher', 'teaching', 'beginner', 0)])]),
    S('s1', 'party', null, [I('b', 'party', {}, [P('dj1', 'dj', 'djing', null, 0)])]),
  ])],
  'festival multi-day + labels + parallel': [
    D('d0', 0, 0, 'Friday', [S('s0', 'masterclass', 'Intensives', [I('a', 'masterclass', FULL, []), I('b', 'workshop', { ...FULL, room: 'Hall B' }, [])])]),
    D('d1', 1, 1, 'Saturday', [S('s1', 'showcase', null, [I('c', 'performance', {}, [P('dn1', 'dancer', 'performing', null, 0), P('t2', 'teacher', 'mc', null, 1)])])]),
  ],
  'stored outside types + social': [D('d0', 0, 0, null, [
    S('s0', 'social', 'Late social', [I('a', 'show', FULL, []), I('b', 'competition', {}, [])]),
    S('s1', 'competition', null, [I('c', 'workshop', {}, [])]),
  ])],
};

const strip = (v: unknown) => JSON.parse(JSON.stringify(v));

describe.each(Object.entries(SHAPES))('REVIEW-SW1 echo: %s', (_name, program) => {
  it('an unrelated edit (rename item 0) re-sends every other stored field unchanged', () => {
    const tree = parseTree(program);
    const first = allItems(tree)[0];
    const sent = buildDays(updateItem(tree, first.key, { title: 'Renamed' })) as Array<Record<string, any>>;
    (program as Array<Record<string, any>>).forEach((d, di) => {
      expect(sent[di]).toMatchObject({ day_index: d.day.day_index, date_offset_days: d.day.date_offset_days, label: d.day.label });
      (d.sections as Array<Record<string, any>>).forEach((s, si) => {
        expect(sent[di].sections[si]).toMatchObject({ kind: s.section.kind, label_override: s.section.label_override });
        (s.items as Array<Record<string, any>>).forEach((e, ii) => {
          const got = sent[di].sections[si].items[ii];
          for (const k of ['type', 'start_time', 'end_time', 'room', 'venue_room_id', 'style', 'theme', 'track_id', 'parallel_group_id', 'level_keys']) {
            expect([k, got[k]]).toEqual([k, e.item[k]]);
          }
          if (di + si + ii > 0) expect(got.title).toBe(e.item.title);
          expect(strip(got.people)).toEqual(e.people.map((p: any, pi: number) => ({ profile_id: p.profile_id, profile_type: p.profile_type, role: p.role, level: p.level, sort: pi })));
        });
      });
    });
  });
});

describe('REVIEW-SW1 known gaps (failed on d20de737, fixed by FIX-SW1)', () => {
  it('switching a teacher to DJ keeps the profile_type of the profile the id points at', () => {
    const tree = parseTree(SHAPES['recurring classes+party']);
    const it0 = allItems(tree)[0];
    const sent = buildDays(updateItem(tree, it0.key, setPersonRole(it0, 't1', 'djing'))) as any[];
    expect(sent[0].sections[0].items[0].people[0]).toMatchObject({ profile_id: 't1', profile_type: 'teacher' });
  });
  it('an empty stored section survives a save', () => {
    const program = [D('d0', 0, 0, null, [S('s0', 'classes', null, []), S('s1', 'party', null, [I('b', 'party', {}, [])])])];
    const tree = parseTree(program);
    const sent = buildDays(updateItem(tree, allItems(tree)[0].key, { title: 'x' })) as any[];
    expect(sent[0].sections.map((s: any) => s.kind)).toEqual(['classes', 'party']);
  });
  it('the item id is sent, so per-date overrides (FK ON DELETE CASCADE) can survive', () => {
    const tree = parseTree(SHAPES['recurring classes+party']);
    const sent = buildDays(tree) as any[];
    expect(sent[0].sections[0].items[0]).toHaveProperty('id', 'a');
  });
});
