// @vitest-environment jsdom
/**
 * Slice 1a (organiser area v2): the role strip and Switch badge, every person type x cell.
 * One mapping (model/strip.ts) drives the strip, the switcher and these rows.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { caughtUp, home, page, series, twoTodos } from './fixtures.strip';
import type { OrganiserHome } from '@/modules/organiser/shared/selfServeApi';

const rpc = vi.hoisted(() => vi.fn());
const data = vi.hoisted(() => ({ home: null as unknown, roles: [] as unknown }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc, from: vi.fn() } }));
vi.mock('@/hooks/useAuth', async () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'me@x.example' }, session: null }),
  ProfileGateContext: (await import('react')).createContext(null),
}));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('../../screens/HomeScreen', () => ({ HomeScreen: () => <div data-testid="p3-screen-home" /> }));
vi.mock('../../screens/EventsScreen', () => ({ EventsScreen: () => <div data-testid="p3-screen-events" /> }));
vi.mock('../../screens/StatsScreen', () => ({ StatsScreen: () => <div data-testid="p3-screen-stats" /> }));
vi.mock('../../you/YouScreen', () => ({ YouScreen: () => <div data-testid="p3-screen-you" /> }));

import P3Routes from '../P3Routes';
import { P3_BASE, P3_PATHS } from '../paths';
import { otherPagesOf, roleWordOf, stripOf, switchBadgeOf, todosOf } from '../../model/strip';

beforeEach(() => {
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'organiser_home_v1') return { data: data.home, error: null };
    if (fn === 'my_roles_v1') return { data: data.roles, error: null };
    return { data: [], error: null };
  });
  try { window.localStorage.clear(); } catch { /* none */ }
});
afterEach(cleanup);

// ---- the shared mapping, table-driven ----
const A = 'a';
const cases: Array<[string, OrganiserHome, string | null, { role: string | null; page: string | null; badge: number }]> = [
  ['P1 owner, 1 page, own to-dos', home(page(A, 'Ritmo', 'owner', [twoTodos()])), A, { role: 'Owner', page: 'Ritmo', badge: 0 }],
  ['P1 owner, 0 events', home(page(A, 'Ritmo', 'owner')), A, { role: 'Owner', page: 'Ritmo', badge: 0 }],
  ['P2 two pages, the other has 2 to-dos', home(page(A, 'Ritmo', 'owner', [twoTodos()]), page('b', 'Latino', 'owner', [twoTodos(), caughtUp()])), A, { role: 'Owner', page: 'Ritmo', badge: 2 }],
  ['P2 three pages, to-dos on one other page only', home(page(A, 'Ritmo', 'owner'), page('b', 'Latino', 'owner', [caughtUp()]), page('c', 'Sabor', 'manager', [series({ cover: false })])), A, { role: 'Owner', page: 'Ritmo', badge: 1 }],
  ['P2 the other page is paused with many events, all caught up', home(page(A, 'Ritmo', 'owner'), page('b', 'Latino', 'owner', [caughtUp(), caughtUp(), caughtUp()], 'paused')), A, { role: 'Owner', page: 'Ritmo', badge: 0 }],
  ['P4 manager', home(page(A, 'Ritmo', 'manager', [caughtUp()])), A, { role: 'Manager', page: 'Ritmo', badge: 0 }],
  ['P7 caught up on every page', home(page(A, 'Ritmo', 'owner', [caughtUp()]), page('b', 'Latino', 'owner', [caughtUp()])), A, { role: 'Owner', page: 'Ritmo', badge: 0 }],
  ['P13 door + manager: Manager for that page only', home(page(A, 'Ritmo', 'manager'), page('b', 'Latino', 'owner')), A, { role: 'Manager', page: 'Ritmo', badge: 0 }],
  ['P5 claim pending / P12 interim seat / P14 no organiser page', home(), null, { role: null, page: null, badge: 0 }],
  ['E15 the other page has only cancelled dates: no badge', home(page(A, 'Ritmo', 'owner'), page('b', 'Latino', 'owner', [series({ upcoming: 0, cancelled: 2, format: 'recurring' })])), A, { role: 'Owner', page: 'Ritmo', badge: 0 }],
  ['E15 a cancelled event: no badge', home(page(A, 'Ritmo', 'owner'), page('b', 'Latino', 'owner', [series({ lifecycle: 'cancelled', cover: false })])), A, { role: 'Owner', page: 'Ritmo', badge: 0 }],
];

describe('strip mapping (model/strip.ts)', () => {
  it.each(cases)('%s', (_name, h, openId, want) => {
    const open = h.organisers.find((o) => o.id === openId) ?? null;
    const strip = stripOf(open);
    expect(strip?.roleWord ?? null).toBe(want.role);
    expect(strip?.page ?? null).toBe(want.page);
    expect(switchBadgeOf(h, openId)).toBe(want.badge);
  });

  it('the open page never counts toward its own badge', () => {
    const h = home(page(A, 'Ritmo', 'owner', [twoTodos()]), page('b', 'Latino', 'owner'));
    expect(todosOf(h, A)).toBe(2);
    expect(switchBadgeOf(h, A)).toBe(0);
    expect(switchBadgeOf(h, 'b')).toBe(2);
  });

  it('role word is Owner or Manager only: no contributor word', () => {
    expect(roleWordOf('owner')).toBe('Owner');
    expect(roleWordOf('manager')).toBe('Manager');
    expect(roleWordOf('contributor')).toBeNull();
    expect(stripOf(page(A, 'Ritmo', 'contributor'))).toBeNull();
  });

  it('other pages: teacher, DJ, dancer from active my_roles_v1 rows; organiser never listed here', () => {
    expect(otherPagesOf([{ role: 'dancer', active: true }, { role: 'organiser', active: true }, { role: 'dj', active: true }, { role: 'teacher', active: true }])).toEqual(['teacher', 'dj', 'dancer']);
    expect(otherPagesOf([{ role: 'teacher', active: false }])).toEqual([]);
    expect(otherPagesOf(undefined)).toEqual([]);
  });
});

// ---- rendered: the strip on every P3 screen ----
function at(entry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes><Route path={`${P3_BASE}/*`} element={<P3Routes />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const SCREENS = [P3_PATHS.home, P3_PATHS.events, P3_PATHS.stats, P3_PATHS.you, P3_PATHS.youSwitch];

describe('the strip on every P3 screen (journeys 1-3)', () => {
  it.each(SCREENS)('%s: names the role and the page; Switch is a 44px link to Switch page', async (path) => {
    data.home = home(page(A, 'Ritmo', 'owner', [twoTodos()]), page('b', 'Latino', 'manager', [series({ cover: false })]));
    at(`${path}?o=${A}`);
    const strip = await screen.findByTestId('p3-role-strip');
    expect(strip.dataset.role).toBe('owner');
    expect(screen.getByTestId('p3-role-strip-role').textContent).toBe('Owner');
    expect(screen.getByTestId('p3-role-strip-page').textContent).toBe('Ritmo');
    const sw = screen.getByTestId('p3-switch-control');
    expect(sw.getAttribute('href')).toBe(`${P3_PATHS.youSwitch}?o=${A}`);
    expect(sw.className).toContain('min-h-[44px]');
    // Latino (the other page) has 1 to-do; Ritmo's own 2 never count.
    expect(within(strip, 'switch-todo-badge')).toBe('1');
  });

  it('a manager sees Manager', async () => {
    data.home = home(page(A, 'Ritmo', 'manager'));
    at(P3_PATHS.home);
    expect((await screen.findByTestId('p3-role-strip-role')).textContent).toBe('Manager');
    expect(screen.queryByTestId('switch-todo-badge')).toBeNull();
  });

  it('no organiser page (P5, P12, P14): no strip and no badge', async () => {
    data.home = home();
    at(P3_PATHS.events);
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('organiser_home_v1'));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId('p3-role-strip')).toBeNull();
    expect(screen.queryByTestId('switch-todo-badge')).toBeNull();
  });
});

function within(root: HTMLElement, id: string): string | null {
  return root.querySelector(`[data-testid="${id}"]`)?.textContent ?? null;
}
