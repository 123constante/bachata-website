// @vitest-environment jsdom
/**
 * The face wall, table-driven: person shape x list. The same fact reads the same everywhere:
 * chips come from badges.ts (ROLE_ORDER / ROLE_LABEL), links from hrefForRole, names from the
 * existing resolvers. A mutant of linkRoleFor ordering or of the broken-image fallback reds this file.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { installJsdomPolyfills } from '../../../../../tests/client/jsdomPolyfills';
import type { PersonBadge } from '@/modules/person-page/badges';
import { DancersWall, DjsWall } from '../lists';
import { initialsOf, wallDateLabel } from '../model';

const B = (id: string, roles: PersonBadge['roles'], over: Partial<PersonBadge> = {}): PersonBadge => ({
  id, roles, djName: null, djHasUpcoming: false, nextGigDate: null, ...over,
});
const badgeMap = (...bs: PersonBadge[]) => new Map(bs.map((b) => [b.id, b]));
const DJ = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id, display_name: name, dj_name: name, first_name: null, surname: null, photo_url: null,
  nationality_code: null, has_upcoming_gig: false, next_gig_date: null, ...over,
});
const DN = (id: string, over: Record<string, unknown> = {}) => ({ id, avatar_url: null, nationality: null, ...over });
const FUTURE = '2099-10-23'; // a Friday

const mountDjs = (djs: ReturnType<typeof DJ>[], badges = new Map<string, PersonBadge>(), o: { failed?: boolean; teachers?: boolean } = {}) =>
  render(<MemoryRouter><DjsWall djs={djs} isLoading={false} badges={badges} badgesFailed={!!o.failed} teacherPagesOpen={!!o.teachers} /></MemoryRouter>);
const mountDancers = (rows: ReturnType<typeof DN>[], names: Record<string, string>, badges = new Map<string, PersonBadge>(), o: { failed?: boolean; teachers?: boolean } = {}) =>
  render(<MemoryRouter><DancersWall dancers={rows} getName={(d) => names[d.id] ?? 'Dancer'} isLoading={false} badges={badges} badgesFailed={!!o.failed} teacherPagesOpen={!!o.teachers} /></MemoryRouter>);

const tile = (id: string) => screen.getAllByTestId('wall-tile').find((t) => t.getAttribute('href')?.endsWith(`/${id}`)) as HTMLElement;
const chips = (el: HTMLElement) => within(el).queryAllByTestId('role-chip').map((c) => (c.textContent ?? '').replace(/^,\s*/, ''));

beforeEach(() => installJsdomPolyfills());
afterEach(() => cleanup());

describe('/djs wall: person shape table', () => {
  const rows = [
    DJ('gig', 'Bisket', { has_upcoming_gig: true, next_gig_date: FUTURE, nationality_code: 'GB' }),
    DJ('nogig', 'Roger'),
    DJ('stage', 'DJ El Rugido'),
    DJ('long', 'DJ Carlos De La Cruz'),
    DJ('three', 'Tri'),
    DJ('past', 'Oldie', { has_upcoming_gig: true, next_gig_date: '2020-01-03' }),
  ];
  const badges = badgeMap(B('three', ['teacher', 'dj', 'dancer']), B('gig', ['dj']), B('stage', ['dj'], { djName: 'DJ El Rugido' }));

  it.each([
    ['gig', { name: 'Bisket', date: 'Fri 23', chips: ['DJ'], flag: true, href: '/djs/gig' }],
    ['nogig', { name: 'Roger', date: null, chips: ['DJ'], flag: false, href: '/djs/nogig' }],
    ['stage', { name: 'El Rugido', date: null, chips: ['DJ'], flag: false, href: '/djs/stage' }],
    ['long', { name: 'Carlos De La Cruz', date: null, chips: ['DJ'], flag: false, href: '/djs/long' }],
    ['three', { name: 'Tri', date: null, chips: ['Teacher', 'DJ', 'Dancer'], flag: false, href: '/djs/three' }],
    ['past', { name: 'Oldie', date: null, chips: ['DJ'], flag: false, href: '/djs/past' }],
  ])('%s', (id, want) => {
    mountDjs(rows, badges);
    const t = tile(id as string);
    expect(t.getAttribute('href')).toBe(want.href);
    expect(within(t).getByTestId('tile-name').textContent).toBe(want.name);
    expect(chips(t)).toEqual(want.chips);
    expect(within(t).queryByTestId('date-chip')?.textContent?.replace('Next gig ', '') ?? null).toBe(want.date);
    expect(!!within(t).queryByRole('img', { name: /Nationality/ })).toBe(want.flag);
  });

  it('upcoming gigs lead, by date, then the RPC order (as /djs always did)', () => {
    mountDjs([DJ('a', 'A'), DJ('b', 'B', { has_upcoming_gig: true, next_gig_date: '2099-12-05' }), DJ('c', 'C', { has_upcoming_gig: true, next_gig_date: FUTURE })], new Map());
    expect(screen.getAllByTestId('wall-tile').map((t) => t.getAttribute('href'))).toEqual(['/djs/c', '/djs/b', '/djs/a']);
  });

  it('a name is never clipped: no max-height / hidden overflow on the name, wrapping allowed', () => {
    mountDjs(rows, badges);
    for (const n of screen.getAllByTestId('tile-name')) {
      const st = (n as HTMLElement).style;
      expect(st.maxHeight).toBe('');
      expect(st.overflow).toBe('');
      expect(st.overflowWrap).toBe('anywhere');
    }
  });

  it('lead role colours the tile: a DJ-only tile is DJ-led, a Teacher+DJ+Dancer tile follows linkRoleFor (DJ first)', () => {
    mountDjs(rows, badges);
    expect(tile('nogig').getAttribute('data-lead')).toBe('dj');
    expect(tile('three').getAttribute('data-lead')).toBe('dj');
  });

  it('badges read failed: every DJ still shows, as a DJ, only the All filter is offered', () => {
    mountDjs(rows, new Map(), { failed: true });
    expect(screen.getAllByTestId('wall-tile')).toHaveLength(rows.length);
    expect(chips(tile('three'))).toEqual(['DJ']);
    expect(screen.queryAllByTestId('wall-filter')).toHaveLength(0);
  });

  it('filters: DJs match all, Dancers narrows to the 3-role DJ, empty filter says what to do and Show everyone resets', () => {
    mountDjs(rows, badges);
    expect(screen.getAllByTestId('wall-filter').map((b) => b.textContent)).toEqual(['All', 'DJs', 'Dancers']); // Teachers hidden: pages closed
    fireEvent.click(screen.getByRole('button', { name: 'Dancers' }));
    expect(screen.getAllByTestId('wall-tile').map((t) => t.getAttribute('href'))).toEqual(['/djs/three']);
  });

  it('Teachers chip appears only when teacher pages are open', () => {
    mountDjs(rows, badges, { teachers: true });
    expect(screen.getAllByTestId('wall-filter').map((b) => b.textContent)).toContain('Teachers');
  });

  it('empty filter: a sentence with a way out', () => {
    mountDjs([DJ('x', 'Xavi')], badgeMap(B('x', ['dj'])), { teachers: true });
    fireEvent.click(screen.getByRole('button', { name: 'Teachers' }));
    expect(screen.getByTestId('wall-empty-filter').textContent).toMatch(/No DJs match this filter\. Show everyone/);
    fireEvent.click(screen.getByRole('button', { name: 'Show everyone' }));
    expect(screen.getAllByTestId('wall-tile')).toHaveLength(1);
  });

  it('nobody at all: says what the visitor can do', () => {
    mountDjs([]);
    expect(screen.getByTestId('wall-empty').textContent).toMatch(/No DJs on the wall yet/);
  });
});

describe('/dancers wall: person shape table', () => {
  const rows = [
    DN('td'), DN('plain'), DN('three'), DN('nophoto'),
    DN('broken', { avatar_url: 'https://media.example/broken.jpg' }),
    DN('long'), DN('sob'), DN('zero'), DN('flag', { nationality: 'PL' }),
    DN('djgig'),
  ];
  const names: Record<string, string> = {
    td: 'Ana Lopez', plain: 'Fay', three: 'Tri Role', nophoto: 'Nia Ox', broken: 'Bro Ken',
    long: 'DJ Carlos De La Cruz', sob: 'Sobolewska', zero: 'Zed', flag: 'Pola', djgig: 'Gigi',
  };
  const badges = badgeMap(
    B('td', ['teacher', 'dancer']), B('plain', ['dancer']), B('three', ['teacher', 'dj', 'dancer']), B('nophoto', ['dancer']),
    B('broken', ['dancer']), B('long', ['dancer']), B('sob', ['dancer']), B('flag', ['dancer']),
    B('djgig', ['dj', 'dancer'], { djHasUpcoming: true, nextGigDate: FUTURE }),
  );

  it.each([
    ['td', { name: 'Ana Lopez', chips: ['Teacher', 'Dancer'], lead: 'dancer' }],
    ['plain', { name: 'Fay', chips: ['Dancer'], lead: 'dancer' }],
    ['three', { name: 'Tri Role', chips: ['Teacher', 'DJ', 'Dancer'], lead: 'dj' }],
    ['long', { name: 'DJ Carlos De La Cruz', chips: ['Dancer'], lead: 'dancer' }],
    ['sob', { name: 'Sobolewska', chips: ['Dancer'], lead: 'dancer' }],
    ['zero', { name: 'Zed', chips: [], lead: 'dancer' }],
  ])('%s', (id, want) => {
    mountDancers(rows, names, badges);
    const t = tile(id as string);
    expect(t.getAttribute('href')).toBe(`/dancers/${id}`);
    expect(within(t).getByTestId('tile-name').textContent).toBe(want.name);
    expect(chips(t)).toEqual(want.chips);
    expect(t.getAttribute('data-lead')).toBe(want.lead);
    expect(within(t).queryByTestId('date-chip')).toBeNull();
  });

  it('only dancers with the Dancer role are the page\'s business: the page filters, the wall shows what it is given; a gig date shows for a DJ-dancer only', () => {
    mountDancers(rows, names, badges);
    expect(within(tile('djgig')).getByTestId('date-chip').textContent).toContain('Fri 23');
    expect(within(tile('plain')).queryByTestId('date-chip')).toBeNull();
  });

  it('no photo -> initials tile, never a broken image', () => {
    mountDancers(rows, names, badges);
    const f = within(tile('nophoto')).getByTestId('wall-face');
    expect(f.getAttribute('data-face')).toBe('initials');
    expect(f.textContent).toBe('NO');
    expect(f.querySelector('img')).toBeNull();
  });

  it('a photo that fails to load falls back to the initials tile (mutant: drop onError -> red)', () => {
    mountDancers(rows, names, badges);
    const f = within(tile('broken')).getByTestId('wall-face');
    expect(f.getAttribute('data-face')).toBe('photo');
    fireEvent.error(f.querySelector('img') as HTMLImageElement);
    expect(within(tile('broken')).getByTestId('wall-face').getAttribute('data-face')).toBe('initials');
    expect(within(tile('broken')).getByTestId('wall-face').textContent).toBe('BK');
    expect(within(tile('broken')).getByTestId('wall-face').querySelector('img')).toBeNull();
  });

  it('flag sticker only when nationality exists', () => {
    mountDancers(rows, names, badges);
    expect(within(tile('flag')).queryByRole('img', { name: /Nationality/ })).not.toBeNull();
    expect(within(tile('plain')).queryByRole('img', { name: /Nationality/ })).toBeNull();
  });

  it('badges-read-failed: every dancer shows, no chips, no "No dancers yet", only All', () => {
    mountDancers(rows, names, new Map(), { failed: true });
    expect(screen.getAllByTestId('wall-tile')).toHaveLength(rows.length);
    expect(screen.queryByText(/No dancers yet/)).toBeNull();
    expect(screen.queryAllByTestId('role-chip')).toHaveLength(0);
    expect(screen.queryAllByTestId('wall-filter')).toHaveLength(0);
  });

  it('the tile is ONE link: exactly one anchor per tile, no nested links', () => {
    mountDancers(rows, names, badges);
    expect(within(screen.getByTestId('wall-grid')).getAllByRole('link')).toHaveLength(rows.length); // the Join row's links sit outside the grid
    for (const t of screen.getAllByTestId('wall-tile')) expect(t.querySelectorAll('a')).toHaveLength(0);
  });

  it('accessible name reads name then each role, with separators', () => {
    mountDancers(rows, names, badges);
    expect(tile('td').textContent).toMatch(/Ana Lopez,\s*Teacher,\s*Dancer/);
  });
});

describe('small helpers', () => {
  it('initialsOf', () => {
    expect(initialsOf('Ana Lopez')).toBe('AL');
    expect(initialsOf('Sobolewska')).toBe('S');
    expect(initialsOf('')).toBe('?');
  });
  it('wallDateLabel: Fri 23, hidden when past, empty or garbage', () => {
    expect(wallDateLabel('2099-10-23')).toBe('Fri 23');
    expect(wallDateLabel('2099-10-23T19:00:00+00')).toBe('Fri 23');
    expect(wallDateLabel('2020-10-23')).toBeNull();
    expect(wallDateLabel(null)).toBeNull();
    expect(wallDateLabel('soon')).toBeNull();
    expect(wallDateLabel('2026-10-23', '2026-10-23')).toBe('Fri 23'); // today still shows
  });
});

describe('fix pass (review R1): no role data, no role filters', () => {
  it('/dancers with the badges read ok but EMPTY: everyone shows, only All (a Dancers chip would empty the wall)', () => {
    mountDancers([DN('a'), DN('b')], { a: 'Ana', b: 'Bo' });
    expect(screen.getAllByTestId('wall-tile')).toHaveLength(2);
    expect(screen.queryAllByTestId('wall-filter')).toHaveLength(0);
  });
});
