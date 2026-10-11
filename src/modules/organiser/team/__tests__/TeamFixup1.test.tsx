// @vitest-environment jsdom
/** Round-1 fix-up: a removed person can come back (F4); the add card owns its own error (F5). */
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
const row = (user_id: string, member_role: Role, email: string | null) => ({ user_id, member_role, is_primary: member_role === 'owner', is_me: user_id === 'me', email });
const ME = row('me', 'owner', 'me@x.example');
const org = { id: 'org-1', name: 'Ritmo', slug: 'ritmo', avatar_url: null, city_id: null, lifecycle_status: 'live', role: 'owner', latest_decision: null, series: [], team: [] };
const refusal = (code: string) => Object.assign(new Error(code), { message: code });
let members: ReturnType<typeof row>[];

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
const memberRow = async (id: string) => (await screen.findByTestId(`member-${id}`)).closest('[data-testid="team-member"]') as HTMLElement;

beforeEach(() => {
  for (const f of Object.values(api)) f.mockReset();
  members = [ME, row('alice', 'manager', 'alice@x.example'), row('bob', 'contributor', 'bob@x.example')];
  api.home.mockResolvedValue({ today: '', organisers: [org] });
  api.incoming.mockResolvedValue([]);
  api.team.mockImplementation(async () => parseTeamRead({ my_role: 'owner', members }));
});
afterEach(cleanup);

const addByEmail = async (email: string) => {
  fireEvent.change(screen.getByTestId('add-email'), { target: { value: email } });
  fireEvent.click(screen.getByTestId('add-submit'));
};

describe('F4 a removed member can reappear', () => {
  it('remove Alice, add her again by email: she is listed without a reload', async () => {
    api.remove.mockImplementation(async () => { members = members.filter((m) => m.user_id !== 'alice'); return { selfRemoved: false }; });
    api.set.mockImplementation(async () => { members = [...members, row('alice', 'manager', 'alice@x.example')]; return {}; });
    mount();
    fireEvent.click((await memberRow('alice')).querySelector('[data-testid="member-remove"]')!);
    fireEvent.click(screen.getByTestId('member-confirm-yes'));
    await waitFor(() => expect(screen.queryByTestId('member-alice')).toBeNull());
    await addByEmail('alice@x.example');
    await waitFor(() => expect(api.set).toHaveBeenCalledWith('org-1', 'alice@x.example', 'manager'));
    expect(await screen.findByTestId('member-alice')).toBeTruthy();
  });

  it('the "remove them and add them again" path (email hidden on the row) also works', async () => {
    members = [ME, row('alice', 'manager', null)];
    api.remove.mockImplementation(async () => { members = [ME]; return { selfRemoved: false }; });
    api.set.mockImplementation(async () => { members = [ME, row('alice', 'manager', null)]; return {}; });
    mount();
    expect((await memberRow('alice')).querySelector('[data-testid="move-note-noemail"]')).toBeTruthy();
    fireEvent.click((await memberRow('alice')).querySelector('[data-testid="member-remove"]')!);
    fireEvent.click(screen.getByTestId('member-confirm-yes'));
    await waitFor(() => expect(screen.queryByTestId('member-alice')).toBeNull());
    await addByEmail('alice@x.example');
    expect(await screen.findByTestId('member-alice')).toBeTruthy();
  });

  it('a role change for a hidden user brings the row back', async () => {
    api.remove.mockImplementation(async () => ({ selfRemoved: false }));
    api.set.mockResolvedValue({});
    mount();
    fireEvent.click((await memberRow('bob')).querySelector('[data-testid="member-remove"]')!);
    fireEvent.click(screen.getByTestId('member-confirm-yes'));
    // The server still lists Bob (the removal did not stick): the re-read must win over the local hide.
    await waitFor(() => expect(api.remove).toHaveBeenCalled());
    await waitFor(() => expect(api.team.mock.calls.length).toBeGreaterThan(1));
    expect(await screen.findByTestId('member-bob')).toBeTruthy();
  });
});

describe('F5 the add card shows its own error', () => {
  it('add fails, then a remove fails: each message stays in its own place; an unrelated success clears neither', async () => {
    api.set.mockRejectedValueOnce(refusal('user_not_found')).mockResolvedValue({});
    api.remove.mockRejectedValue(refusal('owner_only'));
    mount();
    await screen.findByTestId('team-add');
    await addByEmail('nobody@x.example');
    expect((await screen.findByTestId('add-error')).textContent).toMatch(/No account has that email address/);

    fireEvent.click((await memberRow('alice')).querySelector('[data-testid="member-remove"]')!);
    fireEvent.click(screen.getByTestId('member-confirm-yes'));
    expect((await screen.findByTestId('member-confirm-error')).textContent).toMatch(/Only an owner can do that/);
    expect(screen.getByTestId('add-error').textContent).toMatch(/No account has that email address/);
    expect(screen.getByTestId('add-error').textContent).not.toMatch(/Only an owner/);
    expect(screen.getByTestId('member-confirm-error').textContent).not.toMatch(/No account/);

    // An unrelated success (a role change) clears neither message.
    fireEvent.click(screen.getByTestId('member-confirm-no'));
    fireEvent.click((await memberRow('bob')).querySelector('[data-testid="move-role"]')!);
    fireEvent.click(screen.getByTestId('role-confirm-yes'));
    await waitFor(() => expect(api.set).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('add-error').textContent).toMatch(/No account has that email address/);
    expect(screen.getAllByText(/No account has that email address/)).toHaveLength(1);
  });
});
