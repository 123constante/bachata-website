// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  addArtist, addDay, copyDay, datesChanged, endsAt, festivalCommands, festivalFromStored, festivalProblem, hasTimetable,
  moveStart, newFestival, nightDate, parseTree, removeDay, setDaySessions, setDays, setNightHours, startsAt,
  sameHoursEveryNight, type FestivalOriginal,
} from '../festivalModel';
import { artistsArgs, parseArtists } from '../festivalApi';
import { FestivalCreate, createProblem } from '../FestivalCreate';
import { FestivalEdit } from '../FestivalEdit';
import { newSession } from '../../../sessions/sessionsModel';

afterEach(cleanup);

const day = (i: number, withTimetable: boolean, party = { s: '22:00:00', e: '04:00:00' }) => ({
  day: { id: `d${i}`, day_index: i, date_offset_days: i },
  sections: [
    { section: { id: `p${i}`, kind: 'party' }, items: [{ item: { id: `party${i}`, type: 'party', title: 'Party', start_time: party.s, end_time: party.e }, people: [] }] },
    ...(withTimetable ? [{ section: { id: `w${i}`, kind: 'workshops' }, items: [{ item: { id: `ws${i}`, type: 'workshop', title: 'Bachata sensual', start_time: '12:00:00', end_time: '13:00:00' }, people: [] }] }] : []),
  ],
});
const stored = (days: number, withTimetable: boolean, startDate = '2026-07-10'): FestivalOriginal => ({
  startDate, ticketUrl: 'https://tickets.example/fest', days, artists: [],
  tree: parseTree(Array.from({ length: days }, (_x, i) => day(i, withTimetable))),
});

const DAYS = [1, 2, 3, 4, 7, 14];
// start dates: before/over the spring clock change (29 Mar 2026), the autumn one (25 Oct 2026), summer, winter.
const STARTS: [string, string, string][] = [
  ['2026-03-28', '2026-03-28T22:00:00.000Z', 'night of the spring change starts in GMT'],
  ['2026-03-29', '2026-03-29T21:00:00.000Z', 'day of the spring change starts in BST'],
  ['2026-10-24', '2026-10-24T21:00:00.000Z', 'night before the autumn change is BST'],
  ['2026-10-25', '2026-10-25T22:00:00.000Z', 'night of the autumn change is GMT'],
  ['2026-07-10', '2026-07-10T21:00:00.000Z', 'summer'],
  ['2026-12-11', '2026-12-11T22:00:00.000Z', 'winter'],
];

describe('festival: day counts x timetable x clock change', () => {
  for (const days of DAYS) {
    for (const tt of [false, true]) {
      for (const [date, expected, why] of STARTS) {
        it(`${days} days, timetable ${tt ? 'present' : 'absent'}, ${date} (${why})`, () => {
          const o = stored(days, tt, date);
          const d = festivalFromStored(o);
          expect(d.nights).toHaveLength(days);
          expect(hasTimetable(d)).toBe(tt);
          expect(startsAt(d)).toBe(expected);
          // untouched save sends nothing
          expect(festivalCommands(d, o)).toEqual([]);
        });
      }
    }
  }
});

describe('festival: true instants across the clock change', () => {
  it('a one-night festival on the spring change night lasts 5 real hours (04:00 BST = 03:00Z)', () => {
    const d = newFestival('2026-03-28', 1);
    expect(startsAt(d)).toBe('2026-03-28T22:00:00.000Z');
    expect(endsAt(d)).toBe('2026-03-29T03:00:00.000Z');
  });
  it('the autumn change night lasts 7 real hours', () => {
    const d = newFestival('2026-10-24', 1);
    expect(startsAt(d)).toBe('2026-10-24T21:00:00.000Z');
    expect(endsAt(d)).toBe('2026-10-25T04:00:00.000Z');
  });
  it('a start after midnight (before 08:00) belongs to the night before: the next calendar day (01:00 BST = 00:00Z)', () => {
    const d = setNightHours(newFestival('2026-07-10', 1), 0, { start: '01:00', end: '05:00' });
    expect(startsAt(d)).toBe('2026-07-11T00:00:00.000Z');
  });
  it('moving the first day moves the instant and nights follow', () => {
    const d = moveStart(newFestival('2026-03-27', 3), '2026-03-29');
    expect(nightDate(d, 2)).toBe('2026-03-31');
    expect(startsAt(d)).toBe('2026-03-29T21:00:00.000Z');
  });
});

describe('festival: nights', () => {
  it('defaults to 22:00-04:00, "Use these hours every night" copies one night', () => {
    let d = newFestival('2026-07-10', 4);
    expect(d.nights.every((n) => n.start === '22:00' && n.end === '04:00')).toBe(true);
    d = setNightHours(d, 1, { start: '23:00', end: '05:00' });
    d = sameHoursEveryNight(d, 1);
    expect(d.nights.every((n) => n.start === '23:00' && n.end === '05:00')).toBe(true);
  });
  it('add / remove a day within 1..14', () => {
    expect(setDays(newFestival('2026-07-10', 3), 99).nights).toHaveLength(14);
    expect(setDays(newFestival('2026-07-10', 3), 0).nights).toHaveLength(1);
    expect(removeDay(newFestival('2026-07-10', 1), 0).nights).toHaveLength(1);
    expect(addDay(newFestival('2026-07-10', 14)).nights).toHaveLength(14);
  });
  it('a new day takes the hours of the day before', () => {
    const d = addDay(setNightHours(newFestival('2026-07-10', 2), 1, { start: '23:00', end: '05:00' }));
    expect(d.nights[2]).toMatchObject({ start: '23:00', end: '05:00' });
  });
  it('end equal to start is refused with a reason', () => {
    expect(festivalProblem(setNightHours(newFestival('2026-07-10', 1), 0, { start: '22:00', end: '22:00' }))).toBe('End after start');
  });
  it('a bad ticket link is refused, an empty one is fine', () => {
    expect(festivalProblem({ ...newFestival('2026-07-10', 1), ticketUrl: 'nope' })).toBe('Link must start https://');
    expect(festivalProblem({ ...newFestival('2026-07-10', 1), ticketUrl: '' })).toBeNull();
  });
});

describe('festival: what a save sends', () => {
  it('changing one night sends ONE set_program, keeps stored rows and ids', () => {
    const o = stored(3, true);
    const d = setNightHours(festivalFromStored(o), 1, { start: '23:00', end: '05:00' });
    const cmds = festivalCommands(d, o);
    expect(cmds.map((c) => c.kind)).toEqual(['series.set_program']);
    const days = cmds[0].payload.days as { id: string; sections: { items: { id?: string; start_time: string }[] }[] }[];
    expect(days).toHaveLength(3);
    expect(days[1].sections[0].items[0]).toMatchObject({ id: 'party1', start_time: '23:00' });
    expect(days[0].sections[0].items[0].start_time).toBe('22:00:00');
    expect(days[1].sections[1].items[0].id).toBe('ws1');
  });
  it('moving the first day sends the new default_start_date and counts as a change', () => {
    const o = stored(3, false);
    const d = moveStart(festivalFromStored(o), '2026-07-11');
    expect(datesChanged(d, o)).toBe(true);
    expect(festivalCommands(d, o)).toEqual([{ kind: 'series.upsert', payload: { default_start_date: '2026-07-11' } }]);
  });
  it('the ticket link is the only payment field sent', () => {
    const o = stored(2, false);
    const d = { ...festivalFromStored(o), ticketUrl: '' };
    expect(festivalCommands(d, o)).toEqual([{ kind: 'series.upsert', payload: { default_ticket_url: null } }]);
  });
  it('adding a day appends a day with a party and leaves the others as stored', () => {
    const o = stored(2, true);
    const cmds = festivalCommands(addDay(festivalFromStored(o)), o);
    const days = cmds[0].payload.days as { id?: string }[];
    expect(days).toHaveLength(3);
    expect(days[2].id).toBeUndefined();
    expect(days[0].id).toBe('d0');
  });
  it('removing the middle day rewrites the later nights onto the stored rows', () => {
    const o = stored(3, false);
    const d = setNightHours(festivalFromStored(o), 2, { start: '21:00', end: '03:00' });
    const out = removeDay(d, 1);
    const days = festivalCommands(out, o)[0].payload.days as { sections: { items: { start_time: string }[] }[] }[];
    expect(days).toHaveLength(2);
    expect(days[1].sections[0].items[0].start_time).toBe('21:00');
  });
  it('a timetable added to a festival that had none (after Go live) sends set_program', () => {
    const o = stored(2, false);
    let d = festivalFromStored(o);
    expect(hasTimetable(d)).toBe(false);
    d = setDaySessions(d, 0, [newSession('workshop', '12:00', 'new1')]);
    const days = festivalCommands(d, o)[0].payload.days as { sections: { items: { type: string }[] }[] }[];
    expect(days[0].sections.flatMap((s) => s.items.map((i) => i.type))).toEqual(['party', 'workshop']);
  });
  it('Copy a day copies sessions with fresh ids and counts as a timetable change', () => {
    const o = stored(3, true);
    const d = copyDay(festivalFromStored(o), 0, 2);
    expect(d.timetable[2]).toHaveLength(1);
    expect(d.timetable[2][0].id).not.toBe(d.timetable[0][0].id);
    expect(festivalCommands(d, o)).toHaveLength(1);
  });
  it('an existing timetable is kept untouched when only party hours change', () => {
    const o = stored(2, true);
    const d = setNightHours(festivalFromStored(o), 0, { start: '23:00', end: '05:00' });
    const days = festivalCommands(d, o)[0].payload.days as { sections: { items: { id?: string; title: string }[] }[] }[];
    expect(days[0].sections[1].items[0]).toMatchObject({ id: 'ws0', title: 'Bachata sensual' });
  });
});

describe('festival: artists (one list)', () => {
  it('adds once, keeps role, builds the pinned RPC args', () => {
    let d = newFestival('2026-07-10', 2);
    d = addArtist(addArtist(d, { personId: 'p1', name: 'Ana', role: 'teacher' }), { personId: 'p1', name: 'Ana', role: 'dj' });
    expect(d.artists).toHaveLength(1);
    expect(artistsArgs('s1', d.artists)).toEqual({ p_series_id: 's1', p_artists: [{ person_id: 'p1', role: 'teacher' }] });
  });
  it('parses the server rows and drops unknown roles', () => {
    expect(parseArtists([{ person_id: 'a', role: 'dj', name: 'Leo' }, { person_id: 'b', role: 'judge', name: 'X' }, { role: 'dj' }])).toEqual([{ personId: 'a', role: 'dj', name: 'Leo' }]);
  });
});

describe('FestivalCreate', () => {
  it('is off with a reason until a day is picked and creates a 3-night draft', () => {
    const onCreate = vi.fn();
    render(<FestivalCreate onCreate={onCreate} today="2026-07-01" />);
    expect((screen.getByTestId('festival-create-go') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('festival-reason').textContent).toContain('Pick the first day');
    fireEvent.change(screen.getByTestId('festival-start'), { target: { value: '2026-07-10' } });
    expect(screen.getByTestId('festival-night-2-hours').textContent).toContain('22:00');
    fireEvent.click(screen.getByTestId('festival-create-go'));
    expect(onCreate).toHaveBeenCalledOnce();
    expect(onCreate.mock.calls[0][0].nights).toHaveLength(3);
  });
  it('refuses a past first day with a reason', () => {
    expect(createProblem(newFestival('2026-06-30', 1), '2026-07-01')).toBe('Pick a day from today');
  });
  it('tap a night to change it; the open night offers "Use these hours every night"', () => {
    render(<FestivalCreate onCreate={vi.fn()} today="2026-07-01" initial={newFestival('2026-07-10', 3)} />);
    fireEvent.click(screen.getByTestId('festival-night-0-toggle'));
    fireEvent.change(screen.getByTestId('festival-night-0-start'), { target: { value: '23:00' } });
    fireEvent.click(screen.getByTestId('festival-night-0-all'));
    expect(screen.getByTestId('festival-night-2-hours').textContent).toContain('23:00');
  });
  it('shows no pass editor or other payment fields', () => {
    render(<FestivalCreate onCreate={vi.fn()} today="2026-07-01" initial={newFestival('2026-07-10', 2)} />);
    expect(screen.queryByText(/pass/i)).toBeNull();
    expect(screen.queryByText(/door|cash|bank/i)).toBeNull();
  });
});

describe('FestivalEdit', () => {
  const deps = () => ({ send: vi.fn().mockResolvedValue(undefined), saveArtists: vi.fn().mockResolvedValue(undefined), search: vi.fn().mockResolvedValue([{ id: 'p9', name: 'Marta' }]) });
  const search = vi.fn().mockResolvedValue([]);
  it('an untouched festival cannot be saved (nothing sent)', () => {
    const d = deps();
    render(<FestivalEdit original={stored(3, true)} live deps={d} search={search} onOpenOther={vi.fn()} />);
    expect((screen.getByTestId('festival-save') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('festival-save').textContent).toContain('Update live event');
    expect(screen.getByTestId('festival-save-reason').textContent).toContain('No changes yet');
    expect(d.send).not.toHaveBeenCalled();
  });
  it('lists the six entries; Flyer/Details/About hand off', () => {
    const open = vi.fn();
    render(<FestivalEdit original={stored(2, false)} live={false} deps={deps()} search={search} onOpenOther={open} />);
    for (const id of ['hours', 'artists', 'timetable', 'flyer', 'details', 'about']) expect(screen.getByTestId(`festival-entry-${id}`)).toBeTruthy();
    fireEvent.click(screen.getByTestId('festival-entry-flyer'));
    expect(open).toHaveBeenCalledWith('flyer');
  });
  it('moving the first day enables Update live event and sends the upsert', async () => {
    const d = deps();
    render(<FestivalEdit original={stored(2, false)} live deps={d} search={search} onOpenOther={vi.fn()} />);
    fireEvent.click(screen.getByTestId('festival-entry-hours'));
    fireEvent.change(screen.getByTestId('festival-edit-start'), { target: { value: '2026-07-12' } });
    fireEvent.click(screen.getByTestId('festival-save'));
    await waitFor(() => expect(d.send).toHaveBeenCalledWith({ kind: 'series.upsert', payload: { default_start_date: '2026-07-12' } }));
    expect(d.saveArtists).not.toHaveBeenCalled();
  });
  it('an artist added is saved through the artist RPC only', async () => {
    const d = deps();
    render(<FestivalEdit original={stored(2, false)} live={false} deps={d} search={search} onOpenOther={vi.fn()} />);
    fireEvent.click(screen.getByTestId('festival-entry-artists'));
    fireEvent.change(screen.getByLabelText(/Search for a teacher/i), { target: { value: 'Mar' } });
    fireEvent.click(await screen.findByTestId('festival-hit-p9'));
    expect(screen.getByTestId('festival-lineup').textContent).toContain('Marta (Teacher)');
    fireEvent.click(screen.getByTestId('festival-save'));
    await waitFor(() => expect(d.saveArtists).toHaveBeenCalledWith([{ personId: 'p9', name: 'Marta', role: 'teacher' }]));
    expect(d.send).not.toHaveBeenCalled();
  });
  it('a failed save shows the message and keeps the draft', async () => {
    const d = deps();
    d.send.mockRejectedValue(new Error('version_conflict'));
    render(<FestivalEdit original={stored(2, false)} live deps={d} search={search} onOpenOther={vi.fn()} />);
    fireEvent.click(screen.getByTestId('festival-entry-hours'));
    fireEvent.change(screen.getByTestId('festival-edit-start'), { target: { value: '2026-07-12' } });
    fireEvent.click(screen.getByTestId('festival-save'));
    expect((await screen.findByTestId('festival-error')).textContent).toContain('version_conflict');
  });
});

describe('festival: prod shapes (7 live: parties per day 0, 1/4, 10/5, 3/3)', () => {
  const party = (id: string) => ({ section: { id: `s${id}`, kind: 'party' }, items: [{ item: { id, type: 'party', title: 'Party', start_time: '21:00:00', end_time: '03:00:00' }, people: [] }] });
  const mk = (days: unknown[]): FestivalOriginal => ({ startDate: '2026-07-10', ticketUrl: '', days: days.length, artists: [], tree: parseTree(days) });
  it('days with no party row read the default hours and an untouched save sends nothing', () => {
    const o = mk([{ day: { id: 'a' }, sections: [] }, { day: { id: 'b' }, sections: [] }]);
    const d = festivalFromStored(o);
    expect(d.nights[0]).toMatchObject({ start: '22:00', end: '04:00', stored: null });
    expect(festivalCommands(d, o)).toEqual([]);
  });
  it('setting hours on a night with no party adds one party and keeps the other day', () => {
    const o = mk([{ day: { id: 'a' }, sections: [] }, { day: { id: 'b' }, sections: [party('p2')] }]);
    const days = festivalCommands(setNightHours(festivalFromStored(o), 0, { start: '23:00', end: '05:00' }), o)[0].payload.days as { sections: { items: unknown[] }[] }[];
    expect(days[0].sections[0].items).toHaveLength(1);
    expect(days[1].sections[0].items).toHaveLength(1);
  });
  it('two parties on one day: only the first is edited, the second kept', () => {
    const two = { day: { id: 'a' }, sections: [party('p1'), party('p2')] };
    const o = mk([two]);
    const days = festivalCommands(setNightHours(festivalFromStored(o), 0, { start: '23:00', end: '05:00' }), o)[0].payload.days as { sections: { items: { id: string; start_time: string }[] }[] }[];
    expect(days[0].sections[0].items[0].start_time).toBe('23:00');
    expect(days[0].sections[1].items[0]).toMatchObject({ id: 'p2', start_time: '21:00:00' });
  });
});
