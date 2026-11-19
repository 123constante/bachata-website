// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { flags } from '@/lib/featureFlags';
import type { DoorList, DoorRow } from '../../door/data';
import { compareOf, type PastNight } from '../../dash/dashModel';
import { pastNightOf, pastOf } from '../../dash/pastNights';
import { isPushed } from '../../shell/pushed';
import { P3_PATHS } from '../../shell/paths';
import { GUEST, NO_NAMES, ROW_CAP_NOTE, eventWhoIsInLinkOf, fromOf, sheetBackOf, whoCameLinkOf, whoCameOf, whoIsInLinkOf, whoIsInOf } from '../sheetsModel';
import { WhoListView } from '../WhoSheets';

/**
 * Slice 3 matrix: sheet (night / after) x size (zero / some / many, over 100 rows) x null name x seat
 * (contributor / owner) x cancelled night x draft night (no sheet link) x a series with 13 dates.
 */
const row = (i: number, inAt: boolean, name: string | null = `P${i}`): DoorRow => ({ ticketId: `t${i}`, firstName: name, quantity: 1, typeName: 'Party', checkedInAt: inAt ? '2026-11-17T21:00:00Z' : null });
const list = (rows: DoorRow[], more: Partial<DoorList> = {}): DoorList => ({
  result: 'ok', rows, truncated: false, inCount: rows.filter((r) => r.checkedInAt).length, totalCount: rows.length, loadedAt: 0, ...more,
});
const SIZES = {
  zero: list([]),
  some: list([row(1, true), row(2, true), row(3, false)]),
  many: list([...Array.from({ length: 130 }, (_, i) => row(i, true)), ...Array.from({ length: 20 }, (_, i) => row(200 + i, false))]),
} as const;
const EXPECT = {
  in: { zero: { big: 0, people: 0 }, some: { big: 2, people: 2 }, many: { big: 130, people: 130 } },
  came: { zero: { big: 0, came: 0, missed: 0 }, some: { big: 2, came: 2, missed: 1 }, many: { big: 130, came: 130, missed: 20 } },
} as const;
const SEATS = ['owner', 'contributor'] as const;
afterEach(cleanup);
const drawn = (el: JSX.Element) => render(<MemoryRouter>{el}</MemoryRouter>);

describe('slice 3: Who is in (night) x size x seat', () => {
  for (const size of Object.keys(SIZES) as (keyof typeof SIZES)[]) {
    for (const seat of SEATS) {
      it(`${size} / ${seat}`, () => {
        const m = whoIsInOf(SIZES[size], { doorOnScreen: true });
        expect(m.big).toBe(EXPECT.in[size].big);
        expect(m.lists[0].people).toHaveLength(EXPECT.in[size].people);
        drawn(<WhoListView model={m} name="Salsa Fridays" sub={null} />);
        // positive only: a zero headline is never drawn
        if (EXPECT.in[size].big > 0) expect(screen.getByTestId('sheet-big').textContent).toBe(String(EXPECT.in[size].big));
        else expect(screen.queryByTestId('sheet-big')).toBeNull();
        expect(screen.queryAllByTestId('sheet-person')).toHaveLength(EXPECT.in[size].people);
        // read only, and no money for any seat: no buttons, no pound sign
        expect(screen.queryAllByRole('button')).toHaveLength(0);
        expect(document.body.textContent).not.toMatch(/\u00a3/);
      });
    }
  }
  it('zero with tickets: the empty state says what to do, Door only when Door is on screen', () => {
    const none = list([row(1, false), row(2, false)]);
    expect(whoIsInOf(none, { doorOnScreen: true }).lists[0].empty).toBe('Nobody has checked in yet. Open Door to scan tickets.');
    expect(whoIsInOf(none, { doorOnScreen: false }).lists[0].empty).toBe('Nobody has checked in yet.');
    expect(whoIsInOf(none, { doorOnScreen: false }).under).toBe('2 expected \u00b7 2 still to arrive');
  });
  it('some: expected and still to arrive underneath', () => expect(whoIsInOf(SIZES.some, { doorOnScreen: false }).under).toBe('3 expected \u00b7 1 still to arrive'));
  it('no tickets at all: says so, no expected line', () => {
    const m = whoIsInOf(SIZES.zero, { doorOnScreen: true });
    expect(m.lists[0].empty).toBe('Nobody has a ticket for this night yet.');
    expect(m.under).toBeNull();
  });
});

describe('slice 3: Who came / did not come (after) x size x seat', () => {
  for (const size of Object.keys(SIZES) as (keyof typeof SIZES)[]) {
    for (const seat of SEATS) {
      it(`${size} / ${seat}`, () => {
        const m = whoCameOf(SIZES[size]);
        const e = EXPECT.came[size];
        expect(m.big).toBe(e.big);
        drawn(<WhoListView model={m} name="Salsa Fridays" sub="Friday 13 November" />);
        if (size === 'zero') {
          expect(m.lists).toHaveLength(0);
          expect(screen.queryByTestId('sheet-big')).toBeNull();
          expect(screen.getByTestId('sheet-note').textContent).toMatch(/Nobody had a ticket/);
        } else {
          expect(within(screen.getByTestId('sheet-came-list')).queryAllByTestId('sheet-person')).toHaveLength(e.came);
          expect(within(screen.getByTestId('sheet-missed-list')).queryAllByTestId('sheet-person')).toHaveLength(e.missed);
          expect(screen.getByTestId('sheet-came-list').textContent).toMatch(new RegExp(`^Came \\(${e.came}\\)`));
        }
        expect(screen.queryAllByRole('button')).toHaveLength(0);
        expect(document.body.textContent).not.toMatch(/\u00a3/);
      });
    }
  }
  it('everyone came: Did not come says so', () => {
    expect(whoCameOf(list([row(1, true)])).lists[1].empty).toBe('Everyone with a ticket came.');
  });
  it('nobody came: Came says so', () => {
    expect(whoCameOf(list([row(1, false)])).lists[0].empty).toBe('Nobody was checked in at the door that night.');
  });
});

describe('slice 3: names', () => {
  it('a ticket with no name is Guest, on both sheets', () => {
    const d = list([row(1, true, null), row(2, false, null)]);
    expect(whoIsInOf(d, { doorOnScreen: false }).lists[0].people.map((p) => p.name)).toEqual([GUEST]);
    expect(whoCameOf(d).lists.map((l) => l.people.map((p) => p.name))).toEqual([[GUEST], [GUEST]]);
  });
  it('counts but no rows: "Names are not available yet", never invented names', () => {
    const d = list([], { inCount: 5, totalCount: 9 });
    const m = whoIsInOf(d, { doorOnScreen: false });
    expect(m.big).toBe(5);
    expect(m.note).toBe(NO_NAMES);
    expect(m.lists[0].people).toHaveLength(0);
    expect(whoCameOf(d).note).toBe(NO_NAMES);
  });
  it('the server capped the list at 500: says the count is the full number', () => {
    expect(whoCameOf(list([row(1, true)], { truncated: true, inCount: 600, totalCount: 700 })).note).toBe(ROW_CAP_NOTE);
    // capped and none of the 500 rows checked in: the cap is the reason, not "names missing"
    expect(whoIsInOf(list([row(1, false)], { truncated: true, inCount: 300, totalCount: 700 }), { doorOnScreen: false }).note).toBe(ROW_CAP_NOTE);
  });
  it('a refused seat and a missing night: one sentence, no count', () => {
    const refusedList = list([], { result: 'not_allowed', inCount: null, totalCount: null });
    expect(whoIsInOf(refusedList, { doorOnScreen: true })).toMatchObject({ state: 'not_allowed', big: null, lists: [] });
    expect(whoCameOf(list([], { result: 'wrong_night', inCount: null, totalCount: null }))).toMatchObject({ state: 'no_night', big: null, lists: [] });
  });
});

const past = (more: Partial<PastNight> = {}): PastNight => ({
  key: 's1:2026-11-13', seriesId: 's1', occurrenceId: 'o1', date: '2026-11-13', name: 'Salsa Fridays', when: 'Friday 13 November',
  cancelled: false, cameIn: 12, ticketsSold: 20, raffle: null, ...more,
});

describe('slice 3: links (cancelled / draft nights have none)', () => {
  it('Who came: a past night links to its occurrence, back to where it was opened', () => {
    expect(whoCameLinkOf(past(), 'compare')).toBe(`${P3_PATHS.event('s1')}/came/o1?from=compare`);
  });
  it('Who came: a cancelled night has no sheet link (and no Compare row)', () => {
    expect(whoCameLinkOf(past({ cancelled: true }), 'home')).toBeNull();
    expect(compareOf([past({ cancelled: true })]).rows).toHaveLength(0);
  });
  it('Who came: no occurrence id, no link', () => expect(whoCameLinkOf(past({ occurrenceId: undefined }), 'home')).toBeNull());
  it('Who is in: a draft night has no sheet link; a cancelled one neither; a live one does', () => {
    expect(whoIsInLinkOf({ seriesId: 's1', draft: true, cancelled: false }, 'home')).toBeNull();
    expect(whoIsInLinkOf({ seriesId: 's1', draft: false, cancelled: true }, 'home')).toBeNull();
    expect(whoIsInLinkOf({ seriesId: 's1', draft: false, cancelled: false }, 'home')).toBe(`${P3_PATHS.event('s1')}/in?from=home`);
    expect(whoIsInLinkOf(null, 'home')).toBeNull();
  });
  it('a Going-only Compare row has no Who came link (it would open an empty sheet)', () => {
    expect(compareOf([past({ cameIn: null, going: 12 })]).rows[0].to).toBeNull();
  });
  it('event page: Who is in only while a night is still to come, never for a draft / ended / cancelled event', () => {
    expect(eventWhoIsInLinkOf('s1', 'live', true)).toBe(`${P3_PATHS.event('s1')}/in?from=event`);
    expect(eventWhoIsInLinkOf('s1', 'live', false)).toBeNull();
    for (const l of ['draft', 'ended', 'cancelled', 'archived']) expect(eventWhoIsInLinkOf('s1', l, true)).toBeNull();
  });
  it('the sheets are pushed (no tab bar) while the flag is on; flag off = nothing changes', () => {
    const was = flags.organiserDash;
    (flags as { organiserDash: boolean }).organiserDash = false;
    expect(isPushed(P3_PATHS.whoIsIn('s1'))).toBe(false);
    (flags as { organiserDash: boolean }).organiserDash = true;
    expect(isPushed(P3_PATHS.whoIsIn('s1'))).toBe(true);
    expect(isPushed(P3_PATHS.whoCame('s1', 'o1'))).toBe(true);
    expect(isPushed(P3_PATHS.event('s1'))).toBe(false);
    (flags as { organiserDash: boolean }).organiserDash = was;
  });
  it('back returns to where the sheet was opened from; unknown = the event page', () => {
    const home = { to: P3_PATHS.home, label: 'Home' };
    expect(sheetBackOf(fromOf('home'), 's1', home)).toEqual(home);
    expect(sheetBackOf(fromOf('compare'), 's1', home)).toEqual({ to: P3_PATHS.compare, label: 'Compare nights' });
    expect(sheetBackOf(fromOf('event'), 's1', home)).toEqual({ to: P3_PATHS.event('s1'), label: 'Event' });
    expect(sheetBackOf(fromOf('https://evil'), 's1', home)).toEqual({ to: P3_PATHS.event('s1'), label: 'Event' });
  });
});

describe('slice 3: a series with 13 weekly dates', () => {
  const rn = (i: number) => {
    const date = new Date(Date.UTC(2026, 8, 4 + 7 * i)).toISOString().slice(0, 10);
    return { occurrenceId: `o${i}`, date, startLocal: null, chip: i === 9 ? 'cancelled' : 'past', raffleOn: false, entries: 0, locked: false, winner: null, canSet: false, refuseReason: null } as never;
  };
  const read = { kind: 'ok', read: { seriesId: 's1', canEdit: true, viewOnlyReason: null, nights: Array.from({ length: 13 }, (_, i) => rn(i)) } } as never;
  it('each past night links to ITS occurrence; the cancelled one has none', () => {
    const today = '2026-11-28';
    const picked = pastOf([{ seriesId: 's1', name: 'Weekly', read }], today, 13);
    const links = picked.map((p) => whoCameLinkOf(pastNightOf(p, today, { cameIn: 3, ticketsSold: 5 }), 'compare'));
    expect(picked).toHaveLength(13);
    expect(new Set(links.filter(Boolean)).size).toBe(12);
    expect(links[picked.findIndex((p) => p.night.occurrenceId === 'o9')]).toBeNull();
    expect(links[0]).toContain('/came/o12');
  });
});
