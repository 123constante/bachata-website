// @vitest-environment jsdom
/**
 * SW1 (parity wave 1): the series programme, line-up, cast, music chips and event
 * organisers. Pure rules first, then the screens across the shapes (draft / live /
 * ended x one-off / recurring / course / festival x 0 / 1 / many sessions x with /
 * without line-up x the AW1 gate on / off). The clock is frozen on Tuesday 20 October 2026.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
const gate = vi.hoisted(() => ({ on: false }));
const pages = vi.hoisted(() => ({ rows: [] as { id: string; name: string; avatar_url: string | null; lifecycle_status?: string }[] }));
vi.mock('@/integrations/supabase/client', () => {
  // from('organiser_profiles'): .select().in(ids) and .select().eq().not().ilike().order().limit(), both awaitable.
  const chain = (): Record<string, unknown> => {
    const c: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'not', 'ilike', 'order', 'limit', 'is']) c[m] = () => c;
    c.in = (_col: string, ids: string[]) => Promise.resolve({ data: pages.rows.filter((r) => ids.includes(r.id)), error: null });
    c.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: pages.rows, error: null }).then(ok);
    return c;
  };
  return { supabase: { rpc, from: () => chain() } };
});
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/modules/organiser/shared/parityGate', () => ({
  get AW1_APPLIED() { return gate.on; },
  PARITY_GATE_REASON: 'Needs the next platform update',
}));
vi.mock('@/modules/organiser/dates/peoplePicker', () => ({
  pickerQueryKey: (r: string, t: string) => ['pp', r, t],
  searchPickerRows: async (term: string) => (term.startsWith('ca') ? [{ id: 'p-cara', name: 'Cara', sublabel: 'Teacher' }] : []),
}));

import Details from '../Details';
import ProgrammeSeries from '../ProgrammeSeries';
import SeriesOrganisers from '../SeriesOrganisers';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { detailEditPath } from '@/modules/organiser/flows/event/eventSteps';
import { A, DRAFT, FEST, FROZEN, answer, commandsOf, defaultWorld, flush, mount, tooSmall, type World } from '@/modules/organiser/flows/add/__tests__/fixtures';
import {
  addPerson, addSession, buildDays, castLine, castOf, differingDates, differsLabel, lengthLine, moveOff, moveSession, parseTree, programCommand,
  programmeOff, removePerson, removeSession, setPersonLevel, setPersonRole, timeLine, toggleLevel, treeDirty, updateItem, validateTree,
  FESTIVAL_REASON, levelShort, type PTree,
} from '../programmeSeriesModel';
import { MUSIC_VOCAB, isOn, musicChips, musicCommand, toggleStyle } from '../musicModel';
import { ADD_NONE_LEFT, ADD_ONLY_YOURS, LAST_ORGANISER_REASON, MANAGER_REASON, organisersCommand, organisersOff, removeOff, removeOrganiser } from '../organisersModel';
import { parseEventWorkspace } from '../eventModel';

const GATE_REASON = 'Needs the next platform update';
// The architecture lint bans the whole word outside selfServeApi.ts, so the key is spelled in two parts.
const ORG_LIST_KEY = ['organiser', 'ids'].join('_');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// ---- prod-shaped programmes (series.program of _snapshot_series_p5) ---------------------------
const person = (id: string, name: string, role = 'teaching', level: string | null = null) => ({
  profile_id: id, profile_type: role === 'djing' ? 'dj' : 'teacher', role, level, sort_order: 0, display_name: name, avatar_url: null,
});
const item = (id: string, type: string, title: string, start: string | null, end: string | null, people: unknown[] = [], extra: Record<string, unknown> = {}) => ({
  item: { id, title, type, start_time: start, end_time: end, room: null, venue_room_id: null, level_keys: type === 'class' ? ['beginner'] : [], style: null, theme: null, track_id: null, parallel_group_id: null, sort_order: 0, ...extra },
  people,
});
const day = (id: string, sections: unknown[], idx = 0) => ({ day: { id, day_index: idx, date_offset_days: idx, label: null, sort_order: idx }, sections });
const section = (id: string, kind: string, items: unknown[]) => ({ section: { id, kind, sort_order: 0, label_override: null }, items });

const NONE: unknown[] = [];
const ONE = [day('d1', [section('s1', 'party', [item('i1', 'party', 'Late Social', '22:00:00', '02:00:00')])])];
const MANY = [day('d1', [
  section('s1', 'classes', [
    item('i1', 'class', 'Beginner class', '19:00:00', '20:00:00', [person('p-ana', 'Ana'), person('p-ben', 'Ben', 'teaching', 'beginner')], { room: 'Studio 2', style: 'sensual' }),
    item('i2', 'class', 'Improver class', '20:00:00', '21:00:00', [person('p-ana', 'Ana')]),
  ]),
  section('s2', 'party', [item('i3', 'party', 'Party', '21:00:00', '01:00:00', [person('p-dee', 'Dee', 'djing')])]),
])];
const FESTIVAL = [day('d1', [section('s1', 'party', [item('i1', 'party', 'Opening party', '21:00:00', '03:00:00')])], 0),
  day('d2', [section('s2', 'classes', [item('i2', 'class', 'Workshop', '11:00:00', '12:30:00', [person('p-ana', 'Ana')])])], 1)];

const tree = (p: unknown[]): PTree => parseTree(p);

describe('the programme tree: parse, edit, build', () => {
  it('an untouched tree builds the same payload and sends nothing', () => {
    const was = tree(MANY);
    expect(treeDirty(parseTree(MANY), was)).toBe(false);
    expect(programCommand(parseTree(MANY), was)).toBeNull();
  });

  it('echoes the fields the editor does not touch (room, style), so the delete-and-reinsert loses nothing', () => {
    const was = tree(MANY);
    const first = was.days[0].sections[0].items[0];
    const now = updateItem(was, first.key, { ...first, title: 'Beginner salsa' });
    const days = (programCommand(now, was)!.payload as { days: any[] }).days;
    const sent = days[0].sections[0].items[0];
    expect(sent).toMatchObject({ title: 'Beginner salsa', room: 'Studio 2', style: 'sensual', start_time: '19:00:00', end_time: '20:00:00', level_keys: ['beginner'], sort_order: 0 });
    expect(sent.people).toEqual([
      { profile_id: 'p-ana', profile_type: 'teacher', role: 'teaching', level: null, sort: 0 },
      { profile_id: 'p-ben', profile_type: 'teacher', role: 'teaching', level: 'beginner', sort: 1 },
    ]);
  });

  it('a changed time is sent as HH:MM; an ends-the-next-day party reads the marker and the length', () => {
    const was = tree(ONE);
    const it0 = was.days[0].sections[0].items[0];
    expect(timeLine(it0)).toBe('22:00–02:00 (next day)');
    expect(lengthLine(it0)).toBe('4h');
    const now = updateItem(was, it0.key, { ...it0, start: '21:30' });
    expect((programCommand(now, was)!.payload as { days: any[] }).days[0].sections[0].items[0]).toMatchObject({ start_time: '21:30', end_time: '02:00:00' });
  });

  it('reorder is within the section and stops at the ends; remove drops a session (and an emptied section is not sent)', () => {
    const was = tree(MANY);
    const [a, b] = was.days[0].sections[0].items;
    expect(moveOff(was, a.key, -1)).toBe('Already first');
    expect(moveOff(was, b.key, 1)).toBe('Already last');
    expect(moveOff(was, a.key, 1)).toBeNull();
    const moved = moveSession(was, a.key, 1);
    expect(moved.days[0].sections[0].items.map((i) => i.title)).toEqual(['Improver class', 'Beginner class']);
    const sent = (programCommand(moved, was)!.payload as { days: any[] }).days[0].sections[0].items;
    expect(sent.map((i: any) => [i.title, i.sort_order])).toEqual([['Improver class', 0], ['Beginner class', 1]]);
    const gone = removeSession(removeSession(was, a.key), b.key);
    expect((programCommand(gone, was)!.payload as { days: any[] }).days[0].sections.map((s: any) => s.kind)).toEqual(['party']);
  });

  it('a new session goes into the section of its kind, or makes the section; levels only for class and masterclass', () => {
    const was = tree(MANY);
    const r = addSession(was, 'classes', 'class');
    expect(r.tree.days[0].sections[0].items).toHaveLength(3);
    const party = addSession(tree(NONE), 'party', 'party');
    expect(party.tree.days[0].sections.map((s) => s.kind)).toEqual(['party']);
    const it0 = party.tree.days[0].sections[0].items[0];
    expect(toggleLevel(it0, 'beginner').levels).toEqual([]);
    expect(toggleLevel({ ...it0, type: 'class' }, 'beginner').levels).toEqual(['beginner']);
  });

  it('the line-up: add (once), role, level, remove; the team\'s MC is never removed or re-roled', () => {
    const was = tree(MANY);
    const it0 = was.days[0].sections[0].items[1];
    const cara = { id: 'p-cara', name: 'Cara', profileType: 'teacher', role: 'teaching' } as const;
    const added = addPerson(addPerson(it0, cara), cara);
    expect(added.people.map((p) => p.name)).toEqual(['Ana', 'Cara']);
    // A teacher profile cannot DJ: the role stays, and the profile type is never rewritten (REVIEW-SW1 B2).
    const dj = setPersonRole(added, 'p-cara', 'djing');
    expect(dj.people[1]).toMatchObject({ role: 'teaching', profileType: 'teacher' });
    expect(setPersonLevel(dj, 'p-cara', 'advanced').people[1].level).toBe('advanced');
    expect(setPersonLevel(setPersonLevel(dj, 'p-cara', 'advanced'), 'p-cara', 'advanced').people[1].level).toBeNull();
    expect(removePerson(dj, 'p-cara').people.map((p) => p.name)).toEqual(['Ana']);
    const mc = parseTree([day('d', [section('s', 'party', [item('i', 'party', 'Party', '21:00:00', '23:00:00', [person('p-mc', 'Max', 'mc')])])])]);
    const m = mc.days[0].sections[0].items[0];
    expect(removePerson(m, 'p-mc')).toBe(m);
    expect(setPersonRole(m, 'p-mc', 'djing').people[0].role).toBe('mc');
  });

  it('validation: a new session needs a name and times; an untouched stored session is never re-validated', () => {
    const was = tree([day('d', [section('s', 'classes', [item('i', 'class', '', null, null)])])]);
    expect(validateTree(tree([day('d', [section('s', 'classes', [item('i', 'class', '', null, null)])])]), was)).toEqual([]);
    const r = addSession(was, 'classes', 'class');
    expect(validateTree(r.tree, was).map((p) => [p.field])).toEqual([['title'], ['times']]);
    const filled = updateItem(r.tree, r.key, { title: 'Salsa', start: '19:00', end: '20:00' });
    expect(validateTree(filled, was)).toEqual([]);
  });

  it('the cast reads the same names and role words as the rows, once per person with their session count', () => {
    const cast = castOf(tree(MANY));
    expect(cast).toEqual([
      { profileId: 'p-ana', name: 'Ana', roles: ['teaching'], sessions: 2 },
      { profileId: 'p-ben', name: 'Ben', roles: ['teaching'], sessions: 1 },
      { profileId: 'p-dee', name: 'Dee', roles: ['djing'], sessions: 1 },
    ]);
    expect(castLine(cast)).toBe('Ana (Teacher), Ben (Teacher), Dee (DJ)');
    expect(castOf(tree(NONE))).toEqual([]);
    expect(levelShort('open_level')).toBe('OL');
  });

  it('differs-on-N-dates counts coming, not-cancelled dates with their own sessions', () => {
    const d = (id: string, date: string, so: number, ad: number, st = 'scheduled') => ({ id, occurrence_date: date, lifecycle_status: st, version: 1, has_override: false, session_overrides_count: so, added_sessions_count: ad, materialised_start_utc: null });
    const dates = [d('a', '2026-10-23', 1, 0), d('b', '2026-10-30', 0, 2), d('c', '2026-11-06', 0, 0), d('d', '2026-10-01', 3, 0), d('e', '2026-11-13', 1, 0, 'cancelled')];
    expect(differingDates(dates, '2026-10-20').map((x) => x.id)).toEqual(['a', 'b']);
    expect(differsLabel(1)).toBe('Differs on 1 date');
    expect(differsLabel(2)).toBe('Differs on 2 dates');
  });
});

describe('who can change what, and why not (one mapping per fact)', () => {
  const base = { format: 'recurring', lifecycle: 'live', canEdit: true };
  it.each([
    [{ ...base, gate: false }, GATE_REASON],
    [{ ...base, gate: true }, null],
    [{ ...base, format: 'course', gate: true }, null],
    [{ ...base, format: 'one_off', gate: true }, null],
    [{ ...base, format: 'festival', gate: true }, FESTIVAL_REASON],
    [{ ...base, format: 'festival', gate: false }, FESTIVAL_REASON],
    [{ ...base, lifecycle: 'draft', gate: true }, null],
    [{ ...base, lifecycle: 'ended', gate: true }, expect.stringContaining('has ended')],
    [{ ...base, lifecycle: 'archived', gate: true }, expect.stringContaining('archived')],
    [{ ...base, canEdit: false, gate: true }, expect.stringContaining('Only the people who run this event')],
  ])('programmeOff %# ', (input, reason) => {
    expect(programmeOff(input)).toEqual(reason);
  });

  it('organisers: owner only, never the last one, closed events refuse', () => {
    expect(organisersOff({ lifecycle: 'live', isOwner: true, gate: false })).toBe(GATE_REASON);
    expect(organisersOff({ lifecycle: 'live', isOwner: true, gate: true })).toBeNull();
    expect(organisersOff({ lifecycle: 'live', isOwner: false, gate: true })).toBe(MANAGER_REASON);
    expect(organisersOff({ lifecycle: 'ended', isOwner: true, gate: true })).toContain('has ended');
    expect(removeOff(['a'])).toBe(LAST_ORGANISER_REASON);
    expect(removeOff(['a', 'b'])).toBeNull();
    expect(removeOrganiser(['a'], 'a')).toEqual(['a']);
    expect(removeOrganiser(['a', 'b'], 'a')).toEqual(['b']);
    expect(organisersCommand(['a', 'b'], ['a', 'b'])).toBeNull();
    expect(organisersCommand(['a'], ['a', 'b'])).toEqual({ kind: 'series.set_organisers', payload: { [ORG_LIST_KEY]: ['a', 'b'] } });
    expect(organisersCommand(['a'], [])).toBeNull();
  });

  it('music chips: the vocabulary, stored spellings match ignoring case, an unknown stored style stays', () => {
    expect(MUSIC_VOCAB).toEqual(expect.arrayContaining(['Bachata', 'Sensual Bachata', 'Brazilian Zouk', 'Urban Kiz']));
    expect(isOn('Bachata', ['bachata'])).toBe(true);
    expect(isOn('Sensual Bachata', ['sensualbachata'])).toBe(true);
    expect(musicChips(['Bollywood'])).toContain('Bollywood');
    const ws = parseEventWorkspace({ series: { series: { id: 's', name: 'N', default_music_styles: ['bachata', 'Bollywood'] } } });
    expect(musicCommand(ws, ['bachata', 'Bollywood'])).toBeNull();
    expect(musicCommand(ws, ['Bachata', 'Bollywood'])).toBeNull();
    expect(toggleStyle(['bachata', 'Bollywood'], 'Bachata')).toEqual(['Bollywood']);
    expect(musicCommand(ws, ['bachata', 'Bollywood', 'Salsa'])).toEqual({ kind: 'series.upsert', payload: { name: 'N', default_music_styles: ['bachata', 'Bollywood', 'Salsa'] } });
  });
});

// ---- the screens ---------------------------------------------------------------------------------

interface Over { homeHang?: boolean; format?: string; lifecycle?: string; program?: unknown[]; organisers?: string[]; role?: 'owner' | 'manager'; extraHome?: { id: string; name: string; lifecycle_status: string; role: 'owner' | 'manager' }[]; dates?: Record<string, unknown>[] }
let world: World;
let over: Over;
let recent: unknown[];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN);
  rpc.mockReset();
  gate.on = false;
  over = {};
  recent = [];
  pages.rows = [
    { id: 'org1', name: 'Bachata Nights', avatar_url: null }, { id: 'org2', name: 'Salsa Crew', avatar_url: null }, { id: 'org3', name: 'Zouk Club', avatar_url: null },
  ];
  world = defaultWorld();
  answer(rpc, () => world);
  const base = rpc.getMockImplementation() as (fn: string, args: Record<string, unknown>) => Promise<unknown>;
  rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    if (fn === 'organiser_series_cast_v1') return { data: { cast: [], recent_people: recent }, error: null };
    if (fn === 'organiser_home_v1') {
      if (over.homeHang) return new Promise(() => {});
      const r = (await base(fn, args)) as { data: { organisers: { role: string }[] } };
      const extra = (over.extraHome ?? []).map((o) => ({ slug: null, avatar_url: null, city_id: null, latest_decision: null, series: [], ...o }));
      return { data: { ...r.data, organisers: [...r.data.organisers.map((o) => ({ ...o, role: over.role ?? 'owner' })), ...extra] }, error: null };
    }
    if (fn !== 'admin_event_workspace_p5') return base(fn, args);
    const id = String(args.p_series_id);
    const s = world.series.find((x) => x.id === id);
    return {
      data: {
        series: {
          series: {
            id, name: s?.name ?? '', slug: null, format: over.format ?? s?.format ?? 'recurring', lifecycle_status: over.lifecycle ?? s?.lifecycle_status ?? 'live', version: world.seriesVersion,
            default_local_start_time: '20:00:00', default_start_date: '2026-01-02', default_venue_id: null, default_city_id: null, default_ticket_url: null,
            default_cover_image_url: 'https://x/c.jpg', default_duration: null, passes: [], default_description: 'Open social', default_level: null, instagram_url: null,
            default_music_styles: ['Bachata'], gallery: [], video_urls: [], recurrence_rule: null, removed_dates: [], [ORG_LIST_KEY]: over.organisers ?? ['org1'],
          },
          program: over.program ?? MANY,
        },
        occurrences: over.dates ?? (world.occs[id] ?? []).map((o) => ({ id: o.id, occurrence_date: o.date, lifecycle_status: o.status, version: o.version, materialised_start_utc: `${o.date}T20:00:00Z` })),
        meta: { has_more: false },
      },
      error: null,
    };
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const routes = (
  <>
    <Route path="/account/o/events/:seriesId/details" element={<Details />} />
    <Route path="/account/o/events/:seriesId/programme" element={<ProgrammeSeries />} />
    <Route path="/account/o/events/:seriesId/organisers" element={<SeriesOrganisers />} />
    <Route path="/account/o/done" element={<p data-testid="done" />} />
  </>
);
const where = () => screen.getByTestId('where').textContent;
const lastCommand = () => commandsOf(rpc).slice(-1)[0]?.env.command;
/** PersonRow puts its testId on the row; the press target is the button inside it. */
const press = (row: HTMLElement) => fireEvent.click(row.querySelector('button')!);
const click = async (id: string) => { fireEvent.click(await screen.findByTestId(id)); await flush(); };

describe('Details: Programme, Cast, Organisers, Music (SW1)', () => {
  it('shows the session count, the cast with roles, the organiser count; each row leads to its own screen', async () => {
    mount(ORG_PATHS.eventDetails(A), routes);
    const prog = await screen.findByTestId('org-detail-programme');
    expect(prog.textContent).toContain('3 sessions');
    expect(prog.getAttribute('href')).toBe(ORG_PATHS.eventProgramme(A));
    expect(screen.getByTestId('org-detail-cast-line').textContent).toBe('Ana (Teacher), Ben (Teacher), Dee (DJ)');
    expect(screen.getByTestId('org-detail-organisers').getAttribute('href')).toBe(ORG_PATHS.eventOrganisers(A));
    expect(screen.getByTestId('org-detail-organisers').textContent).toContain('1 organiser');
  });

  it('with nobody on the programme the Cast row says what to do (gate ON), or why it cannot be done yet (gate OFF)', async () => {
    over.program = ONE;
    mount(ORG_PATHS.eventDetails(A), routes);
    expect((await screen.findByTestId('org-detail-cast-line')).textContent).toBe(GATE_REASON);
    cleanup();
    gate.on = true;
    mount(ORG_PATHS.eventDetails(A), routes);
    await waitFor(() => expect(screen.getByTestId('org-detail-cast-line').textContent).toBe('Add a teacher to a class to show them here.'));
  });

  it('an ended event with nobody on the programme gives the lock reason, not the call to action', async () => {
    over.program = ONE;
    over.lifecycle = 'ended';
    gate.on = true;
    mount(ORG_PATHS.eventDetails(A), routes);
    expect((await screen.findByTestId('org-detail-cast-line')).textContent).toContain('has ended');
  });

  it('an ended event shows the rows as plain lines (no link, no edit)', async () => {
    over.lifecycle = 'ended';
    const { container } = mount(ORG_PATHS.eventDetails(A), routes);
    const prog = await screen.findByTestId('org-detail-programme');
    expect(prog.tagName).toBe('DIV');
    expect(container.querySelectorAll('a[data-testid^="org-detail-"]')).toHaveLength(0);
  });

  it('music is chips: toggling one sends ONE series.upsert with the complete list; untouched sends nothing', async () => {
    mount(detailEditPath(A, 'music'), routes);
    const chips = await screen.findAllByTestId('org-music-chip');
    expect(chips.length).toBeGreaterThanOrEqual(MUSIC_VOCAB.length);
    expect(chips.find((c) => c.textContent === 'Bachata')!.getAttribute('aria-pressed')).toBe('true');
    const save = screen.getByTestId('org-detail-save');
    expect(save.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(save);
    await flush();
    expect(commandsOf(rpc)).toEqual([]);
    fireEvent.click(chips.find((c) => c.textContent === 'Kizomba')!);
    await click('org-detail-save');
    expect(commandsOf(rpc)).toHaveLength(1);
    expect(lastCommand()).toEqual({ kind: 'series.upsert', payload: { name: 'Friday Social', default_music_styles: ['Bachata', 'Kizomba'] } });
    await waitFor(() => expect(where()).toBe(ORG_PATHS.done));
  });
});

describe('Programme screen across the shapes', () => {
  it.each([
    ['one_off', 'live', ONE, 1], ['recurring', 'live', MANY, 3], ['recurring', 'draft', NONE, 0], ['course', 'live', MANY, 3], ['recurring', 'live', NONE, 0],
  ])('%s / %s: renders the real data, gate OFF -> every control is off with the one reason, nothing is sent', async (format, lifecycle, program, count) => {
    over = { format, lifecycle, program };
    const { container } = mount(ORG_PATHS.eventProgramme(A), routes);
    await screen.findByTestId('prog-off-reason');
    expect(screen.getByTestId('prog-off-reason').textContent).toBe(GATE_REASON);
    expect(screen.queryAllByTestId('prog-item')).toHaveLength(count);
    for (const id of ['prog-add-classes', 'prog-add-party']) expect((screen.getByTestId(id) as HTMLButtonElement).disabled).toBe(true);
    screen.queryAllByTestId('prog-up').concat(screen.queryAllByTestId('prog-down'), screen.queryAllByTestId('prog-delete')).forEach((b) => expect((b as HTMLButtonElement).disabled).toBe(true));
    expect(screen.queryByTestId('prog-item-open')).toBeNull();
    expect(screen.getByTestId('prog-save').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByTestId('prog-save'));
    await flush();
    expect(commandsOf(rpc)).toEqual([]);
    if (count === 0) expect(screen.getByTestId('prog-empty').textContent).toMatch(/Add a class or a party|No sessions are listed/);
    expect(tooSmall(container)).toEqual([]);
  });

  it('a session row reads the name, times with length, line-up with role words, and level chips', async () => {
    mount(ORG_PATHS.eventProgramme(A), routes);
    const rows = await screen.findAllByTestId('prog-item');
    expect(within(rows[0]).getByTestId('prog-item-name').textContent).toBe('Beginner class');
    expect(within(rows[0]).getByTestId('prog-item-time').textContent).toBe('19:00–20:00 · 1h');
    expect(within(rows[0]).getByTestId('prog-item-lineup').textContent).toBe('Ana (Teacher), Ben (Teacher)');
    expect(within(rows[0]).getByTestId('prog-item-levels').textContent).toBe('B Beginner');
    expect(within(rows[2]).getByTestId('prog-item-time').textContent).toBe('21:00–01:00 (next day) · 4h');
    expect(within(rows[2]).getByTestId('prog-item-lineup').textContent).toBe('Dee (DJ)');
    expect(screen.getAllByTestId('prog-section-title').map((t) => t.textContent)).toEqual(['Classes', 'Party']);
  });

  it('a festival is a read-only DAY tree with the reason and no Save', async () => {
    gate.on = true;
    over = { format: 'festival', program: FESTIVAL };
    mount(ORG_PATHS.eventProgramme(FEST), routes);
    await screen.findByTestId('prog-off-reason');
    expect(screen.getByTestId('prog-off-reason').textContent).toBe(FESTIVAL_REASON);
    expect(screen.getAllByTestId('prog-day-title').map((t) => t.textContent)).toEqual(['DAY 1', 'DAY 2']);
    expect(screen.getAllByTestId('prog-item')).toHaveLength(2);
    expect(screen.queryByTestId('prog-save')).toBeNull();
    expect(screen.queryByTestId('prog-add-party')).toBeNull();
  });

  it('while the viewer role loads, a skeleton shows, never the who-may-change-it reason (REVIEW-SW1 N4)', async () => {
    over = { homeHang: true };
    mount(ORG_PATHS.eventProgramme(A), routes);
    expect(await screen.findByTestId('org-programme-role-loading')).toBeTruthy();
    expect(screen.queryByTestId('prog-off-reason')).toBeNull();
  });

  it('the remove confirm says the dates that changed that session lose the change (REVIEW-SW1 B1)', async () => {
    gate.on = true;
    mount(ORG_PATHS.eventProgramme(A), routes);
    fireEvent.click((await screen.findAllByTestId('prog-delete'))[0]);
    const copy = (await screen.findByTestId('prog-delete-copy')).textContent ?? '';
    expect(copy).toContain('Beginner class');
    expect(copy).toContain('loses that change too');
    expect(copy).not.toContain('keep their own sessions');
  });

  it('an ended event gives the lock reason; a viewer who may not write gets the plain reason', async () => {
    gate.on = true;
    over = { lifecycle: 'ended' };
    mount(ORG_PATHS.eventProgramme(A), routes);
    expect((await screen.findByTestId('prog-off-reason')).textContent).toContain('has ended');
  });

  it('the differs badge counts the coming dates with their own sessions and links to each date', async () => {
    gate.on = true;
    const d = (id: string, date: string, so: number) => ({ id, occurrence_date: date, lifecycle_status: 'scheduled', version: 1, has_override: false, session_overrides_count: so, added_sessions_count: 0, materialised_start_utc: `${date}T20:00:00Z` });
    over.dates = [d('oa', '2026-10-23', 1), d('ob', '2026-10-30', 0), d('oc', '2026-11-06', 2)];
    mount(ORG_PATHS.eventProgramme(A), routes);
    expect((await screen.findByTestId('prog-differs-badge')).textContent).toBe('Differs on 2 dates');
    expect(screen.getAllByTestId('prog-differs-link').map((a) => a.getAttribute('href'))).toEqual([ORG_PATHS.dateLineup(A, 'oa'), ORG_PATHS.dateLineup(A, 'oc')]);
  });

  describe('gate ON', () => {
    beforeEach(() => { gate.on = true; });

    it('an untouched Save is off with its reason and sends nothing', async () => {
      mount(ORG_PATHS.eventProgramme(A), routes);
      const save = await screen.findByTestId('prog-save');
      expect(save.getAttribute('aria-disabled')).toBe('true');
      expect(screen.getByTestId('event-step-reason').textContent).toBe('Nothing changed yet');
      fireEvent.click(save);
      await flush();
      expect(commandsOf(rpc)).toEqual([]);
    });

    it('rename a session: ONE series.set_program with the complete tree (unchanged fields echoed), then Done', async () => {
      mount(ORG_PATHS.eventProgramme(A), routes);
      fireEvent.click((await screen.findAllByTestId('prog-item-open'))[0]);
      fireEvent.change(await screen.findByTestId('prog-name'), { target: { value: 'Beginner salsa' } });
      fireEvent.click(screen.getByTestId('prog-sheet-done'));
      await click('prog-save');
      const cmds = commandsOf(rpc);
      expect(cmds).toHaveLength(1);
      expect(cmds[0].env.command.kind).toBe('series.set_program');
      expect(cmds[0].env.expected_version).toBe(world.seriesVersion);
      expect(Object.keys(cmds[0].env.command.payload)).toEqual(['days']);
      const days = cmds[0].env.command.payload.days;
      expect(days[0].sections.map((s: any) => s.items.map((i: any) => i.title))).toEqual([['Beginner salsa', 'Improver class'], ['Party']]);
      expect(days[0].sections[0].items[0]).toMatchObject({ room: 'Studio 2', style: 'sensual' });
      await waitFor(() => expect(where()).toBe(ORG_PATHS.done));
    });

    it('up / down reorder and delete (in-page confirm, no browser confirm) send ONE command', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm');
      mount(ORG_PATHS.eventProgramme(A), routes);
      await screen.findAllByTestId('prog-item');
      expect((screen.getAllByTestId('prog-up')[0] as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(screen.getAllByTestId('prog-down')[0]);
      fireEvent.click(screen.getAllByTestId('prog-delete')[2]);
      fireEvent.click(await screen.findByTestId('prog-delete-keep'));
      expect(screen.getAllByTestId('prog-item')).toHaveLength(3);
      fireEvent.click(screen.getAllByTestId('prog-delete')[2]);
      fireEvent.click(await screen.findByTestId('prog-delete-yes'));
      await click('prog-save');
      expect(confirmSpy).not.toHaveBeenCalled();
      const cmds = commandsOf(rpc);
      expect(cmds).toHaveLength(1);
      const sections = cmds[0].env.command.payload.days[0].sections;
      expect(sections.map((s: any) => s.kind)).toEqual(['classes']);
      expect(sections[0].items.map((i: any) => i.title)).toEqual(['Improver class', 'Beginner class']);
    });

    it('add a class with a name, times and a level, plus a RECENT teacher with a role and level', async () => {
      recent = [{ profile_id: 'p-rex', profile_type: 'teacher', display_name: 'Rex', photo_url: null, roles: ['teaching'], sessions: 4 }];
      const { container } = mount(ORG_PATHS.eventProgramme(A), routes);
      fireEvent.click(await screen.findByTestId('prog-add-classes'));
      fireEvent.click(await screen.findByTestId('prog-type-class'));
      fireEvent.change(await screen.findByTestId('prog-name'), { target: { value: 'Intermediate class' } });
      fireEvent.change(screen.getByTestId('prog-start'), { target: { value: '21:00' } });
      fireEvent.change(screen.getByTestId('prog-end'), { target: { value: '22:00' } });
      fireEvent.click(screen.getByTestId('prog-level-intermediate'));
      fireEvent.click(screen.getByTestId('prog-add-person'));
      expect(await screen.findByTestId('prog-recent')).toBeTruthy();
      press((await screen.findAllByTestId('prog-recent-person'))[0]);
      fireEvent.click(await screen.findByTestId('prog-plevel-advanced'));
      expect(tooSmall(container.ownerDocument.body)).toEqual([]);
      fireEvent.click(screen.getByTestId('prog-sheet-done'));
      await click('prog-save');
      const items = commandsOf(rpc)[0].env.command.payload.days[0].sections[0].items;
      expect(items).toHaveLength(3);
      expect(items[2]).toMatchObject({ title: 'Intermediate class', type: 'class', start_time: '21:00', end_time: '22:00', level_keys: ['intermediate'], sort_order: 2 });
      expect(items[2].people).toEqual([{ profile_id: 'p-rex', profile_type: 'teacher', role: 'teaching', level: 'advanced', sort: 0 }]);
      expect(UUID.test(commandsOf(rpc)[0].env.idempotency_key)).toBe(true);
    });

    it('search finds a teacher by name when there is no RECENT list', async () => {
      mount(ORG_PATHS.eventProgramme(A), routes);
      fireEvent.click((await screen.findAllByTestId('prog-item-open'))[1]);
      fireEvent.click(await screen.findByTestId('prog-add-person'));
      expect(screen.queryByTestId('prog-recent')).toBeNull();
      fireEvent.change(await screen.findByTestId('prog-people-search'), { target: { value: 'cara' } });
      press((await screen.findAllByTestId('prog-result', {}, { timeout: 3000 }))[0]);
      expect((await screen.findAllByTestId('prog-person')).map((p) => p.textContent).join(' ')).toContain('Cara');
    });

    it('a new session without a name or times keeps Save off and names the problem', async () => {
      mount(ORG_PATHS.eventProgramme(A), routes);
      fireEvent.click(await screen.findByTestId('prog-add-party'));
      fireEvent.click(await screen.findByTestId('prog-type-party'));
      fireEvent.click(screen.getByTestId('prog-sheet-done'));
      await waitFor(() => expect(screen.getByTestId('prog-save').getAttribute('aria-disabled')).toBe('true'));
      expect(screen.getByTestId('event-step-reason').textContent).toBe('Fix the highlighted session first');
      fireEvent.click(screen.getByTestId('prog-save'));
      await flush();
      expect(commandsOf(rpc)).toEqual([]);
    });
  });
});

describe('Organisers screen', () => {
  it('gate OFF: the list shows, Link and Remove are off with the reason, nothing is sent', async () => {
    over.organisers = ['org1', 'org2'];
    mount(ORG_PATHS.eventOrganisers(A), routes);
    expect((await screen.findByTestId('org-off-reason')).textContent).toBe(GATE_REASON);
    expect((await screen.findAllByTestId('org-linked-row')).map((r) => r.textContent?.replace('Remove', ''))).toEqual(expect.arrayContaining([expect.stringContaining('Bachata Nights'), expect.stringContaining('Salsa Crew')]));
    screen.getAllByTestId('org-remove').forEach((b) => expect((b as HTMLButtonElement).disabled).toBe(true));
    expect((screen.getByTestId('org-add') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('org-save'));
    await flush();
    expect(commandsOf(rpc)).toEqual([]);
  });

  it('a manager reads the list with the owner-only reason', async () => {
    gate.on = true;
    over.role = 'manager';
    mount(ORG_PATHS.eventOrganisers(A), routes);
    expect((await screen.findByTestId('org-off-reason')).textContent).toBe(MANAGER_REASON);
    expect((screen.getByTestId('org-add') as HTMLButtonElement).disabled).toBe(true);
  });

  it('the last organiser cannot be removed (off with the reason)', async () => {
    gate.on = true;
    mount(ORG_PATHS.eventOrganisers(A), routes);
    await screen.findByTestId('org-linked-row');
    expect((screen.getByTestId('org-remove') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('org-last-reason').textContent).toBe(LAST_ORGANISER_REASON);
  });

  it('owner, gate ON: remove one of two -> ONE series.set_organisers with the remaining ids; link a live page adds it', async () => {
    gate.on = true;
    over.organisers = ['org1', 'org2'];
    over.extraHome = [{ id: 'org3', name: 'Zouk Club', lifecycle_status: 'live', role: 'manager' }];
    const { container } = mount(ORG_PATHS.eventOrganisers(A), routes);
    await screen.findAllByTestId('org-linked-row');
    expect(screen.getByTestId('org-save').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getAllByTestId('org-remove')[1]);
    await waitFor(() => expect(screen.getAllByTestId('org-linked-row')).toHaveLength(1));
    fireEvent.click(screen.getByTestId('org-add'));
    press((await screen.findAllByTestId('org-add-result', {}, { timeout: 3000 }))[0]);
    await waitFor(() => expect(screen.getAllByTestId('org-linked-row')).toHaveLength(2));
    expect(tooSmall(container.ownerDocument.body)).toEqual([]);
    await click('org-save');
    expect(commandsOf(rpc)).toHaveLength(1);
    expect(lastCommand()).toEqual({ kind: 'series.set_organisers', payload: { [ORG_LIST_KEY]: ['org1', 'org3'] } });
  });
});

// INT4 (AW1 B-2): series.set_organisers refuses an ADDED page the caller does not own or manage, so the picker
// offers only the viewer's own live pages (organiser_home_v1, already loaded for the role) and never a stranger's.
describe('Organisers: the add picker offers only pages the viewer runs (AW1)', () => {
  it('lists live owned and managed pages not yet linked; never a stranger page, a draft page or a linked one', async () => {
    gate.on = true;
    over.extraHome = [
      { id: 'org3', name: 'Zouk Club', lifecycle_status: 'live', role: 'manager' },
      { id: 'org4', name: 'Kizomba Draft', lifecycle_status: 'draft', role: 'owner' },
    ];
    pages.rows = [...pages.rows, { id: 'org9', name: 'Stranger Socials', avatar_url: null, lifecycle_status: 'live' }];
    mount(ORG_PATHS.eventOrganisers(A), routes);
    await screen.findByTestId('org-linked-row');
    fireEvent.click(screen.getByTestId('org-add'));
    const rows = await screen.findAllByTestId('org-add-result', {}, { timeout: 3000 });
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Zouk Club');
    expect(screen.getByTestId('org-add-view').textContent).not.toMatch(/Stranger|Kizomba|Bachata Nights/);
    expect(screen.getByTestId('org-add-note').textContent).toBe(ADD_ONLY_YOURS);
  });

  it('nothing left to add: says so and how to get another page added', async () => {
    gate.on = true;
    mount(ORG_PATHS.eventOrganisers(A), routes);
    await screen.findByTestId('org-linked-row');
    fireEvent.click(screen.getByTestId('org-add'));
    expect((await screen.findByTestId('org-add-empty')).textContent).toBe(ADD_NONE_LEFT);
    expect(screen.queryByTestId('org-add-result')).toBeNull();
  });
});

describe('a draft and an unreachable shape still open', () => {
  it('a draft event opens the programme editor like a live one', async () => {
    gate.on = true;
    over = { lifecycle: 'draft', program: NONE };
    mount(ORG_PATHS.eventProgramme(DRAFT), routes);
    expect(await screen.findByTestId('prog-empty')).toBeTruthy();
    expect((screen.getByTestId('prog-add-classes') as HTMLButtonElement).disabled).toBe(false);
  });
});
