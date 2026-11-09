// @vitest-environment jsdom
/**
 * Slice 1c (organiser area v2): the Switch page's "Add a profile" card. One shared mapping (missingRoles) from the
 * roles a person holds to the rows shown; every cell below is one test. Shapes come from the prod survey of
 * my_roles_v1 combinations (2026-11-09, counts only): dancer only, dancer+organiser, all four, organiser only, etc.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { home, page } from '@/modules/organiser/p3/shell/__tests__/fixtures.strip';

const rpc = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ user: { id: 'u1', email: 'me@x.example' } as { id: string; email: string } | null }));
const data = vi.hoisted(() => ({ home: null as unknown, roles: [] as unknown, requests: [] as unknown, steps: [] as unknown[] }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc, from: vi.fn() } }));
vi.mock('@/hooks/useAuth', async () => ({
  useAuth: () => ({ user: auth.user, session: null }),
  ProfileGateContext: (await import('react')).createContext(null),
}));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/modules/organiser/p3/screens/HomeScreen', () => ({ HomeScreen: () => <div data-testid="p3-screen-home" /> }));

import P3Routes from '@/modules/organiser/p3/shell/P3Routes';
import { P3_BASE, P3_PATHS } from '@/modules/organiser/p3/shell/paths';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { APP_WELCOME_PATH } from '@/lib/accountRouting';
import { AREA_PATHS } from '@/lib/areaPaths';
import SwitchPage from '../index';
import {
  ADD_BENEFIT, ADD_LABEL, HIDDEN_TOAST, HIDDEN_TOAST_SESSION, addProfileHiddenKey, addProfileTarget, heldRolesOf, missingRoles, type AddRole,
} from '../addProfileModel';

beforeEach(() => {
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'organiser_home_v1') return { data: data.home, error: null };
    if (fn === 'my_roles_v1') return { data: data.roles, error: null };
    if (fn === 'list_organiser_access_requests_v1') return { data: data.requests, error: null };
    if (fn === 'my_profile_progress_v1') return { data: { percent: 0, required_left: 0, publish_ready: false, steps: data.steps, declined: [] }, error: null };
    return { data: [], error: null };
  });
  auth.user = { id: 'u1', email: 'me@x.example' };
  data.home = home(page('a', 'Ritmo', 'owner'));
  data.roles = [];
  data.requests = [];
  data.steps = [];
  try { window.localStorage.clear(); } catch { /* none */ }
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Where() {
  const l = useLocation();
  return <div data-testid="landed">{l.pathname + l.search}</div>;
}

function mount(entry: string = `${P3_PATHS.youSwitch}?o=a`) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path={`${P3_BASE}/*`} element={<><P3Routes /><Where /></>} />
          <Route path={ORG_PATHS.switch} element={<SwitchPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const r = (role: string, active = true, complete = true) => ({ role, active, complete });
const ALL = ['organiser', 'teacher', 'dj', 'dancer'] as const;
const rowsShown = () => screen.queryAllByTestId(/^add-profile-row-/).map((a) => a.dataset.testid!.replace('add-profile-row-', ''));

// Person type x missing-role shape. Organiser held = an organiser page in organiser_home_v1 (or a pending claim).
const PEOPLE: Array<[string, unknown[], number, AddRole[]]> = [
  ['Dancer only', [r('dancer'), r('organiser', false), r('teacher', false), r('dj', false)], 0, ['organiser', 'teacher', 'dj']],
  ['Dancer + teacher', [r('dancer'), r('organiser', false), r('teacher'), r('dj', false)], 0, ['organiser', 'dj']],
  ['Teacher + DJ (dancer not finished)', [r('dancer', true, false), r('organiser', false), r('teacher'), r('dj')], 0, ['organiser', 'dancer']],
  ['Organiser only', [r('dancer', false, false), r('organiser'), r('teacher', false), r('dj', false)], 1, ['teacher', 'dj', 'dancer']],
  ['Dancer + organiser (prod: 6 accounts)', [r('dancer'), r('organiser'), r('teacher', false), r('dj', false)], 1, ['teacher', 'dj']],
];

describe('missingRoles: the one mapping', () => {
  it.each(PEOPLE)('%s', (_n, rows, pages, want) => {
    expect(missingRoles(heldRolesOf({ rows: rows as never, organiserPages: pages }))).toEqual(want);
  });
  it('All roles: nothing missing', () => {
    expect(missingRoles(ALL)).toEqual([]);
  });
  it('a pending organiser claim counts as held (P5)', () => {
    expect(missingRoles(heldRolesOf({ rows: [r('dancer')] as never, pendingOrganiserClaim: true }))).toEqual(['teacher', 'dj']);
  });
  it('a teacher chosen at sign-up and not yet saved counts as added (isAreaShown)', () => {
    const progress = { steps: [{ area: 'teacher' as const, field: 'bio', required: false, done: false }] };
    expect(missingRoles(heldRolesOf({ rows: [r('dancer'), r('organiser')] as never, progress }))).toEqual(['dj']);
  });
});

describe('Switch page card: person types', () => {
  it.each(PEOPLE)('%s: rows and benefit lines exact', async (_n, rows, pages, want) => {
    data.home = pages ? home(page('a', 'Ritmo', 'owner')) : home();
    data.roles = rows;
    mount();
    await waitFor(() => expect(screen.getByTestId('add-profile-card')).toBeTruthy());
    expect(rowsShown()).toEqual(want);
    for (const role of want) {
      const row = screen.getByTestId(`add-profile-row-${role}`);
      expect(row.textContent).toBe(`${ADD_LABEL[role]}${ADD_BENEFIT[role]}`);
    }
    expect(ADD_BENEFIT.organiser).toBe('Get paid for tickets');
    expect(ADD_BENEFIT.teacher).toBe('Be found by students');
    expect(ADD_BENEFIT.dj).toBe('Get booked as a DJ');
    expect(screen.getByTestId('add-profile-not-now')).toBeTruthy();
  });

  it('All roles: no card, no Not now, no toast', async () => {
    data.roles = ALL.map((x) => r(x));
    mount();
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('my_profile_progress_v1', { p_organiser_id: null }));
    await waitFor(() => expect(screen.getAllByTestId('switch-row')).toHaveLength(1));
    await act(async () => { await new Promise((res) => setTimeout(res, 20)); });
    expect(screen.queryByTestId('add-profile-card')).toBeNull();
    expect(screen.queryByTestId('add-profile-not-now')).toBeNull();
    expect(screen.queryByTestId('add-profile-undo')).toBeNull();
  });

  it('a pending organiser claim: no Organiser row (the claim screen owns it)', async () => {
    data.home = home();
    data.roles = [r('dancer')];
    data.requests = [{ request_id: 'q1', organiser_id: 'o9', organiser_name: 'X', status: 'open', created_at: '2026-11-01', resolved_at: null }];
    mount();
    await waitFor(() => expect(screen.getByTestId('add-profile-card')).toBeTruthy());
    expect(rowsShown()).toEqual(['teacher', 'dj']);
  });

  it('my_roles_v1 fails: no card (never offers a role the person may hold)', async () => {
    rpc.mockImplementation(async (fn: string) => (fn === 'my_roles_v1' ? { data: null, error: { message: 'boom' } } : fn === 'organiser_home_v1' ? { data: data.home, error: null } : { data: [], error: null }));
    mount();
    await waitFor(() => expect(screen.getAllByTestId('switch-row')).toHaveLength(1));
    await act(async () => { await new Promise((res) => setTimeout(res, 20)); });
    expect(screen.queryByTestId('add-profile-card')).toBeNull();
  });
});

describe('Behaviour cells', () => {
  const TARGETS: Array<[AddRole, string]> = [
    ['organiser', P3_PATHS.youAdd],
    ['teacher', AREA_PATHS.teacher],
    ['dj', AREA_PATHS.dj],
    ['dancer', APP_WELCOME_PATH],
  ];
  it.each(TARGETS)('1. %s row opens the existing entry %s', async (role, path) => {
    expect(addProfileTarget(role, P3_PATHS.youAdd)).toBe(path);
    data.home = home();
    data.roles = [r('dancer', true, false)];
    mount();
    await waitFor(() => expect(screen.getByTestId(`add-profile-row-${role}`)).toBeTruthy());
    fireEvent.click(screen.getByTestId(`add-profile-row-${role}`));
    await waitFor(() => expect(screen.getByTestId('landed').textContent).toBe(path));
  });

  it('P6 unfinished dancer: Dancer offered, tap goes to the dancer setup, not a second profile', async () => {
    data.roles = [r('dancer', true, false), r('organiser')];
    mount();
    await waitFor(() => expect(screen.getByTestId('add-profile-row-dancer')).toBeTruthy());
    expect(screen.getByTestId('add-profile-row-dancer').getAttribute('href')).toBe(APP_WELCOME_PATH);
  });

  it('2. Not now hides the card and shows the toast; Undo restores; reload keeps it hidden; another user still sees it', async () => {
    data.roles = [r('dancer'), r('organiser')];
    const first = mount();
    await waitFor(() => expect(screen.getByTestId('add-profile-card')).toBeTruthy());
    fireEvent.click(screen.getByTestId('add-profile-not-now'));
    expect(screen.queryByTestId('add-profile-card')).toBeNull();
    const toast = screen.getByTestId('add-profile-undo');
    expect(toast.textContent).toContain(HIDDEN_TOAST);
    expect(toast.parentElement).toBe(document.body);
    expect(window.localStorage.getItem(addProfileHiddenKey('u1'))).toBe('1');
    fireEvent.click(screen.getByTestId('add-profile-undo-button'));
    expect(screen.getByTestId('add-profile-card')).toBeTruthy();
    expect(screen.queryByTestId('add-profile-undo')).toBeNull();
    expect(window.localStorage.getItem(addProfileHiddenKey('u1'))).toBeNull();
    // Hide again, then "reload".
    fireEvent.click(screen.getByTestId('add-profile-not-now'));
    first.unmount();
    mount();
    await waitFor(() => expect(screen.getAllByTestId('switch-row')).toHaveLength(1));
    await act(async () => { await new Promise((res) => setTimeout(res, 20)); });
    expect(screen.queryByTestId('add-profile-card')).toBeNull();
    cleanup();
    // Another person on the same browser.
    auth.user = { id: 'u2', email: 'other@x.example' };
    mount();
    await waitFor(() => expect(screen.getByTestId('add-profile-card')).toBeTruthy());
  });

  it('3. localStorage throws: card renders, Not now works for this visit, no crash, toast does not promise to remember', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    data.roles = [r('dancer'), r('organiser')];
    mount();
    await waitFor(() => expect(screen.getByTestId('add-profile-card')).toBeTruthy());
    fireEvent.click(screen.getByTestId('add-profile-not-now'));
    expect(screen.queryByTestId('add-profile-card')).toBeNull();
    expect(screen.getByTestId('add-profile-undo').textContent).toContain(HIDDEN_TOAST_SESSION);
  });

  it('4. Flag off (R1 Switch): no card for any person type', async () => {
    data.roles = [r('dancer')];
    mount(ORG_PATHS.switch);
    await waitFor(() => expect(screen.getAllByTestId('switch-row')).toHaveLength(1));
    await act(async () => { await new Promise((res) => setTimeout(res, 20)); });
    expect(screen.queryByTestId('add-profile-card')).toBeNull();
    expect(rpc).not.toHaveBeenCalledWith('my_roles_v1', undefined);
  });

  it('5. Signed-out visitor: no card', async () => {
    auth.user = null;
    data.roles = [r('dancer')];
    mount();
    await act(async () => { await new Promise((res) => setTimeout(res, 20)); });
    expect(screen.queryByTestId('add-profile-card')).toBeNull();
  });

  it('6. the card is the last block on the Switch page, with 56 px rows, 44 px Not now and no fixed widths', async () => {
    data.roles = [r('dancer')];
    mount();
    await waitFor(() => expect(screen.getByTestId('add-profile-card')).toBeTruthy());
    const card = screen.getByTestId('add-profile-card');
    expect(card.nextElementSibling).toBeNull();
    for (const a of card.querySelectorAll('a')) expect(a.className).toContain('min-h-[56px]');
    expect(screen.getByTestId('add-profile-not-now').className).toContain('min-h-[44px]');
    expect(card.outerHTML).not.toMatch(/\bw-\[\d{3,}px\]/);
  });
});
