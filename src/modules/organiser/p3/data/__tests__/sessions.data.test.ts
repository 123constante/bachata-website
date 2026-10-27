import { describe, expect, it } from 'vitest';
import { parseProgramme } from '../../../shared/programmeModel';
import { parseTree, validateTree, addSession, updateItem } from '../../../events/programmeSeriesModel';
import {
  dateAdd, dateEdit, dateLineup, dateOff, draftFor, draftsOf, emptyForm, everyAdd, everyEdit, everyLineup, everyRemove,
  formOfDraft, formOfItem, isExtra, itemOf, peopleOfItem, sameForm,
} from '../sessions';

/*
 * W2d data, table-driven over the prod shapes (read-only survey 27 Oct 2026, counts only):
 * items per series {0, 1, 2-3, 4+, 16} x {no time, room-bound, level set} x line-up
 * {empty, 1, several, mc}. Every date = series.set_program with the WHOLE tree (every
 * stored id and untouched field echoed); Just this date = the COMPLETE date programme.
 * An untouched save builds nothing.
 */

type Raw = Record<string, unknown>;
const COUNTS = [0, 1, 3, 5, 16] as const;
const VARIANTS = ['noTime', 'roomBound', 'levelSet'] as const;
const LINEUPS = ['empty', 'one', 'several', 'mc'] as const;

const peopleFor = (id: string, l: (typeof LINEUPS)[number]) => {
  const p = (n: number, role: string) => ({ profile_id: `p-${id}-${n}`, display_name: `Person ${n}`, profile_type: role === 'djing' ? 'dj' : 'teacher', role, level: null });
  if (l === 'empty') return [];
  if (l === 'one') return [p(0, 'teaching')];
  if (l === 'several') return [p(0, 'teaching'), p(1, 'teaching'), p(2, 'djing')];
  return [p(0, 'djing'), p(1, 'mc')];
};

function rawItem(i: number, v: (typeof VARIANTS)[number], l: (typeof LINEUPS)[number]) {
  const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  return {
    item: {
      id, type: v === 'levelSet' ? 'class' : 'party', title: i % 2 ? `Session ${i}` : null,
      start_time: v === 'noTime' ? null : '20:00:00', end_time: v === 'noTime' ? null : '23:00:00',
      level_keys: v === 'levelSet' ? ['improver'] : [],
      room: v === 'roomBound' ? 'Room 2' : null, venue_room_id: v === 'roomBound' ? 'room-2' : null, style: 'sensual', theme: null,
    },
    people: peopleFor(id, l),
  };
}

const programFor = (n: number, v: (typeof VARIANTS)[number], l: (typeof LINEUPS)[number]) =>
  [{ day: { id: 'day-0', day_index: 0, label: null }, sections: [{ section: { id: 'sec-0', kind: 'party' }, items: Array.from({ length: n }, (_, i) => rawItem(i, v, l)) }] }];

type Days = Array<{ id?: string; sections: Array<{ id?: string; items: Array<Raw & { people: Raw[] }> }> }>;
const daysOf = (cmd: { kind: string; payload: Record<string, unknown> } | null) => (cmd?.payload.days ?? []) as Days;
const itemsOf = (days: Days) => days.flatMap((d) => d.sections.flatMap((s) => s.items));

describe('every date: series.set_program x items x shape x line-up', () => {
  for (const n of COUNTS) for (const v of VARIANTS) for (const l of LINEUPS) {
    const tree = parseTree(programFor(n, v, l));
    const keys = tree.days.flatMap((d) => d.sections.flatMap((s) => s.items.map((i) => i.key)));
    it(`${n} items / ${v} / ${l}`, () => {
      // an untouched save sends nothing, for every item
      for (const k of keys) expect(everyEdit(tree, k, formOfItem(itemOf(tree, k)!)).command).toBeNull();
      // a session added with a name and no time saves (#25: never dropped as "empty")
      const add = everyAdd(tree, { ...emptyForm('party'), title: 'Late social' });
      expect(add.problem).toBeNull();
      expect(add.command?.kind).toBe('series.set_program');
      const added = itemsOf(daysOf(add.command));
      expect(added).toHaveLength(n + 1);
      expect(added.filter((x) => !x.id).map((x) => x.title)).toEqual(['Late social']);
      if (!n) return;
      const k = keys[0];
      const it0 = itemOf(tree, k)!;
      // a rename sends the WHOLE programme: every stored id, the room, style and the line-up (mc too) echoed
      const ren = everyEdit(tree, k, { ...formOfItem(it0), title: 'Renamed' });
      expect(ren.problem).toBeNull();
      const out = itemsOf(daysOf(ren.command));
      expect(out.map((x) => x.id)).toEqual(keys.map((x) => x.slice(2)));
      expect(out[0].title).toBe('Renamed');
      expect(out[0].room).toBe(v === 'roomBound' ? 'Room 2' : null);
      expect(out[0].venue_room_id).toBe(v === 'roomBound' ? 'room-2' : null);
      expect(out[0].style).toBe('sensual');
      expect(out[0].start_time).toBe(v === 'noTime' ? null : '20:00:00');
      expect(out[0].people.map((p) => p.role)).toEqual(peopleFor('x', l).map((p) => p.role));
      // remove from every date: that id leaves, the rest stay
      const rm = itemsOf(daysOf(everyRemove(tree, k).command));
      expect(rm.map((x) => x.id)).toEqual(keys.slice(1).map((x) => x.slice(2)));
      // line-up: add a teacher, take off the first editable person; mc is never touched here
      const ppl = peopleOfItem(it0);
      const firstEditable = ppl.findIndex((p) => p.role === 'teaching' || p.role === 'djing');
      const next = ppl.map((p, i) => (i === firstEditable ? { ...p, removed: true } : p));
      next.push({ id: 'new-person', name: 'New Teacher', role: 'teaching', origin: 'added', removed: false });
      const lu = itemsOf(daysOf(everyLineup(tree, k, next).command))[0].people;
      expect(lu.some((p) => p.profile_id === 'new-person' && p.profile_type === 'teacher' && p.role === 'teaching')).toBe(true);
      if (firstEditable >= 0) expect(lu.some((p) => p.profile_id === ppl[firstEditable].id)).toBe(false);
      if (l === 'mc') expect(lu.some((p) => p.role === 'mc')).toBe(true);
      // an untouched line-up sends nothing
      expect(everyLineup(tree, k, ppl).command).toBeNull();
    });
  }

  it('#25, red first: the unfixed check (validateTree alone) refuses a named session with no time; the fixed one sends it', () => {
    const tree = parseTree(programFor(1, 'roomBound', 'empty'));
    const { tree: t2, key } = addSession(tree, 'party', 'party');
    const draft = updateItem(t2, key, { title: 'Late social' });
    expect(validateTree(draft, tree).map((p) => p.field)).toContain('times');
    expect(everyAdd(tree, { ...emptyForm('party'), title: 'Late social' }).command).not.toBeNull();
  });

  it('a half-filled time or a bad name is still stopped before the send', () => {
    const tree = parseTree(programFor(1, 'roomBound', 'empty'));
    expect(everyAdd(tree, { ...emptyForm('class'), title: 'Class', start: '20:00' }).problem).toBeTruthy();
    expect(everyAdd(tree, { ...emptyForm('class'), title: 'a <b>' }).problem).toBeTruthy();
    expect(everyAdd(tree, { ...emptyForm('class'), title: 'Class', start: '20:00', end: '21:00' }).problem).toBeNull();
  });

  it('a room chip sets venue_room_id and the room name together', () => {
    const tree = parseTree(programFor(1, 'roomBound', 'empty'));
    const k = itemOf(tree, tree.days[0].sections[0].items[0].key)!;
    const out = itemsOf(daysOf(everyEdit(tree, k.key, { ...formOfItem(k), roomId: 'room-1' }, [{ id: 'room-1', name: 'Main room' }, { id: 'room-2', name: 'Room 2' }]).command));
    expect(out[0]).toMatchObject({ venue_room_id: 'room-1', room: 'Main room' });
  });

  it('levels: a party never sends levels, a class sends the picked ones', () => {
    expect(sameForm({ ...emptyForm('party'), levels: ['beginner'] }, emptyForm('party'))).toBe(true);
    const tree = parseTree(programFor(1, 'levelSet', 'empty'));
    const k = tree.days[0].sections[0].items[0];
    const out = itemsOf(daysOf(everyEdit(tree, k.key, { ...formOfItem(k), levels: ['improver', 'advanced'] }).command));
    expect(out[0].level_keys).toEqual(['improver', 'advanced']);
  });
});

// ---- just this date --------------------------------------------------------------------

function dateProgramme(n: number, l: (typeof LINEUPS)[number], extra = 0) {
  const sessions: Raw[] = Array.from({ length: n }, (_, i) => ({
    series_item_id: `item-${i}`, type: i % 2 ? 'class' : 'party', title: i % 3 ? `S${i}` : null,
    start_time: i === 0 ? null : '20:00:00', end_time: i === 0 ? null : '21:00:00', ends_next_day: false, level_keys: [], removed: false,
  }));
  for (let j = 0; j < extra; j += 1) sessions.push({ added_session_id: `add-${j}`, type: 'party', title: 'Extra', start_time: '23:00:00', end_time: '23:30:00', ends_next_day: false, level_keys: [], removed: false });
  const people = peopleFor('d', l).map((p) => ({ profile_id: p.profile_id, display_name: p.display_name, role: p.role }));
  return parseProgramme({
    occurrence_id: 'o-1', series_id: 'ser-1', occurrence_date: '2026-10-30', version: 4, editable: true, not_editable_reason: null,
    sessions, session_people: sessions.map((s) => ({ series_item_id: s.series_item_id, added_session_id: s.added_session_id, people })),
  });
}

describe('just this date: organiser_set_occurrence_programme_v1 x items x line-up', () => {
  for (const n of COUNTS) for (const l of LINEUPS) {
    it(`${n} items / ${l}`, () => {
      const p = dateProgramme(n, l, n ? 1 : 0);
      const drafts = draftsOf(p);
      for (const d of drafts) expect(dateEdit(drafts, d.key, formOfDraft(d)).payload).toBeNull();
      // add one to this date only: the reader's objects echoed, then the new one
      const add = dateAdd(drafts, { ...emptyForm('party'), title: 'Late one', start: '23:00', end: '23:45' });
      expect(add.problem).toBeNull();
      expect(add.payload?.slice(0, drafts.length)).toEqual(p.sessions);
      expect(add.payload?.[drafts.length]).toMatchObject({ new: true, type: 'party', title: 'Late one', start_time: '23:00', end_time: '23:45' });
      if (!n) return;
      // the series item behind a page row 'i:<id>' is the date's 's:<id>' draft
      expect(draftFor(drafts, 'i:item-0')?.key).toBe('s:item-0');
      // not running on this date / bring back
      const off = dateOff(drafts, 's:item-0', true).payload!;
      expect(off[0]).toMatchObject({ series_item_id: 'item-0', removed: true });
      expect(off.slice(1)).toEqual(p.sessions.slice(1));
      expect(dateOff(drafts, 's:item-0', false).payload).toBeNull();
      // the untimed session (item-0) renames without needing a time (#25)
      expect(dateEdit(drafts, 's:item-0', { ...formOfDraft(drafts[0]), title: 'Named now' }).payload?.[0]).toMatchObject({ title: 'Named now', start_time: null });
      // an added session: remove from this date only
      const ex = drafts.find(isExtra)!;
      expect(dateOff(drafts, ex.key, true).payload?.find((s) => s.added_session_id === ex.original?.added_session_id)).toMatchObject({ removed: true });
      // line-up for this date: people_add / people_remove only on the session that changed
      const ppl = drafts[0].people ?? [];
      const edIdx = ppl.findIndex((x) => x.role === 'teaching' || x.role === 'djing');
      const next = [...ppl.map((x, i) => (i === edIdx ? { ...x, removed: true } : x)), { id: 'new-dj', name: 'DJ New', role: 'djing', origin: 'added' as const, removed: false }];
      const lu = dateLineup(drafts, 's:item-0', next).payload!;
      expect(lu[0].people_add).toEqual([{ profile_id: 'new-dj', role: 'djing' }]);
      if (edIdx >= 0) expect(lu[0].people_remove).toEqual([ppl[edIdx].id]);
      expect(lu.slice(1)).toEqual(p.sessions.slice(1));
      expect(dateLineup(drafts, 's:item-0', ppl).payload).toBeNull();
    });
  }
});
