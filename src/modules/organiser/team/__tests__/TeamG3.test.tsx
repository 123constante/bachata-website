// @vitest-environment jsdom
/**
 * F-INT fix pass, worker G3 (B-S3, B-S5, B-S8b, A-N7, A-S5). Each test was run red on the unfixed tree first
 * (evidence: scratchpad ev/G3.md).
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
import { makeRpc, mountAt, org, row } from './fixtures';

const SEARCH = 'organiser_team_search_people_v1';
let world: ReturnType<typeof makeRpc>;
let members: unknown[];
let myRole: string;
const install = (extra: Record<string, unknown | ((a: Record<string, unknown>) => unknown)> = {}) => {
  world = makeRpc({
    organiser_team_v1: () => ({ my_role: myRole, members }),
    list_organiser_access_requests_v1: [],
    organiser_team_browse_people_v1: [],
    [SEARCH]: [],
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
  members = [row('me', 'owner', { is_self: true, display_name: 'Diego Ruiz' }), row('ana', 'manager', { display_name: 'Ana Maria' })];
  h.home.mockReset().mockImplementation(async () => ({ today: '2026-10-07', organisers: [{ ...org('owner'), role: myRole }] }));
  install();
});
afterEach(cleanup);

describe('B-S3: the leave links name the control they lead to', () => {
  beforeEach(() => {
    myRole = 'manager';
    members = [row('me', 'manager', { is_self: true, display_name: 'Diego Ruiz' }), row('o', 'owner')];
    install();
  });
  it('Team says "Leave this page"', async () => {
    mountAt(ORG_PATHS.team, routes);
    expect((await screen.findByTestId('team-leave')).textContent).toBe('Leave this page');
  });
  it('Person (your own row) says "Leave this page"', async () => {
    mountAt(ORG_PATHS.teamPerson('me'), routes);
    expect((await screen.findByTestId('person-leave')).textContent).toBe('Leave this page');
  });
});

describe('B-S5: Add someone results never end in a blank list', () => {
  it('(a) every hit is already on the team: the "No one found" line shows', async () => {
    install({ [SEARCH]: [{ profile_id: 'ana', display_name: 'Ana Maria', photo_url: null, city_name: null }] });
    mountAt(ORG_PATHS.teamAdd, routes);
    fireEvent.change(await screen.findByTestId('add-search'), { target: { value: 'Ana' } });
    await waitFor(() => expect(world.calls(SEARCH)).toHaveLength(1));
    expect(await screen.findByTestId('add-no-results')).toBeTruthy();
    expect(screen.queryAllByTestId('add-result')).toHaveLength(0);
  });
  it('(b) a failed search is announced and has a Retry (44px) that searches again', async () => {
    let fail = true;
    install({ [SEARCH]: () => (fail ? new Error('boom') : [{ profile_id: 'zoe', display_name: 'Zoe Park', photo_url: null, city_name: null }]) });
    mountAt(ORG_PATHS.teamAdd, routes);
    fireEvent.change(await screen.findByTestId('add-search'), { target: { value: 'Zoe' } });
    const line = await screen.findByTestId('add-search-error');
    expect(line.getAttribute('role')).toBe('alert');
    const retry = within(line).getByRole('button', { name: 'Retry' });
    expect(retry.className).toMatch(/min-h-\[44px\]/);
    fail = false;
    fireEvent.click(retry);
    await waitFor(() => expect(world.calls(SEARCH)).toHaveLength(2));
    expect((await screen.findByTestId('add-result')).textContent).toContain('Zoe Park');
  });
});

describe('A-N7: "Add them back" opens the add screen for THAT person', () => {
  it('Done -> Add them back -> the search is prefilled with their name and runs', async () => {
    install({ remove_organiser_member_v1: { ok: true } });
    mountAt(ORG_PATHS.teamPerson('ana'), routes);
    fireEvent.click(await screen.findByTestId('person-remove'));
    fireEvent.click(screen.getByTestId('person-remove-yes'));
    fireEvent.click(await screen.findByText('Add them back'));
    const field = (await screen.findByTestId('add-search')) as HTMLInputElement;
    expect(field.value).toBe('Ana Maria');
    await waitFor(() => expect(world.calls(SEARCH)[0]).toMatchObject({ p_query: 'Ana Maria' }));
  });
});

describe('B-S8 (b): the inline remove confirm keeps focus', () => {
  it('is a labelled group, takes focus on open, and Keep them returns focus to Remove', async () => {
    mountAt(ORG_PATHS.teamPerson('ana'), routes);
    fireEvent.click(await screen.findByTestId('person-remove'));
    const group = screen.getByTestId('person-remove-confirm');
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Remove Ana Maria?');
    await waitFor(() => expect(group.contains(document.activeElement)).toBe(true));
    fireEvent.click(screen.getByTestId('person-remove-no'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('person-remove')));
  });
});
