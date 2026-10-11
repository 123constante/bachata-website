// @vitest-environment jsdom
/** Team screen x viewer {owner, manager, contributor, non-member}: what each may see and do (organiser_team_v1 + owner-only writes). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const api = vi.hoisted(() => ({ home: vi.fn(), incoming: vi.fn(), remove: vi.fn(), resolve: vi.fn(), team: vi.fn(), set: vi.fn(), transfer: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {} } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me' }, signOut: vi.fn() }) }));
vi.mock('@/modules/organiser/shared/selfServeApi', async () => ({
  ...(await vi.importActual<object>('@/modules/organiser/shared/selfServeApi')),
  fetchOrganiserHome: api.home,
  fetchIncomingAccessRequests: api.incoming,
  removeOrganiserMember: api.remove,
  resolveAccessRequest: api.resolve,
}));
vi.mock('@/modules/organiser/shared/teamRpcApi', async () => ({
  ...(await vi.importActual<object>('@/modules/organiser/shared/teamRpcApi')),
  fetchOrganiserTeam: api.team,
  setTeamMember: api.set,
  transferOwnership: api.transfer,
}));

import TeamPage from '../index';
import { parseTeamRead } from '../../shared/teamModel';

type Role = 'owner' | 'manager' | 'contributor';
const row = (user_id: string, member_role: Role, me: string, email: string | null) => ({ user_id, member_role, is_primary: member_role === 'owner', is_me: user_id === me, email });
/** organiser_team_v1 as the live body builds it: emails only for an owner (or admin). */
const teamFor = (myRole: Role) => ({
  my_role: myRole,
  members: [
    row('me', myRole, 'me', myRole === 'owner' ? 'me@x.example' : null),
    ...(myRole === 'owner' ? [] : [row('boss', 'owner', 'me', null)]),
    row('mgr', 'manager', 'me', myRole === 'owner' ? 'mgr@x.example' : null),
    row('con', 'contributor', 'me', myRole === 'owner' ? 'con@x.example' : null),
  ],
});
const org = (role: Role) => ({ id: 'org-1', name: 'Ritmo', slug: 'ritmo', avatar_url: null, city_id: null, lifecycle_status: 'live', role, latest_decision: null, series: [], team: [] });
const refusal = (code: string) => Object.assign(new Error(code), { message: code });

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/account/o/team']}>
        <Routes><Route path="/account/o/team" element={<TeamPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const asViewer = (role: Role) => {
  api.home.mockResolvedValue({ today: '', organisers: [org(role)] });
  api.team.mockResolvedValue(parseTeamRead(teamFor(role)));
};

beforeEach(() => {
  for (const f of Object.values(api)) f.mockReset();
  api.incoming.mockResolvedValue([]);
});
afterEach(cleanup);

describe('contributors are listed (the Home read drops them)', () => {
  it.each([
    ['owner', ['contributor', 'manager', 'owner']],
    ['manager', ['contributor', 'manager', 'manager', 'owner']],
    ['contributor', ['contributor', 'contributor', 'manager', 'owner']],
  ] as const)('%s sees every member with their role', async (role, expected) => {
    asViewer(role);
    mount();
    const rows = await screen.findAllByTestId('team-member');
    expect(rows.map((r) => r.getAttribute('data-role')).sort()).toEqual([...expected]);
  });
});

describe('owner', () => {
  beforeEach(() => asViewer('owner'));

  it('changes a manager to a contributor with the email the owner is shown', async () => {
    api.set.mockResolvedValue({});
    mount();
    const row = (await screen.findByTestId('member-mgr')).closest('[data-testid="team-member"]') as HTMLElement;
    fireEvent.click(row.querySelector('[data-testid="move-role"]')!);
    expect(screen.getByTestId('role-confirm').textContent).toContain('a contributor');
    fireEvent.click(screen.getByTestId('role-confirm-yes'));
    await waitFor(() => expect(api.set).toHaveBeenCalledWith('org-1', 'mgr@x.example', 'contributor'));
  });

  it('transfers ownership after a plain-words warning, and says they become a manager', async () => {
    api.transfer.mockResolvedValue({});
    mount();
    const row = (await screen.findByTestId('member-mgr')).closest('[data-testid="team-member"]') as HTMLElement;
    fireEvent.click(row.querySelector('[data-testid="move-transfer"]')!);
    expect(screen.getByTestId('transfer-confirm').textContent).toContain('You will become a manager');
    expect(api.transfer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('transfer-confirm-yes'));
    await waitFor(() => expect(api.transfer).toHaveBeenCalledWith('org-1', 'mgr'));
  });

  it('adds a person by email with a role; the button is off with a reason until the email looks right', async () => {
    api.set.mockResolvedValue({});
    mount();
    await screen.findByTestId('team-add');
    expect((screen.getByTestId('add-submit') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('add-reason').textContent).toMatch(/Enter their email/);
    fireEvent.change(screen.getByTestId('add-email'), { target: { value: 'new@x.example' } });
    fireEvent.change(screen.getByTestId('add-role'), { target: { value: 'contributor' } });
    fireEvent.click(screen.getByTestId('add-submit'));
    await waitFor(() => expect(api.set).toHaveBeenCalledWith('org-1', 'new@x.example', 'contributor'));
    expect(Array.from((screen.getByTestId('add-role') as HTMLSelectElement).options).map((o) => o.value)).toEqual(['manager', 'contributor']);
  });

  it.each([
    ['user_not_found', /No account has that email address/],
    ['unconfirmed_email', /not confirmed its email/],
    ['target_is_owner', /cannot be changed here/],
    ['owner_only', /Only an owner can do that/],
    ['use_transfer', /Make owner/],
  ])('add refusal %s reads in plain English', async (code, re) => {
    api.set.mockRejectedValue(refusal(code));
    mount();
    await screen.findByTestId('team-add');
    fireEvent.change(screen.getByTestId('add-email'), { target: { value: 'new@x.example' } });
    fireEvent.click(screen.getByTestId('add-submit'));
    expect((await screen.findByTestId('add-error')).textContent).toMatch(re);
  });

  it('another owner has no change or transfer button, with the reason on screen', async () => {
    api.team.mockResolvedValue(parseTeamRead({ my_role: 'owner', members: [row('me', 'owner', 'me', 'me@x.example'), row('o2', 'owner', 'me', 'o2@x.example')] }));
    mount();
    const r = (await screen.findByTestId('member-o2')).closest('[data-testid="team-member"]') as HTMLElement;
    expect(r.querySelector('[data-testid="move-role"]')).toBeNull();
    expect(r.querySelector('[data-testid="move-note"]')?.textContent).toMatch(/cannot be changed here/);
  });

  it('a member whose email is hidden cannot have their role changed, with the reason', async () => {
    api.team.mockResolvedValue(parseTeamRead({ my_role: 'owner', members: [row('me', 'owner', 'me', 'me@x.example'), row('mgr', 'manager', 'me', null)] }));
    mount();
    const r = (await screen.findByTestId('member-mgr')).closest('[data-testid="team-member"]') as HTMLElement;
    expect((r.querySelector('[data-testid="move-role"]') as HTMLButtonElement).disabled).toBe(true);
    expect(r.querySelector('[data-testid="move-note-noemail"]')).toBeTruthy();
  });
});

describe.each(['manager', 'contributor'] as const)('%s (read-only)', (role) => {
  beforeEach(() => asViewer(role));

  it('sees no owner moves and no add form, with the reason stated', async () => {
    mount();
    await screen.findAllByTestId('team-member');
    expect(screen.queryByTestId('move-role')).toBeNull();
    expect(screen.queryByTestId('move-transfer')).toBeNull();
    expect(screen.queryByTestId('add-submit')).toBeNull();
    expect(screen.getByTestId('add-read-only').textContent).toMatch(/Only an owner can add people, change roles or transfer ownership/);
  });

  it('may still leave', async () => {
    mount();
    await screen.findAllByTestId('team-member');
    expect((screen.getByTestId('member-leave') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('non-member', () => {
  it('has no organiser, so no team and no controls', async () => {
    api.home.mockResolvedValue({ today: '', organisers: [] });
    mount();
    expect(await screen.findByTestId('team-no-organiser')).toBeTruthy();
    expect(screen.queryByTestId('add-submit')).toBeNull();
    expect(api.team).not.toHaveBeenCalled();
  });
});
