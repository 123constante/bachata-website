// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SHAPES, TODAY, homeOf, statsOf } from './fixtures';
import type { HomeOrganiser, OrganiserHome } from '../../../shared/selfServeApi';
import { rowsOf } from '../../data/home';
import { scopeStats, viewsTotal } from '../../data/stats';

/*
 * F-26 page scope: Home, Events and Stats show the chosen page only, name it, and offer
 * Switch page with 2+ pages. One table: (person, journey, shape) -> page name, rows, switch.
 * Person types P4 (admin), P5 (manager of one, owner of another), P6 (contributor) read the SAME
 * organiser_home_v1 answer and the same choice rule as P1-P3; their role changes what can be
 * edited, never which page's data is read, so they are the P1-P3 rows (cannot differ).
 */

const homeQ = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const viewsQ = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => homeQ.value, useP3Views: () => viewsQ.value }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u-scope' } }) }));
vi.mock('@/modules/going/useMyOrganiserGoingTotal', () => ({ useMyOrganiserGoingTotal: () => ({ view: { state: 'off' }, total: null }) }));
vi.mock('../GraceBanner', () => ({ GraceBanner: () => null }));

import { HomeScreen } from '../HomeScreen';
import { EventsScreen } from '../EventsScreen';
import { StatsScreen } from '../StatsScreen';

const ok = (data: unknown) => ({ isPending: false, isError: false, isFetching: false, data, refetch: vi.fn() });
const LONG = 'Maximiliana Concepcion Rodriguez-Villanueva de la Fuente Bachata Collective';

const page = (id: string, name: string, keys: Array<keyof typeof SHAPES>): HomeOrganiser => ({
  ...homeOf([]).organisers[0], id, name, series: keys.map((k) => SHAPES[k]) as never,
});
/** Zed runs weekly + oneoff; Ritmo runs weekly (shared with Zed) + monthly + course; Empty runs nothing; the long page runs tonight. */
const ZED = page('zed', 'Zed Page', ['weekly', 'oneoff']);
const RITMO = page('ritmo', 'Ritmo Bachata London', ['weekly', 'monthly', 'course']);
const EMPTY = page('empty', 'Empty Page', []);
const BIG = page('big', LONG, ['tonight']);
const home = (...o: HomeOrganiser[]): OrganiserHome => ({ today: TODAY, organisers: o });

const stats = () => statsOf([['weekly', 'Sensual Fridays', 10], ['monthly', 'First Saturdays', 4], ['oneoff', 'Halloween Party', 7], ['tonight', 'Tonight Social', 100]]);

function show(node: JSX.Element, url = '/') {
  return render(<MemoryRouter initialEntries={[url]}>{node}</MemoryRouter>);
}
const rowIds = () => screen.queryAllByTestId('p3-row').map((r) => r.getAttribute('data-id'));

beforeEach(() => { window.localStorage.clear(); viewsQ.value = ok(stats()); });
afterEach(cleanup);

type Case = { who: string; pages: HomeOrganiser[]; url: string; name: string; ids: string[]; switchBtn: boolean };
const CASES: Case[] = [
  { who: 'P1 one page, first visit', pages: [RITMO], url: '/', name: 'Ritmo Bachata London', ids: ['weekly', 'monthly', 'course'], switchBtn: false },
  { who: 'P2 two pages, first visit: first by name', pages: [ZED, RITMO], url: '/', name: 'Ritmo Bachata London', ids: ['weekly', 'monthly', 'course'], switchBtn: true },
  { who: 'P2 two pages, chosen Zed (J7 reload keeps ?o=)', pages: [ZED, RITMO], url: '/?o=zed', name: 'Zed Page', ids: ['weekly', 'oneoff'], switchBtn: true },
  { who: 'P3 three pages, chosen the empty one (0 events)', pages: [ZED, RITMO, EMPTY], url: '/?o=empty', name: 'Empty Page', ids: [], switchBtn: true },
  { who: 'P3 three pages, very long name', pages: [ZED, BIG, EMPTY], url: '/?o=big', name: LONG, ids: ['tonight'], switchBtn: true },
  { who: 'P7/P8 chosen page id no longer in the list: first by name', pages: [ZED, RITMO], url: '/?o=gone', name: 'Ritmo Bachata London', ids: ['weekly', 'monthly', 'course'], switchBtn: true },
];

describe('Events: the chosen page only, named', () => {
  it.each(CASES)('$who', (c) => {
    homeQ.value = ok(home(...c.pages));
    show(<EventsScreen />, c.url);
    expect(screen.getByTestId('p3-page-name').textContent).toBe(c.name);
    expect(!!screen.queryByTestId('p3-page-switch')).toBe(c.switchBtn);
    expect(rowIds().sort()).toEqual([...c.ids].sort());
    if (!c.ids.length) expect(screen.getByTestId('p3-events-empty').textContent).toMatch(/add one now, or switch to another page/);
  });
});

describe('Home: the chosen page only, named', () => {
  it.each(CASES.filter((c) => c.ids.length))('$who', (c) => {
    homeQ.value = ok(home(...c.pages));
    show(<HomeScreen />, c.url);
    expect(screen.getByTestId('p3-page-name').textContent).toBe(c.name);
    expect(!!screen.queryByTestId('p3-page-switch')).toBe(c.switchBtn);
    for (const id of rowIds()) expect(c.ids).toContain(id);
  });
  it('a page with 0 events says what to do and still names the page', () => {
    homeQ.value = ok(home(ZED, EMPTY));
    show(<HomeScreen />, '/?o=empty');
    expect(screen.getByTestId('p3-page-name').textContent).toBe('Empty Page');
    expect(screen.getByTestId('p3-home-empty').textContent).toMatch(/switch to another page/);
  });
});

describe('Stats: one page’s numbers, named', () => {
  it.each([
    ['Ritmo (weekly 10 + monthly 4)', '/?o=ritmo', 14],
    ['Zed (weekly 10 + oneoff 7)', '/?o=zed', 17],
    ['first visit lands on first by name', '/', 14],
  ] as const)('%s', (_n, url, total) => {
    homeQ.value = ok(home(ZED, RITMO));
    show(<StatsScreen />, url);
    expect(screen.getByTestId('p3-page-name')).toBeTruthy();
    expect(screen.getByTestId('p3-stats-total').textContent).toContain(String(total));
    // the 100 views of a page the person is not showing never appear
    expect(screen.getByTestId('p3-stats').textContent).not.toContain('Tonight Social');
  });
  it('scopeStats keeps only the page’s series', () => {
    expect(viewsTotal(scopeStats(stats(), new Set(['tonight'])))).toBe(100);
    expect(viewsTotal(scopeStats(stats(), new Set()))).toBe(0);
  });
  it('home still loading: Loading, not an empty page', () => {
    homeQ.value = { isPending: true, isError: false, data: undefined, refetch: vi.fn() };
    show(<StatsScreen />);
    expect(screen.getByTestId('p3-stats-loading')).toBeTruthy();
  });
  it('home failed: Try again, never blank', () => {
    homeQ.value = { isPending: false, isError: true, data: undefined, refetch: vi.fn() };
    show(<StatsScreen />);
    expect(screen.getByTestId('p3-stats-error')).toBeTruthy();
  });
});

describe('an event run by 2 pages', () => {
  it('appears under each page once, and names the other', () => {
    const h = home(ZED, RITMO);
    const z = rowsOf(h, 'zed');
    const r = rowsOf(h, 'ritmo');
    expect(z.filter((x) => x.id === 'weekly')).toHaveLength(1);
    expect(r.filter((x) => x.id === 'weekly')).toHaveLength(1);
    expect(z.find((x) => x.id === 'weekly')!.alsoRunBy).toEqual(['Ritmo Bachata London']);
    expect(r.find((x) => x.id === 'weekly')!.alsoRunBy).toEqual(['Zed Page']);
    expect(r.find((x) => x.id === 'monthly')!.alsoRunBy).toEqual([]);
  });
  it('the row says so on screen', () => {
    homeQ.value = ok(home(ZED, RITMO));
    show(<EventsScreen />, '/?o=zed');
    expect(screen.getByTestId('p3-also-run-by').textContent).toBe('Also run by Ritmo Bachata London');
  });
});

describe('J4 switch from the same screen', () => {
  it.each([['Events', <EventsScreen key="e" />], ['Home', <HomeScreen key="h" />], ['Stats', <StatsScreen key="s" />]] as const)('%s stays put and shows the other page', (_n, node) => {
    homeQ.value = ok(home(ZED, RITMO));
    show(node, '/?o=zed');
    expect(screen.getByTestId('p3-page-name').textContent).toBe('Zed Page');
    fireEvent.click(screen.getByTestId('p3-page-switch'));
    fireEvent.click(screen.getByTestId('p3-page-pick-ritmo'));
    expect(screen.getByTestId('p3-page-name').textContent).toBe('Ritmo Bachata London');
    expect(screen.queryByTestId('p3-page-list')).toBeNull();
  });
});
