// @vitest-environment jsdom
/**
 * FIX-SW1: the one fix pass on SW1 from REVIEW-SW1. Table-driven: every stored shape x
 * every edit keeps what the organiser did not change (item ids, so the per-date session
 * changes keyed by them survive; a person's profile type; empty stored sections), and the
 * same fact reads the same on every screen (levels, the cast, the empty states).
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { LEVEL_KEYS, LEVEL_LABEL, PEOPLE_ROLES } from '@/modules/organiser/shared/programmeModel';
import { PARITY_GATE_REASON } from '@/modules/organiser/shared/parityGate';
import * as M from '../programmeSeriesModel';
import * as O from '../organisersModel';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload trees are walked loosely in assertions
type Any = Record<string, any>;
afterEach(cleanup);

// ---- a prod-shaped weekly series: stored ids, a legacy id, an empty stored section ----------
const P = (id: string, type: string, role: string | null, level: string | null = null) =>
  ({ id: `pp-${id}`, profile_id: id, profile_type: type, role, level, sort_order: 0, display_name: `N ${id}`, avatar_url: null });
const I = (id: string, type: string, people: unknown[] = []) => ({
  item: { id, title: `T ${id}`, type, start_time: '19:00:00', end_time: '20:00:00', room: null, venue_room_id: null, level_keys: [], style: null,
    theme: null, track_id: null, parallel_group_id: null, sort_order: 0, legacy_program_item_id: `leg-${id}` }, people });
const S = (id: string, kind: string, items: unknown[]) => ({ section: { id, kind, sort_order: 0, label_override: null }, items });
const WEEKLY = [{ day: { id: 'd0', day_index: 0, date_offset_days: 0, label: null, sort_order: 0 }, sections: [
  S('s0', 'classes', [I('a', 'class', [P('t1', 'teacher', 'teaching')]), I('b', 'class', [P('t2', 'teacher', 'teaching', 'beginner')])]),
  S('s1', 'party', [I('c', 'party', [P('dj1', 'dj', 'djing')])]),
  S('s2', 'masterclass', []),
] }];
/** event_occurrence_session_override_p5 rows of that series, keyed by program_item_id (FK ON DELETE CASCADE). */
const OVERRIDES = [{ date: '2026-10-23', program_item_id: 'a' }, { date: '2026-10-30', program_item_id: 'c' }, { date: '2026-11-06', program_item_id: 'b' }];

const itemIds = (days: Any[]) => days.flatMap((d) => d.sections.flatMap((s: Any) => s.items.map((i: Any) => i.id)));
const sent = (t: M.PTree) => M.buildDays(t) as Any[];

describe('B1: stored ids travel with the tree, so a Save keeps every per-date session change', () => {
  const tree = M.parseTree(WEEKLY);
  const [a, b] = M.allItems(tree);
  const EDITS: [string, M.PTree, string[]][] = [
    ['untouched', tree, ['a', 'b', 'c']],
    ['rename one class', M.updateItem(tree, a.key, { title: 'Renamed' }), ['a', 'b', 'c']],
    ['move a class down', M.moveSession(tree, a.key, 1), ['b', 'a', 'c']],
    ['change a time', M.updateItem(tree, b.key, { start: '18:30' }), ['a', 'b', 'c']],
    ['delete one class', M.removeSession(tree, b.key), ['a', 'c']],
  ];
  it.each(EDITS)('%s: the payload carries exactly the stored ids still on screen', (_n, edited, ids) => {
    expect(itemIds(sent(edited))).toEqual(ids);
    const kept = new Set(itemIds(sent(edited)));
    // An override survives unless its own session left the tree.
    expect(OVERRIDES.filter((o) => !kept.has(o.program_item_id)).map((o) => o.program_item_id)).toEqual(['a', 'b', 'c'].filter((x) => !ids.includes(x)));
  });
  it('day and section ids are sent; a new session sends no id', () => {
    const r = M.addSession(tree, 'classes', 'class');
    const days = sent(r.tree);
    expect(days[0].id).toBe('d0');
    expect(days[0].sections.map((s: Any) => s.id)).toEqual(['s0', 's1', 's2']);
    expect(days[0].sections[0].items.map((i: Any) => 'id' in i)).toEqual([true, true, false]);
  });
  it('a new section and a new day send no id', () => {
    const r = M.addSession(M.parseTree([]), 'party', 'party');
    const days = sent(r.tree);
    expect('id' in days[0]).toBe(false);
    expect('id' in days[0].sections[0]).toBe(false);
  });
  // INT4 (final AW1, admin #838): the server REFUSES an owner/manager removing a session that has per-date changes
  // (an admin may). The copy must not promise that the date changes go with it.
  it('the remove confirm says what really happens to the dates that changed that session', () => {
    const copy = M.removeConfirmCopy('Beginner class');
    expect(copy).not.toMatch(/keep their own sessions/);
    expect(copy).not.toMatch(/loses that change|takes its date changes/);
    expect(copy).toMatch(/Beginner class/);
    expect(copy).toContain(M.CHANGED_SESSION_REMOVE);
  });
  it('the Differs card says a session changed on a date is removed by the team, not here', async () => {
    const src = (await import('node:fs')).readFileSync('src/modules/organiser/events/ProgrammeSeries.tsx', 'utf8');
    expect(src).not.toMatch(/takes its date changes with it/);
    expect(src).toMatch(/CHANGED_SESSION_REMOVE/);
    expect(M.CHANGED_SESSION_REMOVE).toMatch(/only[\s\S]*Bachata Calendar team/);
  });
});

describe('B2: a role never rewrites the profile type (every stored person x every offered role)', () => {
  const STORED: [string, string | null][] = [['teacher', 'teaching'], ['dj', 'djing'], ['teacher', 'mc'], ['dancer', 'performing'], ['teacher', null]];
  const cases = STORED.flatMap(([type, role]) => PEOPLE_ROLES.map((to) => [type, role, to] as const));
  it.each(cases)('%s/%s -> tap %s: profile_type unchanged, role only one that type can hold', (type, role, to) => {
    const tree = M.parseTree([{ day: { id: 'd0', day_index: 0 }, sections: [S('s0', 'classes', [I('a', 'class', [P('x', type, role)])])] }]);
    const it0 = M.allItems(tree)[0];
    const out = sent(M.updateItem(tree, it0.key, M.setPersonRole(it0, 'x', to)))[0].sections[0].items[0].people[0];
    expect(out.profile_type).toBe(type);
    expect(out.role === role || M.rolesFor(type).includes(out.role)).toBe(true);
  });
  it('the chips offered are the roles the profile type can hold', () => {
    expect(M.rolesFor('teacher')).toEqual(['teaching']);
    expect(M.rolesFor('dj')).toEqual(['djing']);
    expect(M.rolesFor('dancer')).toEqual([]);
  });
});

describe('S1: RECENT people carry their profile type', () => {
  const RAW = { cast: [], recent_people: [
    { profile_id: 'p-t', profile_type: 'teacher', display_name: 'Tia', photo_url: null, roles: ['teaching'] },
    { profile_id: 'p-both', profile_type: 'teacher', display_name: 'Bo', photo_url: 'https://x/b.jpg', roles: ['teaching', 'djing'] },
    { profile_id: 'p-dj0', profile_type: 'dj', display_name: 'Dj Zero', photo_url: null, roles: [] },
    { profile_id: 'p-none', display_name: 'No type', roles: ['teaching'] },
  ] };
  // Optional call so the suite still collects on the unfixed code (red-first run).
  const list = M.parseRecentPeople?.(RAW) ?? [];
  it('parses {profile_id, profile_type, display_name, photo_url, roles[]}; a row with no type is left out (never guessed)', () => {
    expect(list.map((r) => [r.profileId, r.profileType, r.roles])).toEqual([
      ['p-t', 'teacher', ['teaching']], ['p-both', 'teacher', ['teaching', 'djing']], ['p-dj0', 'dj', []],
    ]);
    expect(list[1].photoUrl).toBe('https://x/b.jpg');
  });
  it.each([
    ['teaching', ['p-t', 'p-both'], 'teacher'],
    ['djing', ['p-dj0'], 'dj'],
  ] as const)('a %s session lists %j and adds them with their own type', (role, ids, type) => {
    const shown = M.recentFor(list, role);
    expect(shown.map((r) => r.profileId)).toEqual(ids);
    const it0 = M.allItems(M.parseTree(WEEKLY))[0];
    for (const r of shown) {
      const p = M.addPerson(it0, { id: r.profileId, name: r.name, profileType: r.profileType, role }).people.slice(-1)[0];
      expect([p.profileId, p.profileType, p.role]).toEqual([r.profileId, type, role]);
    }
  });
  it('a person whose type cannot hold the role is not added', () => {
    const it0 = M.allItems(M.parseTree(WEEKLY))[0];
    expect(M.addPerson(it0, { id: 'p-dj0', name: 'Dj Zero', profileType: 'dj', role: 'teaching' })).toBe(it0);
  });
});

describe('S2: empty stored sections go back as stored', () => {
  const tree = M.parseTree(WEEKLY);
  it.each([
    ['untouched', tree, ['classes', 'party', 'masterclass']],
    ['rename', M.updateItem(tree, M.allItems(tree)[0].key, { title: 'x' }), ['classes', 'party', 'masterclass']],
    ['this screen empties the party', M.removeSession(tree, M.allItems(tree)[2].key), ['classes', 'masterclass']],
  ] as const)('%s', (_n, t, kinds) => {
    expect(sent(t)[0].sections.map((s: Any) => s.kind)).toEqual(kinds);
  });
});

describe('S3: one level renderer on every screen', () => {
  it.each(LEVEL_KEYS)('%s reads short chip + word, the short one hidden from screen readers', async (key) => {
    const { LevelText } = await import('@/modules/organiser/shared/components/LevelText');
    const { container } = render(<LevelText level={key} />);
    const hidden = container.querySelector('[aria-hidden="true"]');
    expect(hidden?.textContent).toBe(M.levelShort(key));
    expect(container.textContent).toBe(`${M.levelShort(key)} ${LEVEL_LABEL[key]}`);
  });
  it.each(['events/ProgrammeSeries.tsx', 'events/ProgrammeSheet.tsx', 'dates/DateSheet.tsx'])('%s renders levels only through LevelText', (file) => {
    const src = readFileSync(`src/modules/organiser/${file}`, 'utf8');
    expect(src).toMatch(/<LevelText /);
    expect(src).not.toMatch(/LEVEL_LABEL\[|levelShort\(|levelWord\(/);
  });
});

describe('S4: the cast empty state gives the reason when the programme cannot be edited', () => {
  const OFFS: [string, Parameters<typeof M.programmeOff>[0]][] = [
    ['festival', { format: 'festival', lifecycle: 'live', canEdit: true, gate: true }],
    ['ended', { format: 'recurring', lifecycle: 'ended', canEdit: true, gate: true }],
    ['viewer', { format: 'recurring', lifecycle: 'live', canEdit: false, gate: true }],
    ['gate off', { format: 'recurring', lifecycle: 'live', canEdit: true, gate: false }],
  ];
  it.each(OFFS)('%s: the reason, never the call to action', (_n, input) => {
    const off = M.programmeOff(input);
    expect(off).toBeTruthy();
    expect(M.castEmptyLine(off)).toBe(off);
  });
  it('editable: the call to action', () => {
    expect(M.castEmptyLine(M.programmeOff({ format: 'recurring', lifecycle: 'live', canEdit: true, gate: true }))).toBe(M.CAST_EMPTY);
  });
});

describe('S6: the cast line is clamped to 6 names', () => {
  const cast = (n: number) => Array.from({ length: n }, (_, i) => ({ profileId: `p${i}`, name: `P${i}`, roles: ['teaching'], sessions: 1 }));
  it.each([[1, 'P0 (Teacher)'], [6, 'P5 (Teacher)'], [7, 'and 1 more'], [76, 'and 70 more']] as const)('%i people ends with %s', (n, tail) => {
    const line = M.castLine(cast(n));
    expect(line.endsWith(tail)).toBe(true);
    expect(line.split('(Teacher)').length - 1).toBe(Math.min(n, 6));
  });
});

describe('N5: the organisers empty state fits the viewer', () => {
  it('an owner who can link reads the action on screen; anyone else the team', () => {
    expect(O.organisersEmpty(null)).toMatch(/Link a page/);
    expect(O.organisersEmpty(PARITY_GATE_REASON)).toBe(O.ORGANISERS_EMPTY);
    expect(O.organisersEmpty(O.MANAGER_REASON)).toBe(O.ORGANISERS_EMPTY);
  });
});

describe('S5: no raw Unicode punctuation in the SW1 sources', () => {
  it.each([
    'events/programmeSeriesModel.ts', 'events/programmeSeriesApi.ts', 'events/ProgrammeSeries.tsx', 'events/ProgrammeSheet.tsx',
    'events/Details.tsx', 'events/organisersModel.ts', 'events/SeriesOrganisers.tsx', 'shared/components/LevelText.tsx',
  ])('%s', (file) => {
    const src = readFileSync(`src/modules/organiser/${file}`, 'utf8');
    expect(src.match(/[–—·…‘’“”]/g) ?? []).toEqual([]);
  });
});
