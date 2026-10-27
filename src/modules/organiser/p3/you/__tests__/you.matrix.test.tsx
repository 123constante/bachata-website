// @vitest-environment jsdom
/**
 * P3 W4a consistency matrix: every You-area screen x every shape the prod survey (PR body) and
 * mockup A name. The pushed screens are the R1 screens in P3's frame (their own tests still
 * cover their behaviour); this proves the frame, the links, the hub's rows and the facts the hub
 * and the screens share (role, status, team size, join requests) agree.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({ rpc: vi.fn(), home: vi.fn(), entity: vi.fn(), publicRows: [] as unknown[] }));
vi.mock('@/integrations/supabase/client', () => {
  const q = { select: () => q, eq: () => q, limit: async () => ({ data: h.publicRows, error: null }) };
  return { supabase: { rpc: (...a: unknown[]) => h.rpc(...a), from: () => q, auth: {} } };
});
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me', email: 'me@x.example' }, signOut: vi.fn() }) }));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/modules/organiser/shared/selfServeApi', async () => ({ ...(await vi.importActual<object>('@/modules/organiser/shared/selfServeApi')), fetchOrganiserHome: h.home }));
vi.mock('@/modules/profile/organiserPublicProfile', async () => ({ ...(await vi.importActual<object>('@/modules/profile/organiserPublicProfile')), fetchOwnOrganiserEntity: h.entity }));
// The W1/W2 tabs read their own data (their own matrix); stand-ins here.
vi.mock('../../screens/HomeScreen', () => ({ HomeScreen: () => <div data-testid="p3-screen-home" /> }));
vi.mock('../../screens/EventsScreen', () => ({ EventsScreen: () => <div data-testid="p3-screen-events" /> }));
vi.mock('../../screens/StatsScreen', () => ({ StatsScreen: () => <div data-testid="p3-screen-stats" /> }));

import P3Routes from '../../shell/P3Routes';
import { P3_BASE, P3_PATHS } from '../../shell/paths';
import { ORG_PATHS } from '../../../shell/paths';
import { ADD_ROLE_REASON, ROLE_LABEL, TEAM_CAP, TEAM_FULL_REASON } from '@/modules/organiser/shared/teamModel';
import { INVITE_REQUIRED_COPY } from '@/modules/organiser/shared/selfServeErrors';
import { NO_PROFILE_NOTE } from '../../../team/PublicToggle';
import { YOU, YOU_ROWS, youRows } from '../youRows';

type Role = 'owner' | 'manager' | 'contributor';
const page = (id: string, name: string, role: 'owner' | 'manager', lifecycle = 'live') => ({
  id, name, slug: id, avatar_url: null, city_id: null, lifecycle_status: lifecycle, role, latest_decision: null, series: [], team: [],
});
const member = (user_id: string, member_role: Role, extra: Record<string, unknown> = {}) => ({
  user_id, member_role, is_primary: member_role === 'owner', is_self: false, email: `${user_id}@x.example`, display_name: user_id, ...extra,
});
const ME = (role: Role, extra: Record<string, unknown> = {}) => member('me', role, { is_self: true, display_name: 'Ricky Constante', profile_id: 'pf-me', ...extra });
const others = (n: number) => Array.from({ length: n }, (_, i) => member(`u${i}`, i % 3 ? 'contributor' : 'manager', { display_name: `Person ${i}` }));
const LONG = 'Maximiliana Concepcion Rodriguez-Villanueva de la Fuente';
const REQUEST = { request_id: 'r1', user_id: 'u-req', requester_email: 'nadia@x.example', message: 'I help with the door', created_at: '2026-10-01T10:00:00Z' };
const PROGRESS = (left: number) => ({ percent: left ? 50 : 100, required_left: left, publish_ready: left === 0, steps: [], declined: [] });
const WRITES = ['organiser_team_add_member_by_profile_v1', 'organiser_team_remove_member_v1', 'organiser_team_set_member_v1', 'organiser_transfer_ownership_v1',
  'organiser_team_set_public_v1', 'resolve_organiser_access_request_v1', 'organiser_profile_update_p5_v1'];

let pages: ReturnType<typeof page>[];
let myRole: Role;
let members: unknown[];
let requests: unknown[];
let left: number;
let teamFails: boolean;
const sent: string[] = [];

function install() {
  h.rpc.mockImplementation(async (fn: string) => {
    sent.push(fn);
    if (fn === 'organiser_team_v1') return teamFails ? { data: null, error: { message: 'boom' } } : { data: { my_role: myRole, members }, error: null };
    if (fn === 'list_organiser_access_requests_v1') return { data: requests, error: null };
    if (fn === 'my_profile_progress_v1') return { data: PROGRESS(left), error: null };
    return { data: null, error: null };
  });
}

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname}{l.search}</p>;
}
function at(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={`${P3_BASE}/*`} element={<P3Routes />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  sent.length = 0;
  pages = [page('org-1', 'Bachata Sensual London', 'owner')];
  myRole = 'owner';
  members = [ME('owner'), ...others(4)];
  requests = [];
  left = 0;
  teamFails = false;
  h.publicRows = [{ id: 'x' }];
  h.home.mockReset().mockImplementation(async () => ({ today: '2026-10-27', organisers: pages }));
  h.entity.mockReset().mockResolvedValue({ id: 'org-1', name: 'Bachata Sensual London', avatar_url: null, bio: 'Weekly socials', socials: null, city_id: null, instagram: null, website: null, organisation_category: 'school', founded_year: null, cities: null });
  install();
});
afterEach(cleanup);

const rowIds = () => within(screen.getByTestId('p3-you-rows')).queryAllByTestId(/^p3-you-/).map((e) => e.dataset.testid!.replace('p3-you-', ''));

describe('youRows (the one row list): shape -> rows', () => {
  const base = { pages: 1, teamCount: 5, requests: 0, requiredLeft: 0, addPage: '/add' };
  it.each([
    ['single page', base, ['page', 'team', 'add-page']],
    ['2 pages', { ...base, pages: 2 }, ['switch', 'page', 'team']],
    ['50 pages (prod max)', { ...base, pages: 50 }, ['switch', 'page', 'team']],
    ['no page', { ...base, pages: 0, teamCount: null }, ['team']],
  ] as const)('%s', (_n, f, ids) => {
    expect(youRows(f).map((r) => r.id)).toEqual(ids);
  });
  it('no page: Team is disabled and says why; every other row links', () => {
    const [team] = youRows({ ...base, pages: 0, teamCount: null });
    expect(team).toMatchObject({ to: null, reason: YOU.teamNoPage });
    for (const r of youRows({ ...base, pages: 3 })) expect(r.to).toBeTruthy();
  });
  it.each([[1, 'Just you'], [12, '12 people'], [20, '20 people']])('team of %i -> "%s"', (n, sub) => {
    expect(youRows({ ...base, teamCount: n }).find((r) => r.id === 'team')!.sub).toBe(sub);
  });
  it('join requests badge Team; required answers replace the page sub', () => {
    const rows = youRows({ ...base, requests: 2, requiredLeft: 3 });
    expect(rows.find((r) => r.id === 'team')!.badge).toBe(2);
    expect(rows.find((r) => r.id === 'page')!.sub).toBe('Required to publish: 3 answers left');
  });
  it('one entry per row: ids are unique (a new row, e.g. Get paid, is one more entry)', () => {
    expect(new Set(YOU_ROWS.map((d) => d.id)).size).toBe(YOU_ROWS.length);
  });
});

describe('You hub x shape', () => {
  it('single page, owner, live: page card (shared role + status words), no Switch row, Add another page', async () => {
    at(P3_PATHS.you);
    expect(await screen.findByTestId('p3-you-page-name')).toHaveProperty('textContent', 'Bachata Sensual London');
    expect(screen.getByTestId('p3-you-page-card').textContent).toContain(ROLE_LABEL.owner);
    expect(screen.getByTestId('p3-you-page-status').textContent).toBe('Live');
    await waitFor(() => expect(within(screen.getByTestId('p3-you-team')).getByText('5 people')).toBeTruthy());
    expect(rowIds()).toEqual(['page', 'team', 'add-page']);
    expect(screen.getByTestId('p3-you-add-page').getAttribute('href')).toBe(`${ORG_PATHS.home}?add=1`);
    expect(screen.getByTestId('p3-you-account').getAttribute('href')).toBe(ORG_PATHS.more);
  });

  it('3 pages, manager on a draft one with a long name: Switch row first, Draft tag, Manager', async () => {
    pages = [page('org-2', LONG, 'manager', 'draft'), page('org-1', 'Bachata Sensual London', 'owner'), page('org-3', 'Dance Fusion', 'manager')];
    myRole = 'manager';
    members = [ME('manager'), ...others(11)];
    left = 2;
    at(P3_PATHS.you);
    expect((await screen.findByTestId('p3-you-page-name')).textContent).toBe(LONG);
    expect(screen.getByTestId('p3-you-page-status').textContent).toBe('Draft');
    expect(screen.getByTestId('p3-you-page-card').textContent).toContain(ROLE_LABEL.manager);
    expect(rowIds()).toEqual(['switch', 'page', 'team']);
    expect(screen.getByTestId('p3-you-switch').textContent).toContain('3 pages');
    await waitFor(() => expect(screen.getByTestId('p3-you-page').textContent).toContain('Required to publish: 2 answers left'));
    await waitFor(() => expect(screen.getByTestId('p3-you-team').textContent).toContain('12 people'));
  });

  it('a join request badges Team with its count, labelled for screen readers', async () => {
    requests = [REQUEST];
    at(P3_PATHS.you);
    const badge = await screen.findByLabelText('1 person wants to join');
    expect(badge.textContent).toBe('1');
  });

  it('no page: says what to do (invite-only copy, Message us), Team disabled with why', async () => {
    pages = [];
    at(P3_PATHS.you);
    const empty = await screen.findByTestId('p3-you-no-page');
    expect(empty.textContent).toContain(INVITE_REQUIRED_COPY);
    expect(screen.getByTestId('p3-you-message-us').getAttribute('href')).toBe(ORG_PATHS.help);
    expect(screen.getByTestId('p3-you-team').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByTestId('p3-you-team').textContent).toContain(YOU.teamNoPage);
  });

  it('loading, then did-not-load with a retry that reads again', async () => {
    let fail = true;
    h.home.mockImplementation(async () => { if (fail) throw new Error('offline'); return { today: '2026-10-27', organisers: pages }; });
    at(P3_PATHS.you);
    expect(screen.getByTestId('p3-you-loading')).toBeTruthy();
    expect(await screen.findByTestId('p3-you-error')).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('p3-you-page-card')).toBeTruthy();
  });

  it('reading the hub sends no write', async () => {
    requests = [REQUEST];
    at(P3_PATHS.you);
    await screen.findByTestId('p3-you-page-card');
    await waitFor(() => expect(sent).toContain('my_profile_progress_v1'));
    expect(sent.filter((f) => WRITES.includes(f))).toEqual([]);
  });
});

describe('Team in P3 x shape', () => {
  const backIsYou = () => {
    expect(screen.getByTestId('org-back').getAttribute('href')).toBe(P3_PATHS.you);
    expect(screen.getAllByRole('heading', { level: 1 }).map((x) => x.textContent)).toEqual(['Team']);
  };

  it('owner, team of 12 with a join request: request above the list, Add links to the P3 add screen, rows to P3 people', async () => {
    members = [ME('owner'), ...others(11)];
    requests = [REQUEST];
    at(P3_PATHS.youTeam);
    await screen.findByTestId('join-request');
    backIsYou();
    await waitFor(() => expect(screen.getAllByTestId('team-member')).toHaveLength(12));
    const order = [...document.querySelectorAll('[data-testid="join-request"], [data-testid="team-list"]')].map((e) => e.getAttribute('data-testid'));
    expect(order).toEqual(['join-request', 'team-list']);
    expect(screen.getByTestId('team-add').getAttribute('href')).toBe(P3_PATHS.youTeamAdd);
    expect(screen.getAllByTestId('team-member')[1].getAttribute('href')).toBe(P3_PATHS.youTeamPerson('u0'));
    expect(screen.queryByTestId('org-switcher')).toBeNull();
  });

  it('empty team (just you, the prod majority): your row, Add enabled', async () => {
    members = [ME('owner')];
    at(P3_PATHS.youTeam);
    await waitFor(() => expect(screen.getAllByTestId('team-member')).toHaveLength(1));
    expect(screen.getByTestId('team-add').tagName).toBe('A');
  });

  it(`full (${TEAM_CAP}) with a join request: Add and the request's Add both disabled, both say why`, async () => {
    members = [ME('owner'), ...others(TEAM_CAP - 1)];
    requests = [REQUEST];
    at(P3_PATHS.youTeam);
    expect((await screen.findByTestId('join-request-blocked')).textContent).toBe(TEAM_FULL_REASON);
    expect((screen.getByTestId('join-request-add') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('team-add') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('team-full').textContent).toBe(TEAM_FULL_REASON);
  });

  it('manager: Add links, Leave is offered', async () => {
    pages = [page('org-1', 'Ritmo', 'manager')];
    myRole = 'manager';
    members = [member('own', 'owner'), ME('manager')];
    at(P3_PATHS.youTeam);
    await waitFor(() => expect(screen.getByTestId('team-add').tagName).toBe('A'));
    expect(screen.getByTestId('team-leave').getAttribute('href')).toBe(ORG_PATHS.more);
  });

  it('contributor: Add someone is DISABLED with its reason (owner pick), not hidden', async () => {
    pages = [page('org-1', 'Ritmo', 'manager')];
    myRole = 'contributor';
    members = [member('own', 'owner'), ME('contributor')];
    at(P3_PATHS.youTeam);
    await waitFor(() => expect(screen.getByTestId('team-full').textContent).toBe(ADD_ROLE_REASON));
    const add = screen.getByTestId('team-add') as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    expect(add.getAttribute('aria-describedby')).toBe('team-full');
  });

  it('no dancer profile: the public switch is disabled with the shared reason', async () => {
    members = [ME('owner', { profile_id: null })];
    at(P3_PATHS.youTeam);
    expect((await screen.findByTestId('team-public-note')).textContent).toBe(NO_PROFILE_NOTE);
    expect((screen.getByTestId('team-public-switch') as HTMLButtonElement).disabled).toBe(true);
  });

  it('long names wrap in the row (never truncated away)', async () => {
    members = [ME('owner'), member('l', 'manager', { display_name: LONG })];
    at(P3_PATHS.youTeam);
    await waitFor(() => expect(screen.getAllByTestId('team-member')[1].textContent).toContain(LONG));
  });

  it('did not load: retry, never a guess at the role', async () => {
    teamFails = true;
    at(P3_PATHS.youTeam);
    expect(await screen.findByTestId('team-load-error')).toBeTruthy();
    expect(screen.queryByTestId('team-add')).toBeNull();
  });
});

describe('Person, Add, Hand over in P3', () => {
  it('owner viewing a contributor: back = Team (P3), remove confirm, Keep returns', async () => {
    members = [ME('owner'), member('tom', 'contributor', { display_name: 'Tom Okafor' })];
    at(P3_PATHS.youTeamPerson('tom'));
    fireEvent.click(await screen.findByTestId('person-remove'));
    expect(screen.getByTestId('person-remove-confirm').textContent).toContain('Remove Tom Okafor?');
    expect(screen.getByTestId('org-back').getAttribute('href')).toBe(P3_PATHS.youTeam);
    fireEvent.click(screen.getByTestId('person-remove-no'));
    expect(screen.getByTestId('person-remove')).toBeTruthy();
    expect(sent.filter((f) => WRITES.includes(f))).toEqual([]);
  });

  it('not on the team any more: says so, links back to P3 Team', async () => {
    at(P3_PATHS.youTeamPerson('gone'));
    const missing = await screen.findByTestId('person-missing');
    expect(within(missing).getByRole('link').getAttribute('href')).toBe(P3_PATHS.youTeam);
  });

  it('hand over: options link to the P3 confirm, back goes to Team', async () => {
    members = [ME('owner'), member('pri', 'manager', { display_name: 'Priya Sharma' })];
    at(P3_PATHS.youHandover);
    const opt = await screen.findByTestId('handover-option');
    expect(opt.getAttribute('href')).toBe(P3_PATHS.youHandoverTo('pri'));
    expect(screen.getByTestId('org-back').getAttribute('href')).toBe(P3_PATHS.youTeam);
  });

  it('hand over as a manager (39 of 51 prod pages have no owner): owner-only, said plainly', async () => {
    pages = [page('org-1', 'Ritmo', 'manager')];
    myRole = 'manager';
    members = [ME('manager')];
    at(P3_PATHS.youHandover);
    expect(await screen.findByTestId('handover-owner-only')).toBeTruthy();
  });

  it('Add someone as a contributor: read-only, the same reason, back to P3 Team', async () => {
    pages = [page('org-1', 'Ritmo', 'manager')];
    myRole = 'contributor';
    members = [ME('contributor')];
    at(P3_PATHS.youTeamAdd);
    const ro = await screen.findByTestId('add-read-only');
    expect(ro.textContent).toContain(ADD_ROLE_REASON);
    expect(within(ro).getByRole('link').getAttribute('href')).toBe(P3_PATHS.youTeam);
  });
});

describe('Switch page, Organiser page, Welcome in P3', () => {
  it('Switch: rows with the shared role words, Showing on the current one; a tap returns to You on it', async () => {
    pages = [page('org-1', 'Bachata Sensual London', 'owner'), page('org-2', LONG, 'manager', 'draft')];
    at(P3_PATHS.youSwitch);
    const rows = await screen.findAllByTestId('switch-row');
    expect(rows.map((r) => r.textContent)).toEqual([`Bachata Sensual London${ROLE_LABEL.owner}LiveShowing`, `${LONG}${ROLE_LABEL.manager}`]);
    expect(screen.getByTestId('switch-add-page').getAttribute('href')).toBe(`${ORG_PATHS.home}?add=1`);
    fireEvent.click(rows[1]);
    expect(await screen.findByTestId('p3-you-page-name')).toHaveProperty('textContent', LONG);
  });

  it('Organiser page: back = You, Team link stays in P3', async () => {
    at(P3_PATHS.youPage);
    const team = await screen.findByTestId('page-team-link');
    expect(team.getAttribute('href')).toBe(P3_PATHS.youTeam);
    expect(screen.getByTestId('org-back').getAttribute('href')).toBe(P3_PATHS.you);
    expect(sent.filter((f) => WRITES.includes(f))).toEqual([]);
  });

  it('Organiser page with no page: the empty state points at You', async () => {
    pages = [];
    at(P3_PATHS.youPage);
    expect((await screen.findByTestId('page-no-organiser')).textContent).toContain('from You');
  });

  it('Welcome 7c: "Switch any time from You" (owner pick)', async () => {
    pages = [page('org-1', 'Bachata Sensual London', 'owner'), page('org-2', 'Ritmo Latino', 'manager')];
    at(P3_PATHS.youWelcome('org-2'));
    expect((await screen.findByTestId('org-welcome-sub')).textContent).toBe('You also manage Bachata Sensual London. Switch any time from You.');
    fireEvent.click(screen.getByTestId('org-welcome-home'));
    expect(await screen.findByTestId('p3-screen-home')).toBeTruthy();
  });
});
