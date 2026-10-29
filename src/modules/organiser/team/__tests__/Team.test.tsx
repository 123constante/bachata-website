// @vitest-environment jsdom
/**
 * S6 Team (C25, C25b, C26, D9, D41, D43, D50, D56, D60, R3-11): the faces wall, the join request above
 * the list, one person keyed by user_id (not profile_id), remove -> Done "Add them back".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route } from 'react-router-dom';

const h = vi.hoisted(() => ({ rpc: vi.fn(), home: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => h.rpc(...a), auth: {} } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me', email: 'me@x.example' }, signOut: vi.fn() }) }));
vi.mock('@/modules/organiser/shared/selfServeApi', async () => ({ ...(await vi.importActual<object>('@/modules/organiser/shared/selfServeApi')), fetchOrganiserHome: h.home }));

import TeamPage from '../index';
import TeamFlow from '../TeamFlow';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { TEAM_CAP } from '@/modules/organiser/shared/teamModel';
import { ORG, makeRpc, mountAt, org, row } from './fixtures';

const MEMBERS = [row('me', 'owner', { is_self: true, display_name: 'Diego Ruiz', photo_url: 'https://img.example/d.jpg' }), row('ana', 'manager', { display_name: 'Ana Maria' })];
const face = (i: number, o: Record<string, unknown> = {}) => ({ profile_id: `p${i}`, display_name: `Dancer${i} Sur${i}`, photo_url: null, fact: null, can_add: true, ...o });
let world: ReturnType<typeof makeRpc>;
let faces: unknown[];
let members: unknown[];
let myRole: string;
let requests: unknown[];

const install = (extra: Record<string, unknown | ((a: Record<string, unknown>) => unknown)> = {}) => {
  world = makeRpc({
    organiser_team_v1: () => ({ my_role: myRole, members }),
    list_organiser_access_requests_v1: () => requests,
    organiser_team_browse_people_v1: (a: Record<string, unknown>) => faces.slice(0, a.p_limit as number),
    organiser_team_search_people_v1: [],
    ...extra,
  });
  h.rpc.mockImplementation(world.rpc);
};

const routes = (
  <>
    <Route path="/account/o/team" element={<TeamPage />} />
    <Route path="/account/o/team/add" element={<TeamFlow step="add" />} />
    <Route path="/account/o/team/:userId" element={<TeamFlow step="person" />} />
  </>
);

beforeEach(() => {
  h.rpc.mockReset();
  myRole = 'owner';
  members = MEMBERS;
  faces = [];
  requests = [];
  h.home.mockReset().mockImplementation(async () => ({ today: '2026-10-07', organisers: [org(myRole === 'manager' ? 'manager' : 'owner')] }));
  install();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); });

describe('C25 Team', () => {
  it('lists members with photo or initials, Owner / Manager roles, and who added the caller', async () => {
    members = [row('me', 'manager', { is_self: true, display_name: 'Diego Ruiz', added_by_display_name: 'Maya R.' }), row('boss', 'owner', { display_name: 'Maya Rao', photo_url: 'https://img.example/m.jpg' })];
    myRole = 'manager';
    mountAt('/account/o/team', routes);
    const rows = await screen.findAllByTestId('team-member');
    expect(rows.map((r) => r.getAttribute('data-role'))).toEqual(['manager', 'owner']);
    expect(within(rows[0]).getByTestId('avatar-initials').textContent).toBe('DR');
    expect(rows[1].querySelector('img')?.getAttribute('src')).toBe('https://img.example/m.jpg');
    expect(screen.getByTestId('team-added-by').textContent).toBe('Added by Maya R.');
    expect(screen.queryByText('Contributor')).toBeNull();
  });

  it('a member with no name or photo still gets a face (fallback name, never a blank circle)', async () => {
    members = [row('me', 'owner', { is_self: true, display_name: null, email: null })];
    mountAt('/account/o/team', routes);
    expect((await screen.findByTestId('avatar-initials')).textContent).toBe('AM');
  });

  it('owner AND manager see Add someone; a row opens the person by user_id', async () => {
    for (const role of ['owner', 'manager']) {
      myRole = role;
      members = [row('me', role, { is_self: true }), row('ana', 'manager')];
      mountAt('/account/o/team', routes);
      expect(await screen.findByTestId('team-add')).toBeTruthy();
      cleanup();
    }
    mountAt('/account/o/team', routes);
    const link = (await screen.findAllByTestId('team-member'))[1];
    expect(link.getAttribute('href')).toBe(ORG_PATHS.teamPerson('ana'));
  });

  it('a manager can reach Leave (C29 is S7: only the link is asserted)', async () => {
    myRole = 'manager';
    members = [row('me', 'manager', { is_self: true }), row('o', 'owner')];
    mountAt('/account/o/team', routes);
    expect((await screen.findByTestId('team-leave')).getAttribute('href')).toBe(ORG_PATHS.more);
  });

  it('the join request is a card ABOVE the list; Add as Manager sends ONE add call', async () => {
    requests = [{ request_id: 'r1', user_id: 'u9', requester_email: 'cleo@x.example', message: 'I teach Tuesdays', created_at: '2026-10-01T10:00:00Z' }];
    mountAt('/account/o/team', routes);
    const card = await screen.findByTestId('join-request');
    const list = screen.getByTestId('team-list');
    expect(card.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByTestId('join-request-add'));
    await waitFor(() => expect(world.calls('organiser_team_add_member_by_profile_v1')).toHaveLength(1));
    expect(world.calls('organiser_team_add_member_by_profile_v1')[0]).toEqual({ p_organiser_id: ORG, p_profile_id: 'u9', p_member_role: 'manager', p_reason: null });
  });

  it('Decline uses the existing resolve call and sends no add', async () => {
    requests = [{ request_id: 'r1', user_id: 'u9', requester_email: 'cleo@x.example', created_at: '2026-10-01T10:00:00Z' }];
    mountAt('/account/o/team', routes);
    fireEvent.click(await screen.findByTestId('join-request-decline'));
    await waitFor(() => expect(world.calls('resolve_organiser_access_request_v1')).toEqual([{ p_request_id: 'r1', p_decision: 'decline' }]));
    expect(world.calls('organiser_team_add_member_by_profile_v1')).toHaveLength(0);
  });

  it('at 20 members Add someone is disabled with the reason, and so is the request card', async () => {
    members = Array.from({ length: TEAM_CAP }, (_, i) => row(i === 0 ? 'me' : `m${i}`, i === 0 ? 'owner' : 'manager', i === 0 ? { is_self: true } : {}));
    requests = [{ request_id: 'r1', user_id: 'u9', requester_email: 'c@x.example', created_at: '2026-10-01T10:00:00Z' }];
    mountAt('/account/o/team', routes);
    expect(((await screen.findByTestId('team-add')) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('team-add-reason').textContent).toBe('This team is full (20)');
    expect((screen.getByTestId('join-request-add') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('C25b the faces wall', () => {
  const at = () => mountAt('/account/o/team/add', routes);

  it('a can_add face: ONE tap = ONE add call, then Done "Priya S. is a Manager"', async () => {
    faces = [face(1, { profile_id: 'pr', display_name: 'Priya Sharma', fact: 'attended:3' })];
    at();
    const btn = await screen.findByTestId('add-face');
    expect(btn.textContent).toContain('Priya S.');
    expect(btn.textContent).toContain('Came 3 times');
    fireEvent.click(btn);
    expect(await screen.findByTestId('org-done-message')).toBeTruthy();
    expect(screen.getByTestId('org-done-message').textContent).toBe('Priya S. is a Manager');
    expect(world.calls('organiser_team_add_member_by_profile_v1')).toEqual([{ p_organiser_id: ORG, p_profile_id: 'pr', p_member_role: 'manager', p_reason: null }]);
  });

  it('a face WITHOUT can_add reads Invite; tap shares the link with their first name and writes nothing', async () => {
    faces = [face(1, { display_name: 'Lena Voss', can_add: false })];
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    at();
    const btn = await screen.findByTestId('add-face');
    expect(btn.textContent).toContain('Invite');
    fireEvent.click(btn);
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const sent = share.mock.calls[0][0] as { text: string };
    expect(sent.text).toMatch(/^Lena, join Ritmo on Bachata Calendar: https?:\/\/.+\/auth\. Sign up with the email we have for you and your profile links automatically; otherwise ask us to link it\.$/);
    expect(world.sent.filter((s) => /add_member|set_member|transfer|remove/.test(s.fn))).toHaveLength(0);
  });

  it('navigator.share absent -> the message is copied and the screen says "Link copied"', async () => {
    faces = [face(1, { display_name: 'Lena Voss', can_add: false })];
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    at();
    fireEvent.click(await screen.findByTestId('add-face'));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('org-announce').textContent).toBe('Link copied'));
    expect(writeText.mock.calls[0][0]).toContain('Lena, join Ritmo');
  });

  it('0 faces -> the empty state with the one action', async () => {
    at();
    expect((await screen.findByTestId('add-short')).textContent).toBe('0 dancers have an account and a photo so far. Share an invite link to reach the rest.');
    expect(screen.queryAllByTestId('add-face')).toHaveLength(0);
    expect(screen.getByTestId('add-invite')).toBeTruthy();
  });

  it('103 faces page by Show more (30, 60, 90, 103)', async () => {
    faces = Array.from({ length: 103 }, (_, i) => face(i));
    at();
    await waitFor(() => expect(screen.getAllByTestId('add-face')).toHaveLength(30));
    for (const n of [60, 90, 103]) {
      fireEvent.click(screen.getByTestId('add-show-more'));
      await waitFor(() => expect(screen.getAllByTestId('add-face')).toHaveLength(n));
    }
    expect(screen.queryByTestId('add-show-more')).toBeNull();
    expect(world.calls('organiser_team_browse_people_v1').map((a) => a.p_limit)).toEqual(expect.arrayContaining([30, 60, 90, 120]));
  });

  it('initials fallback, 44px+ faces, 3 columns, and never the organiser’s own members', async () => {
    faces = [face(1, { profile_id: 'ana', display_name: 'Ana Maria' }), face(2, { display_name: 'No Photo' }), face(3, { photo_url: 'https://img.example/x.jpg' })];
    at();
    const wall = await screen.findByTestId('add-wall');
    expect(wall.className).toContain('grid-cols-3');
    const buttons = screen.getAllByTestId('add-face');
    expect(buttons).toHaveLength(2); // 'ana' is a member: not listed
    for (const b of buttons) expect(b.className).toMatch(/min-h-\[44px\]/);
    expect(within(buttons[0]).getByTestId('avatar-initials').textContent).toBe('NP');
  });

  it('team at 20 -> the wall is disabled with the reason and nothing is sent on tap', async () => {
    members = Array.from({ length: TEAM_CAP }, (_, i) => row(i === 0 ? 'me' : `m${i}`, i === 0 ? 'owner' : 'manager', i === 0 ? { is_self: true } : {}));
    faces = [face(1)];
    at();
    const btn = (await screen.findByTestId('add-face')) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getByTestId('add-full').textContent).toBe('This team is full (20)');
    fireEvent.click(btn);
    expect(world.calls('organiser_team_add_member_by_profile_v1')).toHaveLength(0);
  });

  it('team_full from a race: the add is refused with the cap copy, nothing else changes (S-ERR)', async () => {
    faces = [face(1)];
    install({ organiser_team_add_member_by_profile_v1: () => new Error('team_full') });
    at();
    fireEvent.click(await screen.findByTestId('add-face'));
    expect((await screen.findByTestId('add-error')).textContent).toBe(`This team already has ${TEAM_CAP} people. Remove someone first, or ask the Bachata Calendar team.`);
  });

  // S-FEEDBACK 6: a full team still shows people's faces (photo when there is one, initials otherwise), dimmed and not tappable.
  it.each([
    { name: 'at cap', count: TEAM_CAP, serverFull: false },
    { name: 'server said team_full', count: 2, serverFull: true },
  ])('$name -> photo face shows its photo, the other shows initials, both disabled', async ({ count, serverFull }) => {
    members = Array.from({ length: count }, (_, i) => row(i === 0 ? 'me' : `m${i}`, i === 0 ? 'owner' : 'manager', i === 0 ? { is_self: true } : {}));
    faces = [face(1, { photo_url: 'https://img.example/p1.jpg' }), face(2)];
    install({ organiser_team_add_member_by_profile_v1: () => new Error('team_full') });
    at();
    const buttons = (await screen.findAllByTestId('add-face')) as HTMLButtonElement[];
    if (serverFull) {
      fireEvent.click(buttons[0]);
      await screen.findByTestId('add-error');
    }
    const [withPhoto, without] = screen.getAllByTestId('add-face') as HTMLButtonElement[];
    expect(withPhoto.querySelector('img')?.getAttribute('src')).toBe('https://img.example/p1.jpg');
    expect(withPhoto.querySelector('[data-testid="avatar-initials"]')).toBeNull();
    expect(without.querySelector('img')).toBeNull();
    expect(without.querySelector('[data-testid="avatar-initials"]')?.textContent).toBeTruthy();
    expect(withPhoto.disabled && without.disabled).toBe(true);
  });

  // S-POLISH 2: member count x server answer -> Add enabled/disabled, the reason on screen when disabled.
  it.each([
    { name: 'under cap', count: 2, serverFull: false, disabled: false },
    { name: 'at cap', count: TEAM_CAP, serverFull: false, disabled: true },
    { name: 'server said team_full', count: 2, serverFull: true, disabled: true },
  ])('$name -> faces disabled=$disabled, reason visible when disabled, invite link row stays', async ({ count, serverFull, disabled }) => {
    members = Array.from({ length: count }, (_, i) => row(i === 0 ? 'me' : `m${i}`, i === 0 ? 'owner' : 'manager', i === 0 ? { is_self: true } : {}));
    faces = [face(1), face(2)];
    install({ organiser_team_add_member_by_profile_v1: () => new Error('team_full') });
    at();
    const first = (await screen.findAllByTestId('add-face'))[0] as HTMLButtonElement;
    if (serverFull) {
      fireEvent.click(first);
      await screen.findByTestId('add-error');
    }
    for (const b of screen.getAllByTestId('add-face')) expect((b as HTMLButtonElement).disabled).toBe(disabled);
    const text = document.body.textContent ?? '';
    if (disabled) expect(text).toMatch(/team is full|already has 20 people/);
    expect((screen.getByTestId('add-invite') as HTMLButtonElement).disabled).toBe(false);
    if (serverFull) {
      fireEvent.click(screen.getAllByTestId('add-face')[1]);
      expect(world.calls('organiser_team_add_member_by_profile_v1')).toHaveLength(1);
      expect(screen.getByTestId('add-error')).toBeTruthy();
    }
  });

  it('search needs 2 letters, asks for 8 results, and a result tap adds with ONE call', async () => {
    install({ organiser_team_search_people_v1: [{ profile_id: 'pz', display_name: 'Zoe Park', photo_url: null, city_name: 'Leeds' }] });
    at();
    const input = await screen.findByTestId('add-search');
    fireEvent.change(input, { target: { value: 'z' } });
    await new Promise((r) => setTimeout(r, 400));
    expect(world.calls('organiser_team_search_people_v1')).toHaveLength(0);
    fireEvent.change(input, { target: { value: 'zo' } });
    const hit = await screen.findByTestId('add-result');
    expect(world.calls('organiser_team_search_people_v1')[0]).toMatchObject({ p_query: 'zo', p_limit: 8 });
    fireEvent.click(hit);
    await waitFor(() => expect(world.calls('organiser_team_add_member_by_profile_v1')).toHaveLength(1));
  });
});

describe('C26 one person (keyed by user_id)', () => {
  // A member whose profile_id differs from user_id: the page and every call use the user_id from the team read.
  const odd = [row('me', 'owner', { is_self: true }), row('user-77', 'manager', { display_name: 'Rosa Vega', profile_id: 'profile-other' })];

  it('opens, removes (the user_id is sent) and lands on Done with "Add them back" and no Undo', async () => {
    members = odd;
    mountAt(ORG_PATHS.teamPerson('user-77'), routes);
    expect((await screen.findByTestId('person-role')).textContent).toBe('Manager');
    expect(screen.getByTestId('person-explainer')).toBeTruthy();
    fireEvent.click(screen.getByTestId('person-remove'));
    fireEvent.click(screen.getByTestId('person-remove-yes'));
    expect((await screen.findByTestId('org-done-message')).textContent).toBe('Removed from the team');
    expect(world.calls('remove_organiser_member_v1')).toEqual([{ p_organiser_id: ORG, p_user_id: 'user-77' }]);
    const labels = within(screen.getByTestId('org-done')).getAllByRole('button').map((b) => b.textContent);
    expect(labels).toEqual(['Back to Home', 'Add them back']);
    fireEvent.click(screen.getByText('Add them back'));
    expect(await screen.findByTestId('org-page-team-add')).toBeTruthy();
  });

  it('a manager viewing another member: role shown, change disabled with the reason, no Remove', async () => {
    myRole = 'manager';
    members = [row('me', 'manager', { is_self: true }), row('o', 'owner'), row('ana', 'manager')];
    mountAt(ORG_PATHS.teamPerson('ana'), routes);
    expect(((await screen.findByTestId('person-change-role')) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('person-role-reason').textContent).toBe('Only the owner changes roles or removes people');
    expect(screen.queryByTestId('person-remove')).toBeNull();
  });

  it('an owner can make a Contributor a Manager (one set_member call)', async () => {
    members = [row('me', 'owner', { is_self: true }), row('c1', 'contributor', { display_name: 'Cy Lan' })];
    mountAt(ORG_PATHS.teamPerson('c1'), routes);
    fireEvent.click(await screen.findByTestId('person-make-manager'));
    await waitFor(() => expect(world.calls('organiser_team_set_member_v1')).toHaveLength(1));
    expect(world.calls('organiser_team_set_member_v1')[0]).toMatchObject({ p_member_role: 'manager' });
  });

  it('an unknown id says they are not on the team (no crash)', async () => {
    mountAt(ORG_PATHS.teamPerson('ghost'), routes);
    expect(await screen.findByTestId('person-missing')).toBeTruthy();
  });
});
