// @vitest-environment jsdom
/** Team page (W4): add (grant), decline, remove, leave, refusals, owner vs manager. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const api = vi.hoisted(() => ({ home: vi.fn(), incoming: vi.fn(), remove: vi.fn(), resolve: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {} } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'me@x.example' }, signOut: vi.fn() }) }));
vi.mock('@/modules/organiser/shared/selfServeApi', async () => ({
  ...(await vi.importActual<object>('@/modules/organiser/shared/selfServeApi')),
  fetchOrganiserHome: api.home,
  fetchIncomingAccessRequests: api.incoming,
  removeOrganiserMember: api.remove,
  resolveAccessRequest: api.resolve,
}));

import TeamPage from '../index';

const TEAM = [
  { user_id: 'u1', member_role: 'owner', is_primary: true, is_self: true, email: 'me@x.example', display_name: 'Diego' },
  { user_id: 'u2', member_role: 'manager', is_primary: false, is_self: false, email: 'ana@x.example', display_name: 'Ana' },
];
const org = (role: 'owner' | 'manager', team = TEAM) => ({
  id: 'org-1', name: 'Ritmo', slug: 'ritmo', avatar_url: null, city_id: null, lifecycle_status: 'live', role, latest_decision: null, series: [], team,
});
const REQ = { requestId: 'r1', userId: 'u9', requesterEmail: 'cleo@x.example', message: 'I run the Tuesday class', createdAt: '2026-10-01T10:00:00Z' };
const refusal = (code: string) => Object.assign(new Error(code), { message: code });

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/account/o/team']}>
        <Routes>
          <Route path="/account/o/team" element={<TeamPage />} />
          <Route path="/account/o" element={<p data-testid="landed-home">home</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  api.home.mockReset().mockResolvedValue({ today: '2026-10-07', organisers: [org('owner')] });
  api.incoming.mockReset().mockResolvedValue([REQ]);
  api.remove.mockReset();
  api.resolve.mockReset();
});
afterEach(cleanup);

describe('team list', () => {
  it('lists members with their roles and shows a skeleton first', async () => {
    mount();
    expect(screen.getByTestId('team-loading')).toBeTruthy();
    const rows = await screen.findAllByTestId('team-member');
    expect(rows.map((r) => r.getAttribute('data-role'))).toEqual(['owner', 'manager']);
    expect(rows[0].textContent).toContain('Diego');
    expect(rows[0].textContent).toContain('You \u00b7 me@x.example');
    expect(rows[1].textContent).toContain('Manager');
  });

  it('removes a manager after a plain-words confirm, then collapses the row', async () => {
    api.remove.mockResolvedValue({ selfRemoved: false });
    mount();
    fireEvent.click(await screen.findByTestId('member-remove'));
    expect(screen.getByTestId('member-confirm').textContent).toContain('Remove Ana? They will no longer see or edit these events.');
    fireEvent.click(screen.getByTestId('member-confirm-yes'));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('org-1', 'u2'));
    expect(await screen.findByTestId('team-confirmation')).toBeTruthy();
    expect(screen.getByTestId('team-confirmation').textContent).toBe('Ana no longer has access.');
    await waitFor(() => expect(screen.getAllByTestId('team-member')).toHaveLength(1));
  });

  it('"No, keep them" closes the question without calling the server', async () => {
    mount();
    fireEvent.click(await screen.findByTestId('member-remove'));
    fireEvent.click(screen.getByTestId('member-confirm-no'));
    expect(screen.queryByTestId('member-confirm')).toBeNull();
    expect(api.remove).not.toHaveBeenCalled();
  });

  it('shows the plain-English refusal and keeps the row', async () => {
    api.remove.mockRejectedValue(refusal('cannot_remove_owner'));
    mount();
    fireEvent.click(await screen.findByTestId('member-remove'));
    fireEvent.click(screen.getByTestId('member-confirm-yes'));
    expect((await screen.findByTestId('member-confirm-error')).textContent).toBe(
      'Another owner cannot be removed here. They can leave themselves, or ask the Bachata Calendar team.',
    );
    expect(screen.getAllByTestId('team-member')).toHaveLength(2);
  });

  it('the only owner sees Leave disabled with the reason, not hidden', async () => {
    mount();
    const leave = (await screen.findByTestId('member-leave')) as HTMLButtonElement;
    expect(leave.disabled).toBe(true);
    expect(screen.getByTestId('member-note').textContent).toContain('You are the only owner');
  });

  it('a manager who leaves lands on Home', async () => {
    api.home.mockResolvedValue({ today: '', organisers: [org('manager', [
      { ...TEAM[0], is_self: false },
      { ...TEAM[1], is_self: true },
    ])] });
    api.remove.mockResolvedValue({ selfRemoved: true });
    mount();
    expect(await screen.findAllByTestId('team-member')).toHaveLength(2);
    expect(screen.queryByTestId('member-remove')).toBeNull();
    fireEvent.click(screen.getByTestId('member-leave'));
    fireEvent.click(screen.getByTestId('member-confirm-yes'));
    expect(await screen.findByTestId('landed-home')).toBeTruthy();
    expect(api.remove).toHaveBeenCalledWith('org-1', 'u2');
  });

  it('says there is no change-role control and why', async () => {
    mount();
    expect((await screen.findByTestId('team-note')).textContent).toContain('Only the Bachata Calendar team can change');
  });
});

describe('requests to join', () => {
  it('adds a member as a manager after the confirm step', async () => {
    api.resolve.mockResolvedValue({ requestId: 'r1', decision: 'grant', memberRole: 'manager' });
    mount();
    expect((await screen.findByTestId('request-message')).textContent).toContain('I run the Tuesday class');
    fireEvent.click(screen.getByTestId('request-grant'));
    expect(screen.getByTestId('request-grant-confirm').textContent).toContain('Add cleo@x.example as a manager?');
    expect(api.resolve).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('request-grant-confirm-yes'));
    await waitFor(() => expect(api.resolve).toHaveBeenCalledWith('r1', 'grant'));
    expect((await screen.findByTestId('team-confirmation')).textContent).toBe('cleo@x.example can now edit Ritmo’s events as a manager.');
  });

  it('declines in one tap', async () => {
    api.resolve.mockResolvedValue({ requestId: 'r1', decision: 'decline', memberRole: null });
    api.incoming.mockResolvedValueOnce([REQ]).mockResolvedValue([]);
    mount();
    fireEvent.click(await screen.findByTestId('request-decline'));
    await waitFor(() => expect(api.resolve).toHaveBeenCalledWith('r1', 'decline'));
    expect((await screen.findByTestId('team-confirmation')).textContent).toBe('Declined. cleo@x.example can ask again later.');
    expect(await screen.findByTestId('requests-empty')).toBeTruthy();
  });

  it('shows the refusal when the request was already answered', async () => {
    api.resolve.mockRejectedValue(refusal('request_not_open'));
    mount();
    fireEvent.click(await screen.findByTestId('request-decline'));
    expect((await screen.findByTestId('request-error')).textContent).toBe('That request was already answered. Reload the page.');
  });

  it('a manager sees the buttons disabled with the reason', async () => {
    api.home.mockResolvedValue({ today: '', organisers: [org('manager', [{ ...TEAM[0], is_self: false }, { ...TEAM[1], is_self: true }])] });
    mount();
    expect(((await screen.findByTestId('request-grant')) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('request-decline') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('requests-owner-only').textContent).toBe('Only an owner can add or decline people.');
  });

  it('empty, and error with retry', async () => {
    api.incoming.mockRejectedValueOnce(new Error('offline')).mockResolvedValue([]);
    mount();
    fireEvent.click(await screen.findByTestId('requests-error-retry'));
    expect(await screen.findByTestId('requests-empty')).toBeTruthy();
  });
});

describe('page states', () => {
  it('no organiser yet', async () => {
    api.home.mockResolvedValue({ today: '', organisers: [] });
    mount();
    expect(await screen.findByTestId('team-no-organiser')).toBeTruthy();
  });

  it('switches between organisers when there are several', async () => {
    api.home.mockResolvedValue({ today: '', organisers: [org('owner'), { ...org('owner'), id: 'org-2', name: 'Sabor' }] });
    mount();
    fireEvent.click(await screen.findByTestId('org-switch-org-2'));
    await waitFor(() => expect(api.incoming).toHaveBeenCalledWith('org-2'));
  });
});
