// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { Route } from 'react-router-dom';

const h = vi.hoisted(() => ({ rpc: vi.fn(), home: vi.fn(), link: vi.fn(), people: vi.fn(), set: vi.fn(), changes: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => h.rpc(...a), auth: {} } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me', email: 'me@x.example' }, signOut: vi.fn() }) }));
vi.mock('@/modules/organiser/shared/selfServeApi', async () => ({ ...(await vi.importActual<object>('@/modules/organiser/shared/selfServeApi')), fetchOrganiserHome: h.home }));
vi.mock('../../p3/r4/r4TeamR2Api', async (orig) => ({
  ...(await orig<typeof import('../../p3/r4/r4TeamR2Api')>()),
  inviteLink: h.link, fetchTeamR2People: h.people, setTeamR2Switches: h.set, fetchTeamR2Changes: h.changes,
}));

import TeamFlow from '../TeamFlow';
import { flags } from '@/lib/featureFlags';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { makeRpc, mountAt, org, row } from './fixtures';

let myRole: string;
const person = (o: Record<string, unknown> = {}) => ({ userId: 'ana', profileId: null, name: 'Ana Maria', avatarUrl: null, role: 'manager', canSignIn: true, onPublic: true, isYou: false, doorUntil: null, doorExpired: false, ...o });
const routes = (
  <>
    <Route path="/account/o/team/add" element={<TeamFlow step="add" />} />
    <Route path="/account/o/team/:userId" element={<TeamFlow step="person" />} />
  </>
);
const mockFlag = (on: boolean) => { (flags as { organiserTeamR2: boolean }).organiserTeamR2 = on; };

beforeEach(() => {
  vi.clearAllMocks();
  mockFlag(true);
  myRole = 'owner';
  h.home.mockImplementation(async () => ({ today: '2026-11-25', organisers: [{ ...org('owner'), role: myRole }] }));
  h.rpc.mockImplementation(makeRpc({
    organiser_team_v1: () => ({ my_role: myRole, members: [row('me', 'owner', { is_self: true }), row('ana', 'manager', { display_name: 'Ana Maria' })] }),
    list_organiser_access_requests_v1: [], organiser_team_browse_people_v1: [], organiser_team_search_people_v1: [],
  }).rpc);
  h.link.mockResolvedValue({ token: 'tok1', expiresAt: null });
  h.people.mockResolvedValue({ people: [person()], invites: [] });
  h.changes.mockResolvedValue([]);
  h.set.mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); mockFlag(false); });

describe('AddSomeoneR2', () => {
  it('chips switch the Door and Manager blocks; no Contributor chip', async () => {
    mountAt(ORG_PATHS.teamAdd, routes);
    expect(await screen.findByTestId('add-whatsapp')).toBeTruthy();
    expect(screen.queryByText('Contributor')).toBeNull();
    fireEvent.click(screen.getByTestId('role-chip-door'));
    expect(screen.getByTestId('add-choose-night').getAttribute('href')).toContain('door-invite');
    expect(screen.queryByTestId('add-search')).toBeNull();
    fireEvent.click(screen.getByTestId('role-chip-manager'));
    expect(screen.getByTestId('add-search')).toBeTruthy();
  });
  it('mints ONCE across WhatsApp and Copy and builds the wa.me url', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    mountAt(ORG_PATHS.teamAdd, routes);
    fireEvent.click(await screen.findByTestId('add-whatsapp'));
    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(String(open.mock.calls[0][0])).toContain(encodeURIComponent('/invite/tok1'));
    expect(String(open.mock.calls[0][0]).startsWith('https://wa.me/?text=')).toBe(true);
    fireEvent.click(screen.getByTestId('add-copy-link'));
    await screen.findByText('Link copied');
    expect(h.link).toHaveBeenCalledTimes(1);
  });
  it('too_many_open_links shows the plain line', async () => {
    h.link.mockRejectedValue({ message: 'too_many_open_links' });
    mountAt(ORG_PATHS.teamAdd, routes);
    fireEvent.click(await screen.findByTestId('add-whatsapp'));
    expect((await screen.findByTestId('add-link-error')).textContent).toContain('10 links waiting');
  });
  it('a refusal hides both buttons and shows the read-only reason', async () => {
    h.link.mockRejectedValue({ message: 'not_owner' });
    mountAt(ORG_PATHS.teamAdd, routes);
    fireEvent.click(await screen.findByTestId('add-whatsapp'));
    await screen.findByTestId('add-refused');
    expect(screen.queryByTestId('add-whatsapp')).toBeNull();
    expect(screen.queryByTestId('add-copy-link')).toBeNull();
  });
});

describe('PersonR2', () => {
  it('flag OFF renders today\'s Person', async () => {
    mockFlag(false);
    mountAt('/account/o/team/ana', routes);
    expect(await screen.findByTestId('person-explainer')).toBeTruthy();
    expect(h.people).not.toHaveBeenCalled();
  });
  it('owner role chip calls set_switches with p_role and unchanged switches', async () => {
    h.people.mockResolvedValue({ people: [person({ canSignIn: true, onPublic: false })], invites: [] });
    mountAt('/account/o/team/ana', routes);
    fireEvent.click(await screen.findByTestId('person-role-contributor'));
    await waitFor(() => expect(h.set).toHaveBeenCalledWith('org-1', 'ana', true, false, 'contributor'));
  });
  it('manager viewer sees no role chips', async () => {
    myRole = 'manager';
    mountAt('/account/o/team/ana', routes);
    await screen.findByTestId('person-signin');
    expect(screen.queryByTestId('person-role-chips')).toBeNull();
  });
  it('missing person says so', async () => {
    h.people.mockResolvedValue({ people: [], invites: [] });
    mountAt('/account/o/team/ana', routes);
    expect(await screen.findByTestId('person-missing')).toBeTruthy();
  });
});
