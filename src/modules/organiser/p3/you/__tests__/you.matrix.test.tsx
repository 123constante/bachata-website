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
import { P3_BASE, P3_PATHS, acceptedInviteLanding } from '../../shell/paths';
import { ORG_PATHS } from '../../../shell/paths';
import { ADD_ROLE_REASON, ROLE_LABEL, TEAM_CAP, TEAM_FULL_REASON } from '@/modules/organiser/shared/teamModel';
import { INVITE_REQUIRED_COPY } from '@/modules/organiser/shared/selfServeErrors';
import { NO_PROFILE_NOTE } from '../../../team/PublicToggle';
import { YOU, YOU_ROWS, youRows } from '../youRows';
import { NO_OWNER_REASON, NO_PAGE, TEAM_REASONS } from '@/modules/organiser/shared/teamRules';
import { TEAM_COPY, teamErrorMessage } from '@/modules/organiser/shared/selfServeErrors';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
function at(path: string | { pathname: string; state: unknown }) {
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
    expect(screen.getByTestId('team-add-reason').textContent).toBe(TEAM_FULL_REASON);
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
    await waitFor(() => expect(screen.getByTestId('team-add-reason').textContent).toBe(ADD_ROLE_REASON));
    const add = screen.getByTestId('team-add') as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    expect(add.getAttribute('aria-describedby')).toBe('team-add-reason');
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
  // Fix 3 (F4): a contributor cannot be removed by the real RPC (not_a_member), so the confirm row is a Manager's.
  it('owner viewing a manager: back = Team (P3), remove confirm, Keep returns', async () => {
    members = [ME('owner'), member('tom', 'manager', { display_name: 'Tom Okafor' })];
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

  // Fix 3 (F6): "from You" pointed at an add You does not show at 0 pages; the shared no-page copy instead.
  it('Organiser page with no page: the shared no-page copy with Message us', async () => {
    pages = [];
    at(P3_PATHS.youPage);
    expect((await screen.findByTestId('page-no-organiser')).textContent).toContain(NO_PAGE.body);
  });

  it('Welcome 7c: "Switch any time from You" (owner pick)', async () => {
    pages = [page('org-1', 'Bachata Sensual London', 'owner'), page('org-2', 'Ritmo Latino', 'manager')];
    at(P3_PATHS.youWelcome('org-2'));
    expect((await screen.findByTestId('org-welcome-sub')).textContent).toBe('You also manage Bachata Sensual London. Switch any time from You.');
    fireEvent.click(screen.getByTestId('org-welcome-home'));
    expect(await screen.findByTestId('p3-screen-home')).toBeTruthy();
  });
});

// ---- W4a fix 1 (the orchestrator's 390x844 walk) ----------------------------------------------

/** A colour literal outside a var() fallback: R1's black and gold (or any hex) painted inside P3. */
function literalColour(value: string): string | null {
  let v = value;
  for (let prev = ''; prev !== v;) { prev = v; v = v.replace(/var\([^()]*(\([^()]*\))?[^()]*\)/g, 'TOKEN'); }
  return /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.exec(v)?.[0] ?? null;
}
/** Every painted surface/text under the P3 frame that is not a P3 token (inline style or a Tailwind hex class). */
function nonTokenPaint(root: HTMLElement): string[] {
  const out: string[] = [];
  for (const el of [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]) {
    if (el.closest('svg')) continue;
    const style = el.getAttribute('style') ?? '';
    for (const decl of style.split(';')) {
      const [prop, ...rest] = decl.split(':');
      if (!/^\s*(background|background-color|color|border|border-color|border-top|border-bottom|outline)\s*$/i.test(prop ?? '')) continue;
      const hit = literalColour(rest.join(':'));
      if (hit) out.push(`${el.dataset.testid ?? el.tagName}: ${prop.trim()} ${hit}`);
    }
    const cls = typeof el.className === 'string' ? el.className : '';
    const hex = /(?:^|\s)(?:bg|text|border|from|to)-\[#[0-9a-f]+\]/i.exec(cls);
    if (hex) out.push(`${el.dataset.testid ?? el.tagName}: ${hex[0].trim()}`);
  }
  return out;
}

const DONE_STATES = [
  ['Remove', { title: 'Removed', message: 'Removed from the team', seriesId: null, next: P3_PATHS.youTeamAddFor('Tom Okafor'), nextLabel: 'Add them back', back: P3_PATHS.youTeam }],
  ['Make Manager', { title: 'Role changed', message: 'Tom is a Manager', seriesId: null, back: P3_PATHS.youTeam }],
  ['Hand over', { title: 'Handed over', message: 'Priya is the Owner - you are a Manager.', seriesId: null, back: P3_PATHS.youTeam }],
  ['Add', { title: 'Added', message: 'Priya is a Manager', seriesId: null, back: P3_PATHS.youTeam }],
  ['page Save', { title: 'Saved', message: 'Saved', seriesId: null, back: P3_PATHS.youPage }],
] as const;

describe('W4a fix 1 (a): every surface under the P3 frame paints with P3 tokens', () => {
  it.each([
    ['Organiser page (owner, published)', () => at(P3_PATHS.youPage), 'page-facts'],
    ['Organiser page (draft, required left)', () => { pages = [page('org-1', 'test org', 'owner', 'draft')]; left = 2; at(P3_PATHS.youPage); }, 'page-facts'],
    ['Team', () => at(P3_PATHS.youTeam), 'team-member'],
    ['Person', () => { members = [ME('owner'), member('tom', 'contributor', { display_name: 'Tom Okafor' })]; at(P3_PATHS.youTeamPerson('tom')); }, 'person-remove'],
    ...DONE_STATES.map(([n, s]) => [`Done after ${n}`, () => at({ pathname: P3_PATHS.youDone, state: s }), 'org-done'] as const),
  ] as const)('%s', async (_n, open, ready) => {
    open();
    await screen.findAllByTestId(ready);
    const shell = screen.getByTestId('p3-shell');
    expect(shell.querySelector('.org-theme'), 'no R1 frame inside P3').toBeNull();
    expect(nonTokenPaint(shell)).toEqual([]);
  });
});

describe('W4a fix 1 (walk item 2): the Organiser page has ONE Team entry', () => {
  it('owner (the role that got the editor Team card): no "Add a person" card, one link to Team', async () => {
    members = [ME('owner'), member('o2', 'owner'), member('o3', 'owner'), member('m1', 'manager')];
    at(P3_PATHS.youPage);
    await screen.findByTestId('page-facts');
    // The editor's Team card waits on organiser_team_v1: let that read land before asserting it is absent.
    await waitFor(() => expect(sent).toContain('organiser_team_v1'));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('eip-team')).toBeNull();
    const shell = screen.getByTestId('p3-shell');
    const teamLinks = Array.from(shell.querySelectorAll('a')).filter((a) => a.getAttribute('href') === P3_PATHS.youTeam);
    expect(teamLinks.map((a) => a.dataset.testid)).toEqual(['page-team-link']);
    expect(within(shell).queryAllByText(/^Team$/)).toHaveLength(1);
  });
});

describe('W4a fix 1 (b): no title is clipped under the top bar', () => {
  const css = readFileSync(join(__dirname, '..', '..', 'theme', 'p3.css'), 'utf8').replace(/\r\n/g, '\n');
  /** The declarations of one P3 rule (exact selector). */
  const rule = (selector: string) => {
    const at0 = css.indexOf(`${selector} {`);
    return at0 < 0 ? '' : css.slice(css.indexOf('{', at0) + 1, css.indexOf('}', at0));
  };
  it('the pushed top bar title clips its overflow, so it sets a line-height tall enough for its glyphs (index.css gives h1 1.1)', () => {
    const body = rule('.p3-theme .p3-top-row h1');
    expect(body).toMatch(/overflow:\s*hidden/);
    const lh = /line-height:\s*([\d.]+)(px)?/.exec(body);
    expect(lh, 'line-height on .p3-top-row h1').not.toBeNull();
    expect(lh![2] ? Number(lh![1]) / 20 : Number(lh![1])).toBeGreaterThanOrEqual(1.3);
  });

  /** Inline or class offsets that pull a box up under the bar. */
  const negativeOffset = (el: HTMLElement) =>
    /(?:^|;)\s*(margin(-top)?|top)\s*:\s*-/.test(el.getAttribute('style') ?? '') || /(?:^|\s)-(m|mt|my|top|inset|translate-y)-/.test(typeof el.className === 'string' ? el.className : '');

  it.each([
    ['Organiser page', P3_PATHS.youPage, 'page-name'],
    ['Team', P3_PATHS.youTeam, 'team-member'],
    ['You', P3_PATHS.you, 'p3-you-page-name'],
  ])('%s: the title sits in the top bar row, never in a negative-offset container', async (_n, path, ready) => {
    at(path);
    await screen.findAllByTestId(ready);
    const shell = screen.getByTestId('p3-shell');
    for (const h of Array.from(shell.querySelectorAll<HTMLElement>('h1, h2'))) {
      for (let el: HTMLElement | null = h; el && el !== shell; el = el.parentElement) expect(negativeOffset(el), `${h.textContent} in ${el.tagName}.${el.className}`).toBe(false);
    }
  });

  it('Organiser page: the page name (a clipped, truncating heading) carries its own line-height', async () => {
    pages = [page('org-1', 'test org', 'owner')];
    at(P3_PATHS.youPage);
    const name = await screen.findByTestId('page-name');
    expect(name.className).toMatch(/leading-\[(2[4-9]|3\d)px\]/);
  });
});

describe('W4a fix 1 (c): Done in P3 is P3 and returns into P3', () => {
  it.each(DONE_STATES)('Done after %s: P3 frame, and every button lands in P3', async (_n, state) => {
    at({ pathname: P3_PATHS.youDone, state });
    const done = await screen.findByTestId('org-done');
    expect(done.closest('.p3-theme')).not.toBeNull();
    const buttons = within(done).getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    for (const i of buttons.keys()) {
      cleanup();
      at({ pathname: P3_PATHS.youDone, state });
      fireEvent.click(within(await screen.findByTestId('org-done')).getAllByRole('button')[i]);
      await waitFor(() => expect(screen.queryByTestId('org-done')).toBeNull());
      expect(screen.queryByTestId('where'), 'an R1 path').toBeNull();
      expect(screen.getByTestId('p3-shell')).toBeTruthy();
    }
  });

  it('Done in P3 says where its second button goes: back to You, not R1 Home', async () => {
    at({ pathname: P3_PATHS.youDone, state: DONE_STATES[1][1] });
    const home = await screen.findByTestId('org-done-home');
    expect(home.textContent).toBe('Back to You');
    fireEvent.click(home);
    expect(await screen.findByTestId('p3-you-page-name')).toBeTruthy();
  });

  it('a reload of P3 Done (no router state) goes to You, not R1 Home', async () => {
    at(P3_PATHS.youDone);
    expect(await screen.findByTestId('p3-you-page-name')).toBeTruthy();
  });

  it.each([
    ['Remove', 'person-remove', 'person-remove-yes', 'remove_organiser_member_v1'],
    ['Make Manager', 'person-make-manager', null, 'organiser_team_set_member_v1'],
  ] as const)('%s from P3 Person lands on P3 Done, primary back to P3 Team', async (_n, open, confirm, rpc) => {
    // Fix 3 (F4): the remove RPC takes a Manager, Make Manager a Contributor; the same Person screen shows each.
    members = [ME('owner'), member('tom', rpc === 'remove_organiser_member_v1' ? 'manager' : 'contributor', { display_name: 'Tom Okafor' })];
    at(P3_PATHS.youTeamPerson('tom'));
    fireEvent.click(await screen.findByTestId(open));
    if (confirm) fireEvent.click(screen.getByTestId(confirm));
    const done = await screen.findByTestId('org-done');
    expect(sent).toContain(rpc);
    expect(done.closest('[data-testid="p3-shell"]')).not.toBeNull();
    fireEvent.click(screen.getByTestId('org-done-back'));
    expect(await screen.findAllByTestId('team-member')).not.toHaveLength(0);
  });

  it('Hand over from P3 lands on P3 Done', async () => {
    members = [ME('owner'), member('pri', 'manager', { display_name: 'Priya Sharma' })];
    at(P3_PATHS.youHandoverTo('pri'));
    fireEvent.click(await screen.findByTestId('handover-send'));
    const done = await screen.findByTestId('org-done');
    expect(done.closest('[data-testid="p3-shell"]')).not.toBeNull();
  });
});

// ---- W4a fix 2 (the orchestrator's re-walk of 3319e20 at 390x844) -------------------------------

describe('W4a fix 2: the page name, the first card and "Add a page" are readable and whole', () => {
  const css = readFileSync(join(__dirname, '..', '..', 'theme', 'p3.css'), 'utf8').replace(/\r\n/g, '\n');
  /** The custom properties (or declarations) of one P3 rule, exact selector. */
  const tokens = (selector: string) => {
    const at0 = css.indexOf(`${selector} {`);
    expect(at0, selector).toBeGreaterThanOrEqual(0);
    return Object.fromEntries(Array.from(css.slice(css.indexOf('{', at0) + 1, css.indexOf('}', at0)).matchAll(/([\w-]+):\s*([^;]+);/g), (m) => [m[1], m[2].trim()]));
  };
  const SCHEMES = [['light', tokens('.p3-theme')], ['dark', tokens('.p3-theme[data-theme="dark"]')]] as const;
  const lum = (hex: string) => {
    expect(hex, 'an opaque hex token').toMatch(/^#[0-9a-f]{6}$/i);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  /** The P3 token an element's OWN class paints with (text-[var(--x)] / bg-[var(--x)]); null when it only inherits. */
  const own = (el: Element, kind: 'text' | 'bg') => new RegExp(`(?:^|\\s)${kind}-\\[var\\((--[\\w-]+)\\)\\]`).exec(typeof el.className === 'string' ? el.className : '')?.[1] ?? null;
  /** The ground under an element: the nearest ancestor that paints a token, else the frame's --bg. */
  const ground = (el: Element) => { for (let n = el.parentElement; n; n = n.parentElement) { const t = own(n, 'bg'); if (t) return t; } return '--bg'; };

  it.each([['test org'], [LONG]])('a. Organiser page: the name "%s" sets its own P3 colour (index.css paints every h2 the site foreground) and reads >= 3:1 on its card, light and dark', async (name) => {
    pages = [page('org-1', name, 'owner')];
    at(P3_PATHS.youPage);
    // The first case pays for the lazy chunks' cold import.
    const h2 = await screen.findByTestId('page-name', {}, { timeout: 5000 });
    const fg = own(h2, 'text');
    expect(fg, 'page-name carries text-[var(--token)]').not.toBeNull();
    const bg = ground(h2);
    expect(bg).toBe('--card');
    for (const [scheme, T] of SCHEMES) expect(ratio(T[fg!], T[bg]), `${scheme}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(3);
  });

  it.each([['Organiser page', P3_PATHS.youPage, 'page-facts'], ['Team', P3_PATHS.youTeam, 'team-member'], ['Switch page', P3_PATHS.youSwitch, 'switch-add-page']])(
    'b. %s: the pushed page sits in a main with top padding clear of the bar (>= 16px)',
    async (_n, path, ready) => {
      at(path);
      const first = (await screen.findAllByTestId(ready))[0];
      const main = first.closest('main')!;
      expect(main.classList.contains('p3-main-pushed'), main.className).toBe(true);
      expect(parseInt(tokens('.p3-theme .p3-main-pushed')['padding-top'] ?? '0', 10)).toBeGreaterThanOrEqual(16);
    },
  );

  it('c. Switch page: "Add a page" is the terracotta text-link token, >= 4.5:1 on the page ground, light and dark, at a 44px tap height', async () => {
    pages = [page('org-1', 'Bachata Sensual London', 'owner'), page('org-2', 'test org', 'manager')];
    at(P3_PATHS.youSwitch);
    const add = await screen.findByTestId('switch-add-page');
    expect(own(add, 'text')).toBe('--gold-fg');
    expect(add.className).toMatch(/min-h-\[(4[4-9]|[5-9]\d)px\]/);
    for (const [scheme, T] of SCHEMES) expect(ratio(T['--gold-fg'], T[ground(add)]), `${scheme}: --gold-fg on ${ground(add)}`).toBeGreaterThanOrEqual(4.5);
  });
});

/**
 * W4a fix 3: the UI offers only what the live RPC accepts (prod bodies read 2026-10-28), on the
 * prod shapes: 39 of 51 pages have ONE manager and NO owner; 0 contributors (latent shape).
 */
describe('W4a fix 3: role x shape -> what Team, Person and Hand over offer (the real RPC rules)', () => {
  const NAMES_AN_OWNER = /ask (an|the) owner|only (an|the) owner/i;
  const soleManager = () => { pages = [page('org-1', 'Ritmo', 'manager')]; myRole = 'manager'; members = [ME('manager')]; };
  const reasonWithMessageUs = (id: string, text: string) => {
    const el = screen.getByTestId(id);
    expect(el.textContent).toContain(text);
    expect(within(el).getByRole('link', { name: 'Message us' }).getAttribute('href')).toBe(ORG_PATHS.help);
  };

  it('F1+F2 sole manager, no owner, a join request: Decline disabled, says nobody but us can, Message us; Add as Manager works', async () => {
    soleManager();
    requests = [REQUEST];
    at(P3_PATHS.youTeam);
    const decline = (await screen.findByTestId('join-request-decline')) as HTMLButtonElement;
    expect(decline.disabled).toBe(true);
    reasonWithMessageUs('join-request-decline-reason', NO_OWNER_REASON(TEAM_REASONS.declineWhat));
    expect(screen.getByTestId('join-request-decline-reason').textContent).not.toMatch(NAMES_AN_OWNER);
    expect(decline.getAttribute('aria-describedby')).toBe(screen.getByTestId('join-request-decline-reason').id);
    expect((screen.getByTestId('join-request-add') as HTMLButtonElement).disabled).toBe(false);
  });

  it('F1 manager on a page WITH an owner: Decline disabled with the owner reason (no Message us needed)', async () => {
    pages = [page('org-1', 'Ritmo', 'manager')];
    myRole = 'manager';
    members = [member('own', 'owner'), ME('manager')];
    requests = [REQUEST];
    at(P3_PATHS.youTeam);
    expect(((await screen.findByTestId('join-request-decline')) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('join-request-decline-reason').textContent).toBe(TEAM_REASONS.decline);
  });

  it('F1 owner: Decline is offered', async () => {
    requests = [REQUEST];
    at(P3_PATHS.youTeam);
    expect(((await screen.findByTestId('join-request-decline')) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId('join-request-decline-reason')).toBeNull();
  });

  it('F3 sole manager, no owner: Leave is disabled on Team and on your own row, with why and Message us', async () => {
    soleManager();
    at(P3_PATHS.youTeam);
    const leave = (await screen.findByTestId('team-leave')) as HTMLButtonElement;
    expect(leave.tagName).toBe('BUTTON');
    expect(leave.disabled).toBe(true);
    reasonWithMessageUs('team-leave-reason', TEAM_REASONS.leaveLast);
    cleanup();
    at(P3_PATHS.youTeamPerson('me'));
    expect(((await screen.findByTestId('person-leave')) as HTMLButtonElement).disabled).toBe(true);
    reasonWithMessageUs('person-leave-reason', TEAM_REASONS.leaveLast);
  });

  it('F3 two managers, no owner: Leave stays a link (someone still runs the page)', async () => {
    soleManager();
    members = [ME('manager'), member('pri', 'manager')];
    at(P3_PATHS.youTeam);
    expect((await screen.findByTestId('team-leave')).getAttribute('href')).toBe(ORG_PATHS.more);
  });

  it('F2 manager viewing a colleague on an ownerless page: the role reason names no owner and offers Message us', async () => {
    soleManager();
    members = [ME('manager'), member('pri', 'manager', { display_name: 'Priya Sharma' })];
    at(P3_PATHS.youTeamPerson('pri'));
    await screen.findByTestId('person-role-reason');
    reasonWithMessageUs('person-role-reason', NO_OWNER_REASON(TEAM_REASONS.rolesWhat));
    expect(screen.getByTestId('person-role-reason').textContent).not.toMatch(NAMES_AN_OWNER);
    expect(screen.queryByTestId('person-remove')).toBeNull();
    expect(screen.queryByTestId('person-hand-over')).toBeNull();
  });

  it('F2 hand over on an ownerless page: says only we can, Message us; on an owned page the owner line', async () => {
    soleManager();
    at(P3_PATHS.youHandover);
    await screen.findByTestId('handover-owner-only');
    reasonWithMessageUs('handover-owner-only', NO_OWNER_REASON(TEAM_REASONS.handoverWhat));
    cleanup();
    members = [member('own', 'owner'), ME('manager')];
    at(P3_PATHS.youHandoverTo('own'));
    expect((await screen.findByTestId('handover-owner-only')).textContent).toBe(TEAM_REASONS.handover);
  });

  it('F4 owner viewing a contributor: Remove is disabled with why (the RPC answers not_a_member), Make Manager stays', async () => {
    members = [ME('owner'), member('tom', 'contributor', { display_name: 'Tom Okafor' })];
    at(P3_PATHS.youTeamPerson('tom'));
    const remove = (await screen.findByTestId('person-remove')) as HTMLButtonElement;
    expect(remove.disabled).toBe(true);
    reasonWithMessageUs('person-remove-reason', TEAM_REASONS.removeContributor);
    expect(screen.getByTestId('person-make-manager')).toBeTruthy();
  });

  it('F4 contributor: Leave is disabled with why (the RPC answers not_authorised)', async () => {
    pages = [page('org-1', 'Ritmo', 'manager')];
    myRole = 'contributor';
    members = [member('own', 'owner'), ME('contributor')];
    at(P3_PATHS.youTeam);
    expect(((await screen.findByTestId('team-leave')) as HTMLButtonElement).disabled).toBe(true);
    reasonWithMessageUs('team-leave-reason', TEAM_REASONS.leaveContributor);
  });

  it('F6 no page: You, Team and the page editor say the same thing, each with Message us', async () => {
    pages = [];
    for (const [path, id] of [[P3_PATHS.you, 'p3-you-no-page'], [P3_PATHS.youTeam, 'team-no-organiser'], [P3_PATHS.youPage, 'page-no-organiser']] as const) {
      at(path);
      const box = await screen.findByTestId(id);
      expect(box.textContent, path).toContain(NO_PAGE.title);
      expect(box.textContent, path).toContain(NO_PAGE.body);
      expect(within(box).getByRole('link', { name: 'Message us' }).getAttribute('href'), path).toBe(ORG_PATHS.help);
      expect(box.textContent, path).not.toMatch(/from (You|Home)|Add one first/);
      cleanup();
    }
  });

  it('F7 a late Remove answer after leaving the screen does not yank you to Done', async () => {
    members = [ME('owner'), member('pri', 'manager', { display_name: 'Priya Sharma' })];
    let answer: (v: unknown) => void = () => {};
    h.rpc.mockImplementation(async (fn: string) => {
      sent.push(fn);
      if (fn === 'remove_organiser_member_v1') return new Promise((r) => { answer = r; });
      if (fn === 'organiser_team_v1') return { data: { my_role: myRole, members }, error: null };
      if (fn === 'list_organiser_access_requests_v1') return { data: [], error: null };
      return { data: null, error: null };
    });
    at(P3_PATHS.youTeamPerson('pri'));
    fireEvent.click(await screen.findByTestId('person-remove'));
    fireEvent.click(screen.getByTestId('person-remove-yes'));
    await waitFor(() => expect(sent).toContain('remove_organiser_member_v1'));
    fireEvent.click(screen.getByTestId('org-back'));
    await screen.findByTestId('org-page-team');
    answer({ data: { user_id: 'pri', member_role: 'manager' }, error: null });
    // The option-level onSuccess runs a few awaits after the answer: give it time to (wrongly) land.
    await new Promise((r) => setTimeout(r, 400));
    expect(screen.queryByTestId('org-done')).toBeNull();
    expect(screen.getByTestId('org-page-team')).toBeTruthy();
  });

  it('F8 already_member and the lookup cap have their own words, not "Something went wrong"', () => {
    expect(teamErrorMessage(new Error('already_member'))).toBe(TEAM_COPY.already_member);
    expect(teamErrorMessage(new Error('permission_denied: lookup_cap: 200 per 24h'))).toBe(TEAM_COPY.lookup_cap);
    expect(TEAM_COPY.already_member).toBeTruthy();
    expect(TEAM_COPY.lookup_cap).toBeTruthy();
  });

  it('F9 the Add reason has a neutral hook (it is not only "full")', async () => {
    pages = [page('org-1', 'Ritmo', 'manager')];
    myRole = 'contributor';
    members = [member('own', 'owner'), ME('contributor')];
    at(P3_PATHS.youTeam);
    await waitFor(() => expect(screen.getByTestId('team-add-reason').textContent).toBe(ADD_ROLE_REASON));
    expect(screen.getByTestId('team-add').getAttribute('aria-describedby')).toBe('team-add-reason');
  });

  it.each([
    [true, true, P3_PATHS.youWelcome('org 1')],
    [true, false, ORG_PATHS.welcome('org 1')],
    [false, true, ORG_PATHS.welcome('org 1')],
    [false, false, ORG_PATHS.welcome('org 1')],
  ])('F5 accepted-invite landing: organiserP3=%s organiserSelfServe=%s -> %s', (organiserP3, organiserSelfServe, to) => {
    expect(acceptedInviteLanding('org 1', { organiserP3, organiserSelfServe })).toBe(to);
  });

  it('F11 a pushed screen still loading keeps the P3 top bar (back to You)', async () => {
    const { P3YouSurface } = await import('../surface');
    // A screen whose chunk never arrives: it suspends forever, so the layout's fallback shows.
    const Never = (): null => { throw new Promise<never>(() => {}); };
    render(
      <MemoryRouter initialEntries={['/x']}>
        <Routes><Route element={<P3YouSurface />}><Route path="/x" element={<Never />} /></Route></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('p3-you-route-loading-card')).toBeTruthy();
    expect(screen.getByTestId('org-back').getAttribute('href')).toBe(P3_PATHS.you);
    expect(document.querySelector('header.p3-top')).not.toBeNull();
  });

  it('F10 Welcome when Home fails in P3 does not read "Your pages are on You."', async () => {
    h.home.mockReset().mockRejectedValue(new Error('boom'));
    at(P3_PATHS.youWelcome('org-1'));
    const sub = await screen.findByTestId('org-welcome-sub');
    expect(sub.textContent).not.toContain('are on You');
  });
});
