// @vitest-environment jsdom
/**
 * Slice 1a (organiser area v2): Switch page lists every page the person holds
 * (organiser pages from organiser_home_v1, teacher / DJ / dancer from my_roles_v1);
 * only OTHER organiser pages carry a to-do badge. R1's Switch (flag off) is unchanged.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { caughtUp, home, page, series, twoTodos } from '@/modules/organiser/p3/shell/__tests__/fixtures.strip';

const rpc = vi.hoisted(() => vi.fn());
const data = vi.hoisted(() => ({ home: null as unknown, roles: [] as unknown }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc, from: vi.fn() } }));
vi.mock('@/hooks/useAuth', async () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'me@x.example' }, session: null }),
  ProfileGateContext: (await import('react')).createContext(null),
}));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/modules/organiser/p3/screens/HomeScreen', () => ({ HomeScreen: () => <div data-testid="p3-screen-home" /> }));

import P3Routes from '@/modules/organiser/p3/shell/P3Routes';
import { P3_BASE, P3_PATHS } from '@/modules/organiser/p3/shell/paths';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import SwitchPage from '../index';

beforeEach(() => {
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'organiser_home_v1') return { data: data.home, error: null };
    if (fn === 'my_roles_v1') return { data: data.roles, error: null };
    return { data: [], error: null };
  });
  data.roles = [];
  try { window.localStorage.clear(); } catch { /* none */ }
});
afterEach(cleanup);

function mount(entry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path={`${P3_BASE}/*`} element={<P3Routes />} />
          <Route path={ORG_PATHS.switch} element={<SwitchPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const role = (r: string, active = true) => ({ role: r, active, complete: true });
const rowBadges = () => screen.getAllByTestId('switch-row').map((r) => r.querySelector('[data-testid="switch-todo-badge"]')?.textContent ?? null);

type Want = { rows: string[]; badges: (string | null)[]; areas: string[] };
const cases: Array<[string, ReturnType<typeof home>, unknown[], Want]> = [
  ['P1 owner, 1 page: one row, no badge', home(page('a', 'Ritmo', 'owner', [twoTodos()])), [role('organiser')], { rows: ['Ritmo'], badges: [null], areas: [] }],
  ['P2 two pages: both listed, badge on the other page only', home(page('a', 'Ritmo', 'owner', [twoTodos()]), page('b', 'Latino', 'owner', [twoTodos()])), [role('organiser')], { rows: ['Ritmo', 'Latino'], badges: [null, '2'], areas: [] }],
  ['P2 a page with no to-dos shows no badge', home(page('a', 'Ritmo', 'owner'), page('b', 'Latino', 'manager', [caughtUp()]), page('c', 'Sabor', 'owner', [series({ cover: false })])), [], { rows: ['Ritmo', 'Latino', 'Sabor'], badges: [null, null, '1'], areas: [] }],
  ['P3 organiser + teacher + DJ + dancer: all listed, badge on organiser pages only', home(page('a', 'Ritmo', 'owner'), page('b', 'Latino', 'owner', [twoTodos()])), [role('organiser'), role('teacher'), role('dj'), role('dancer')], { rows: ['Ritmo', 'Latino'], badges: [null, '2'], areas: ['teacher', 'dj', 'dancer'] }],
  ['P7 caught up: no badge anywhere', home(page('a', 'Ritmo', 'owner', [caughtUp()]), page('b', 'Latino', 'owner', [caughtUp()])), [], { rows: ['Ritmo', 'Latino'], badges: [null, null], areas: [] }],
  ['E15 a cancelled event on the other page: no badge', home(page('a', 'Ritmo', 'owner'), page('b', 'Latino', 'owner', [series({ upcoming: 0, cancelled: 3, format: 'recurring' })])), [], { rows: ['Ritmo', 'Latino'], badges: [null, null], areas: [] }],
];

describe('P3 Switch page: every page the person holds (slice 1a)', () => {
  it.each(cases)('%s', async (_n, h, roles, want) => {
    data.home = h;
    data.roles = roles;
    mount(`${P3_PATHS.youSwitch}?o=a`);
    await waitFor(() => expect(screen.getAllByTestId('switch-row')).toHaveLength(want.rows.length));
    expect(screen.getAllByTestId('switch-row').map((r) => r.querySelector('.truncate')?.textContent)).toEqual(want.rows);
    expect(rowBadges()).toEqual(want.badges);
    if (want.areas.length) {
      await waitFor(() => expect(screen.getByTestId('switch-other-pages')).toBeTruthy());
      const links = [...screen.getByTestId('switch-other-pages').querySelectorAll('a')];
      expect(links.map((a) => a.dataset.testid)).toEqual(want.areas.map((r) => `switch-area-${r}`));
      // teacher, DJ and dancer entries never carry a badge
      expect(screen.getByTestId('switch-other-pages').querySelector('[data-testid="switch-todo-badge"]')).toBeNull();
    } else {
      await waitFor(() => expect(rpc).toHaveBeenCalledWith('my_roles_v1', undefined));
      expect(screen.queryByTestId('switch-other-pages')).toBeNull();
    }
  });

  it('P14 teacher / DJ / dancer with no organiser page: their pages listed, no strip, no badge', async () => {
    data.home = home();
    data.roles = [role('teacher'), role('dj'), role('dancer'), role('organiser', false)];
    mount(P3_PATHS.youSwitch);
    await waitFor(() => expect(screen.getByTestId('switch-other-pages')).toBeTruthy());
    expect(screen.queryAllByTestId('switch-row')).toHaveLength(0);
    expect(screen.queryByTestId('p3-role-strip')).toBeNull();
    expect(screen.queryByTestId('switch-todo-badge')).toBeNull();
  });

  it('P4 manager row reads Manager; no contributor word', async () => {
    data.home = home(page('a', 'Ritmo', 'manager'), page('b', 'Odd', 'contributor'));
    mount(`${P3_PATHS.youSwitch}?o=a`);
    await waitFor(() => expect(screen.getAllByTestId('switch-row')).toHaveLength(2));
    const text = screen.getByTestId('switch-list').textContent ?? '';
    expect(text).toContain('Manager');
    expect(text.toLowerCase()).not.toContain('contributor');
  });
});

describe('flag off: R1 Switch page is unchanged (A8)', () => {
  it('no badge and no other pages on /account/o/switch, whatever the person holds', async () => {
    data.home = home(page('a', 'Ritmo', 'owner'), page('b', 'Latino', 'owner', [twoTodos()]));
    data.roles = [role('teacher'), role('dj'), role('dancer')];
    mount(ORG_PATHS.switch);
    await waitFor(() => expect(screen.getAllByTestId('switch-row')).toHaveLength(2));
    expect(screen.queryByTestId('switch-todo-badge')).toBeNull();
    expect(screen.queryByTestId('switch-other-pages')).toBeNull();
    expect(screen.queryByTestId('p3-role-strip')).toBeNull();
    expect(rpc).not.toHaveBeenCalledWith('my_roles_v1', undefined);
  });
});
