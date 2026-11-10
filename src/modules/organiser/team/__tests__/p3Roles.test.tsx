// @vitest-environment jsdom
/**
 * Organiser area v2 slice 1b FIX (PR #1511 review). While P3 is live:
 *  - the Team person screen and the Team tab never say "contributor"; the Team tab lists the roles
 *    from TEAM_ROLES (Owner, Manager, Door), Door disabled with its reason;
 *  - the Team roles in the edit-in-place picker follow the flag PAIR (organiserP3 AND organiserSelfServe),
 *    so organiserP3 on + organiserSelfServe off = today's picker;
 *  - Account / Help / Sign out are reachable from every P3 screen (one entry on the role strip).
 * Team shapes match prod (2026-11-09: organiser seats 20 owner / 43 manager / 0 contributor).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, RouterProvider, Routes, createMemoryRouter } from 'react-router-dom';
import { useState, type ReactNode } from 'react';
import type { ProfileEntity } from '@/modules/organiser/profile/profileForm';
import type { TeamMember, TeamRole } from '@/modules/organiser/shared/teamModel';

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  home: vi.fn(),
  fl: { organiserP3: true, organiserSelfServe: true } as Record<string, boolean>,
}));
vi.mock('@/lib/featureFlags', async (orig) => {
  const actual = await orig<{ flags: Record<string, unknown> }>();
  return { ...actual, flags: new Proxy(actual.flags, { get: (t, k: string) => (k in h.fl ? h.fl[k] : t[k]) }) };
});
vi.mock('@/integrations/supabase/client', () => {
  const q = { select: () => q, eq: () => q, limit: async () => ({ data: [{ id: 'x' }], error: null }) };
  return { supabase: { rpc: (...a: unknown[]) => h.rpc(...a), from: () => q, auth: {} } };
});
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me', email: 'me@x.example' }, signOut: vi.fn() }) }));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/modules/organiser/shared/selfServeApi', async () => ({ ...(await vi.importActual<object>('@/modules/organiser/shared/selfServeApi')), fetchOrganiserHome: h.home }));
vi.mock('@/components/account/profiles/signOutToHome', () => ({
  SIGN_OUT_FAILED: 'Could not sign you out.',
  useSignOutToHome: () => ({ signOutToHome: async () => 'signed-out', busy: false }),
}));
vi.mock('../../p3/screens/HomeScreen', () => ({ HomeScreen: () => <div data-testid="stub-home" /> }));
vi.mock('../../p3/screens/EventsScreen', () => ({ EventsScreen: () => <div data-testid="stub-events" /> }));
vi.mock('../../p3/screens/StatsScreen', () => ({ StatsScreen: () => <div data-testid="stub-stats" /> }));

import P3Routes from '../../p3/shell/P3Routes';
import { P3_BASE, P3_PATHS } from '../../p3/shell/paths';
import { DOOR_NOT_OPEN, P3_ROLE_HELP, TEAM_ROLES, p3RolesLive } from '../../edit-in-place/teamRoles';
import EditInPlaceLayer from '../../edit-in-place/EditInPlaceLayer';
import type { EipBridge } from '../../edit-in-place/bridge';
import { PICKER_COPY } from '../../edit-in-place/teamPickerModel';
import { ROLE_EXPLAINER, personExplainer } from '../Person';

type Role = 'owner' | 'manager';
const page = (role: Role) => ({ id: 'org-1', name: 'Ritmo', slug: 'ritmo', avatar_url: null, city_id: null, lifecycle_status: 'live', role, latest_decision: null, series: [], team: [] });
const row = (id: string, r: Role, extra: Record<string, unknown> = {}) => ({ user_id: id, member_role: r, is_primary: r === 'owner', is_self: false, email: `${id}@x.example`, display_name: id, ...extra });

let viewer: Role = 'owner';
let pages = 1;
function install() {
  h.home.mockReset().mockImplementation(async () => ({ today: '2026-11-09', organisers: Array.from({ length: pages }, () => page(viewer)) }));
  h.rpc.mockReset().mockImplementation(async (fn: string) => {
    if (fn === 'organiser_team_v1') {
      const me = row('me', viewer, { is_self: true, display_name: 'Me' });
      const other = viewer === 'owner' ? row('u-other', 'manager', { display_name: 'Mia Manager' }) : row('u-other', 'owner', { display_name: 'Olu Owner' });
      return { data: { my_role: viewer, members: [me, other] }, error: null };
    }
    if (fn === 'list_organiser_access_requests_v1') return { data: [], error: null };
    return { data: null, error: null };
  });
}
function at(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes><Route path={`${P3_BASE}/*`} element={<P3Routes />} /></Routes></MemoryRouter></QueryClientProvider>);
}
const CONTRIBUTOR = /contributor/i;

beforeEach(() => { window.localStorage.clear(); h.fl.organiserP3 = true; h.fl.organiserSelfServe = true; pages = 1; });
afterEach(cleanup);

describe('P3 Team screens never say contributor (owner and manager viewers, prod shapes)', () => {
  it.each(['owner', 'manager'] as const)('Team tab, %s: roles listed from TEAM_ROLES, Door disabled with its reason', async (r) => {
    viewer = r; install();
    at(P3_PATHS.youTeam);
    const card = await screen.findByTestId('p3-team-roles');
    await screen.findAllByTestId('team-member');
    expect(TEAM_ROLES.map((x) => x.label)).toEqual(['Owner', 'Manager', 'Door']);
    for (const x of TEAM_ROLES) expect(within(card).getByTestId(`p3-team-role-${x.key}`).textContent).toContain(x.label);
    const door = within(card).getByTestId('p3-team-role-door');
    expect(door.getAttribute('aria-disabled')).toBe('true');
    expect(within(card).getByTestId('p3-team-role-door-why').textContent).toBe(DOOR_NOT_OPEN);
    expect(within(card).getByTestId('p3-team-role-manager').getAttribute('aria-disabled')).toBeNull();
    expect(screen.getByTestId('org-page-team').textContent).not.toMatch(CONTRIBUTOR);
  });

  it.each(['owner', 'manager'] as const)('Person screen, %s: the explainer is built from TEAM_ROLES', async (r) => {
    viewer = r; install();
    at(P3_PATHS.youTeamPerson('u-other'));
    const explainer = await screen.findByTestId('person-explainer');
    expect(explainer.textContent).toBe(P3_ROLE_HELP);
    for (const x of TEAM_ROLES) expect(explainer.textContent).toContain(x.label);
    expect(screen.getByTestId('org-page-team-person').textContent).not.toMatch(CONTRIBUTOR);
  });

  it('R1 keeps its own explainer (unchanged off P3)', () => {
    expect(personExplainer('r1')).toBe(ROLE_EXPLAINER);
    expect(personExplainer('p3')).toBe(P3_ROLE_HELP);
    expect(P3_ROLE_HELP).not.toMatch(CONTRIBUTOR);
  });
});

describe('the Team roles follow the flag PAIR (AnimatedRoutes p3Live)', () => {
  it.each([
    [true, true, true],
    [true, false, false],
    [false, true, false],
    [false, false, false],
  ] as const)('organiserP3=%s organiserSelfServe=%s -> P3 roles %s', (p3, ss, want) => {
    expect(p3RolesLive({ organiserP3: p3, organiserSelfServe: ss })).toBe(want);
  });

  const ID = '22222222-2222-4222-8222-222222222222';
  const ENTITY = { id: ID, name: 'Ritmo Latino', avatar_url: null, bio: 'Hi', socials: {}, city_id: null, instagram: null, website: null, organisation_category: null, founded_year: null, cities: null } as unknown as ProfileEntity;
  const m = (userId: string, role: TeamRole, isSelf = false): TeamMember => ({ userId, role, isPrimary: role === 'owner', joinedAt: null, isSelf, email: null, displayName: null });
  const mountLayer = () => {
    function Harness() {
      const [eip, setEip] = useState<EipBridge | null>(null);
      return (
        <div>
          <div data-testid="team-slot">{eip?.slot('team')}</div>
          {/* No p3Roles prop: the layer's own default (the flags) decides. */}
          <EditInPlaceLayer
            organiserId={ID}
            entity={ENTITY}
            onBridge={setEip}
            client={{ rpc: vi.fn() } as never}
            fetchContact={async () => ({ contact_phone: null, contact_email: null, show_phone_publicly: false, show_email_publicly: false, claim_email: null }) as never}
            fetchTeam={async () => ({ myRole: 'owner', members: [m('u1', 'owner', true), m('u2', 'manager')] })}
            searchPeople={async () => []}
            addPerson={async () => ({ changed: true })}
          />
        </div>
      );
    }
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const router = createMemoryRouter([{ path: '/o', element: <Harness /> }], { initialEntries: ['/o'] });
    render(<QueryClientProvider client={qc}><RouterProvider router={router} /></QueryClientProvider>);
  };
  const openSheet = async () => {
    fireEvent.click(await screen.findByRole('button', { name: PICKER_COPY.title }));
    return screen.findByRole('dialog', { name: PICKER_COPY.title });
  };

  it('organiserP3 on + organiserSelfServe off = today’s picker (Contributor offered, no Door)', async () => {
    h.fl.organiserP3 = true; h.fl.organiserSelfServe = false;
    mountLayer();
    const dialog = await openSheet();
    expect(within(dialog).getByRole('radio', { name: 'Contributor' })).toBeTruthy();
    expect(within(dialog).queryByTestId('eip-team-role-door')).toBeNull();
  });

  it('both on = the P3 picker (Manager, Door disabled, no Contributor)', async () => {
    mountLayer();
    const dialog = await openSheet();
    expect(within(dialog).queryByRole('radio', { name: 'Contributor' })).toBeNull();
    expect((within(dialog).getByRole('radio', { name: 'Door' }) as HTMLInputElement).disabled).toBe(true);
  });
});

describe('X1: Account / Help / Sign out reachable from every P3 screen', () => {
  const SCREENS: Array<[string, string]> = [
    ['Home', P3_PATHS.home],
    ['Events', P3_PATHS.events],
    ['Stats', P3_PATHS.stats],
    ['You', P3_PATHS.you],
    ['Team', P3_PATHS.youTeam],
    ['Team person', P3_PATHS.youTeamPerson('u-other')],
  ];
  const cases = SCREENS.flatMap(([n, p]) => [[n, p, 1] as const, [n, p, 0] as const]);
  it.each(cases)('%s (pages=%i): one 44px entry opens the sheet with Account settings, Help and Sign out', async (_n, path, p) => {
    viewer = 'owner'; pages = p; install();
    at(path);
    const entry = await screen.findByTestId('p3-account-entry');
    expect(screen.getAllByTestId('p3-account-entry')).toHaveLength(1);
    expect(entry.className).toMatch(/min-h-\[44px\]/);
    expect(entry.className).toMatch(/min-w-\[44px\]/);
    fireEvent.click(entry);
    await waitFor(() => expect(screen.getByTestId('p3-ob-account-block')).toBeTruthy());
    expect(screen.getByTestId('p3-ob-account').getAttribute('href')).toBe('/account/settings');
    expect(screen.getByTestId('p3-ob-help').getAttribute('href')).toMatch(/^mailto:/);
    expect(screen.getByTestId('p3-ob-signout').textContent).toBe('Sign out');
  });
});
