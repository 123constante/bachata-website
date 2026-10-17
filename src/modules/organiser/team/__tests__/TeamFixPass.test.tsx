// @vitest-environment jsdom
/**
 * REVIEW-S6 fix pass (B2, S1-S4, N1-N5). Every test here was run red on the unfixed head 18cccba first.
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
import HandoverFlow from '../../flows/handover/index';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { shortWallLine } from '../browseApi';
import { ORG, makeRpc, mountAt, org, row } from './fixtures';
import { OWNER_ONLY_ADD, ROLE_HELP } from '@/modules/organiser/shared/selfServeErrors';

/** Everything the Team screens and the shell READ; any other RPC (an unknown one too) counts as a write. */
const READS = new Set([
  'organiser_team_v1', 'list_organiser_access_requests_v1', 'organiser_team_browse_people_v1', 'organiser_team_search_people_v1',
  '_my_dancer_profile_id_v1', 'my_account_deletion_status_v1', 'dancer_area_gate_v1',
]);
const ADD = 'organiser_team_add_member_by_profile_v1';
const err = (code: string) => () => new Error(code);
const REQUEST = { request_id: 'r1', user_id: 'u9', requester_email: 'cleo@x.example', created_at: '2026-10-01T10:00:00Z' };

let world: ReturnType<typeof makeRpc>;
let members: unknown[];
let myRole: string;
let homeRole: string;
let homeOrgs: unknown[] | null;
const install = (extra: Record<string, unknown | ((a: Record<string, unknown>) => unknown)> = {}) => {
  world = makeRpc({
    organiser_team_v1: () => ({ my_role: myRole, members }),
    list_organiser_access_requests_v1: () => [REQUEST],
    organiser_team_browse_people_v1: [],
    organiser_team_search_people_v1: [],
    ...extra,
  });
  h.rpc.mockImplementation(world.rpc);
};
const writes = () => world.sent.filter((s) => !READS.has(s.fn));

const routes = (
  <>
    <Route path="/account/o/team" element={<TeamPage />} />
    <Route path="/account/o/team/add" element={<TeamFlow step="add" />} />
    <Route path="/account/o/team/:userId" element={<TeamFlow step="person" />} />
    <Route path="/account/o/handover/:userId" element={<HandoverFlow step="confirm" />} />
  </>
);

beforeEach(() => {
  h.rpc.mockReset();
  myRole = 'owner';
  homeRole = 'owner';
  homeOrgs = null;
  members = [row('me', 'owner', { is_self: true, display_name: 'Diego Ruiz' }), row('ana', 'manager', { display_name: 'Ana Maria' })];
  h.home.mockReset().mockImplementation(async () => ({ today: '2026-10-07', organisers: homeOrgs ?? [{ ...org('owner'), role: homeRole }] }));
  install();
});
afterEach(cleanup);

describe('S1 the request card does exactly ONE write', () => {
  it('Add as Manager: the whole write set is the one add (no follow-up resolve)', async () => {
    mountAt('/account/o/team', routes);
    fireEvent.click(await screen.findByTestId('join-request-add', {}, { timeout: 3000 }));
    await waitFor(() => expect(world.calls(ADD)).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 20));
    expect(writes()).toEqual([{ fn: ADD, args: { p_organiser_id: ORG, p_profile_id: 'u9', p_member_role: 'manager', p_reason: null } }]);
  });
});

describe('B2 / S2 refusals on add read sensibly', () => {
  it('owner_only on the request card (a manager before A1b) says who can add, not "you can see the team and leave it"', async () => {
    myRole = 'manager'; homeRole = 'manager';
    members = [row('me', 'manager', { is_self: true }), row('o', 'owner')];
    install({ [ADD]: err('owner_only') });
    mountAt('/account/o/team', routes);
    fireEvent.click(await screen.findByTestId('join-request-add'));
    expect((await screen.findByTestId('join-request-error')).textContent).toBe(OWNER_ONLY_ADD);
  });
  it('owner_only on a wall face reads the same', async () => {
    myRole = 'manager'; homeRole = 'manager';
    members = [row('me', 'manager', { is_self: true }), row('o', 'owner')];
    install({ [ADD]: err('owner_only'), organiser_team_browse_people_v1: [{ profile_id: 'p1', display_name: 'Priya Shah', photo_url: null, fact: null, can_add: true }] });
    mountAt('/account/o/team/add', routes);
    fireEvent.click(await screen.findByTestId('add-face'));
    expect((await screen.findByTestId('add-error')).textContent).toBe(OWNER_ONLY_ADD);
  });
  it('user_not_found on the card does not tell a requester to sign up', async () => {
    install({ [ADD]: err('user_not_found') });
    mountAt('/account/o/team', routes);
    fireEvent.click(await screen.findByTestId('join-request-add'));
    expect((await screen.findByTestId('join-request-error')).textContent).toBe('We could not add them from here. Ask the Bachata Calendar team.');
  });
});

describe('S3 the wall never lists a member whose profile id differs from their user id', () => {
  it('face and search result with the member profile_id are excluded', async () => {
    members = [row('me', 'owner', { is_self: true }), row('ben-user', 'manager', { display_name: 'Ben Ode', profile_id: 'ben-profile' })];
    const ben = { profile_id: 'ben-profile', display_name: 'Ben Ode', photo_url: null, fact: null, can_add: true };
    const zoe = { profile_id: 'zoe', display_name: 'Zoe Kay', photo_url: null, fact: null, can_add: true };
    install({ organiser_team_browse_people_v1: [ben, zoe], organiser_team_search_people_v1: [ben, zoe] });
    mountAt('/account/o/team/add', routes);
    await waitFor(() => expect(screen.getAllByTestId('add-face')).toHaveLength(1));
    expect(screen.getByTestId('add-face').getAttribute('aria-label')).toBe('Add Zoe Kay as Manager');
    fireEvent.change(screen.getByTestId('add-search'), { target: { value: 'Ben' } });
    await waitFor(() => expect(screen.getByTestId('add-results')).toBeTruthy());
    await waitFor(() => expect(screen.getAllByTestId('add-result').map((b) => b.textContent)).toEqual(['ZKZoe Kay']));
  });
});

describe('S4 / N3 one person', () => {
  it('the explainer agrees with D50 (managers add)', async () => {
    mountAt(ORG_PATHS.teamPerson('ana'), routes);
    expect((await screen.findByTestId('person-explainer')).textContent).toBe(ROLE_HELP);
    expect(ROLE_HELP).toMatch(/^Owners and managers add people\./);
  });
  it('a manager viewing another member: one reason covers role AND remove', async () => {
    myRole = 'manager'; homeRole = 'manager';
    members = [row('me', 'manager', { is_self: true }), row('ana', 'manager')];
    mountAt(ORG_PATHS.teamPerson('ana'), routes);
    expect((await screen.findByTestId('person-role-reason')).textContent).toBe('Only the owner changes roles or removes people');
  });
});

describe('N1 hand over refusal', () => {
  it('unconfirmed_email on C31 says hand over, not "add them"', async () => {
    members = [row('me', 'owner', { is_self: true }), row('maya', 'manager', { display_name: 'Maya Rao' })];
    install({ organiser_transfer_ownership_v1: err('unconfirmed_email') });
    mountAt(ORG_PATHS.handoverTo('maya'), routes);
    fireEvent.click(await screen.findByTestId('handover-send'));
    expect((await screen.findByTestId('handover-error')).textContent).toBe('Maya has not confirmed their email address yet. Ask them to confirm it, then hand the page over.');
  });
});

describe('N2 the short wall line', () => {
  it('singular, and no "and a photo" when a face has no photo', () => {
    expect(shortWallLine(1, false)).toBe('1 dancer has an account so far. Share an invite link to reach the rest.');
    expect(shortWallLine(2, true)).toBe('2 dancers have an account and a photo so far. Share an invite link to reach the rest.');
    expect(shortWallLine(1, true)).toBe('1 dancer has an account and a photo so far. Share an invite link to reach the rest.');
  });
  it('the wall uses the photo-less form under initials faces', async () => {
    install({ organiser_team_browse_people_v1: [{ profile_id: 'p1', display_name: 'Priya Shah', photo_url: null, fact: null, can_add: true }] });
    mountAt('/account/o/team/add', routes);
    expect((await screen.findByTestId('add-short')).textContent).toBe('1 dancer has an account so far. Share an invite link to reach the rest.');
  });
});

describe('N4 no dead ends on /team/add', () => {
  it('no page chosen -> a link back to Team', async () => {
    homeOrgs = [];
    mountAt('/account/o/team/add', routes);
    const p = await screen.findByTestId('add-no-page');
    expect(within(p).getByRole('link').getAttribute('href')).toBe(ORG_PATHS.team);
  });
  it('a contributor -> the reason and a link back to Team', async () => {
    myRole = 'contributor'; homeRole = 'contributor';
    members = [row('me', 'contributor', { is_self: true }), row('o', 'owner')];
    mountAt('/account/o/team/add', routes);
    const p = await screen.findByTestId('add-read-only');
    expect(within(p).getByRole('link').getAttribute('href')).toBe(ORG_PATHS.team);
  });
});

describe('N5 the team read fails', () => {
  for (const role of ['manager', 'contributor']) {
    it(`Home says ${role}: a retry, never Add someone`, async () => {
      homeRole = role;
      install({ organiser_team_v1: err('boom') });
      mountAt('/account/o/team', routes);
      expect(await screen.findByTestId('team-load-error')).toBeTruthy();
      expect(screen.queryByTestId('team-add')).toBeNull();
    });
  }
});
