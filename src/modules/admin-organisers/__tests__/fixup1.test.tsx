// @vitest-environment jsdom
/** Round-1 fix-up: redeem refreshes Home (F1), the one-time link survives a collapse (F2), a row whose reads fail says so and retries (F3). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

const TOKEN = 'cd'.repeat(32);
const h = vi.hoisted(() => ({
  auth: { user: { id: 'u1' } as null | { id: string }, authStatus: 'ready' as 'ready' | 'resolving' },
  rpc: vi.fn(),
  organisers: [] as { id: string; name: string; lifecycle_status: string }[],
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => h.auth }));
// Every account / organiser route sits behind the dancer-first gate (DancerProfileGate);
// this spec is not about it, so the person's dancer profile is finished.
vi.mock('@/hooks/useProfileCompletion', () => ({
  useProfileCompletion: () => ({ status: 'complete', missing: [], profileId: 'p1', refetch: async () => ({ status: 'complete', missing: [], profileId: 'p1' }) }),
}));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => h.rpc(...a),
    from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: h.organisers, error: null }) }) }) }),
  },
}));

import AdminOrganisersPage from '../AdminOrganisersPage';
import InviteRedeemPage from '../InviteRedeemPage';
import { organiserHomeQueryKey } from '@/modules/organiser/shared/selfServeApi';

const ok = (data: unknown) => Promise.resolve({ data, error: null });
const ORGS = [
  { id: 'o-un', name: 'Alpha Unclaimed', lifecycle_status: 'live' },
  { id: 'o-in', name: 'Bravo Invited', lifecycle_status: 'live' },
];
const sent = { invite_id: 'i1', status: 'sent', issued_at: '2026-10-10T10:00:00Z', expires_at: '2026-10-17T10:00:00Z' };
let failOwnership: Set<string>;
let failInvites: Set<string>;

beforeEach(() => {
  h.auth.user = { id: 'u1' };
  h.organisers = ORGS;
  failOwnership = new Set();
  failInvites = new Set();
  h.rpc.mockReset().mockImplementation((fn: string, args?: Record<string, unknown>) => {
    const id = args?.p_organiser_id as string;
    switch (fn) {
      case 'admin_is_admin': return ok(true);
      case 'organiser_ownership_v1': return failOwnership.has(id) ? Promise.reject(new Error('boom')) : ok({ is_managed: false });
      case 'admin_list_organiser_invites_v1': return failInvites.has(id) ? Promise.reject(new Error('boom')) : ok(id === 'o-in' ? [sent] : []);
      case 'admin_issue_organiser_invite_v1': return ok({ invite_id: 'i9', token: TOKEN, expires_at: '2026-10-18T10:00:00Z', revoked_previous: [] });
      case 'redeem_organiser_invite_v1': return ok({ ok: true, status: 'redeemed', organiser_id: 'o1', member_role: 'owner' });
      default: return Promise.reject(new Error(`unexpected rpc ${fn}`));
    }
  });
  window.history.replaceState(null, '', '/admin/organisers');
  localStorage.clear();
});
afterEach(cleanup);

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('F1 redeem refreshes the organiser home before navigating', () => {
  function HomeProbe({ fetchHome }: { fetchHome: () => Promise<unknown> }) {
    useQuery({ queryKey: organiserHomeQueryKey('u1'), queryFn: fetchHome, staleTime: 60_000 });
    return <p data-testid="landed">home</p>;
  }
  it.each(['redeemed', 'already_member'])('%s: a fresh cached "no organisers" home is refetched', async (status) => {
    h.rpc.mockImplementation((fn: string) => (fn === 'redeem_organiser_invite_v1' ? ok({ ok: true, status, organiser_id: 'o1', member_role: 'owner' }) : Promise.reject(new Error(fn))));
    const qc = client();
    qc.setQueryData(organiserHomeQueryKey('u1'), { today: '', organisers: [] });
    const fetchHome = vi.fn().mockResolvedValue({ today: '', organisers: [{ id: 'o1' }] });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[`/invite/${TOKEN}`]}>
          <Routes>
            <Route path="/invite/:token" element={<InviteRedeemPage />} />
            <Route path="/account/o" element={<HomeProbe fetchHome={fetchHome} />} />
            {/* Arc 1 7c: a new seat lands on the welcome (1d for a first page, 7c for another). */}
            <Route path="/account/o/welcome" element={<HomeProbe fetchHome={fetchHome} />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    // M57: the link is used once the person presses Join on the joining-as card.
    fireEvent.click(await screen.findByTestId('invite-join'));
    await screen.findByTestId('landed');
    await waitFor(() => expect(fetchHome).toHaveBeenCalledTimes(1));
  });
});

function mountAdmin() {
  return render(
    <QueryClientProvider client={client()}>
      <MemoryRouter initialEntries={['/admin/organisers']}>
        <Routes><Route path="/admin/organisers" element={<AdminOrganisersPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const rowOf = async (name: string) => (await screen.findAllByText(name))[0].closest('li') as HTMLElement;
const toggle = (row: HTMLElement) => fireEvent.click(row.querySelector('button')!);

describe('F2 the one-time link survives a collapse until Done', () => {
  it('collapsing is refused with a warning, the link stays, Done clears it', async () => {
    mountAdmin();
    const row = await rowOf('Alpha Unclaimed');
    await waitFor(() => expect(row.getAttribute('data-status')).toBe('unclaimed'));
    toggle(row);
    fireEvent.click(screen.getByTestId('generate-invite'));
    await screen.findByTestId('one-time-link');
    toggle(row);
    expect(screen.getByTestId('link-field')).toBeTruthy();
    expect(screen.getByTestId('link-close-warning').textContent).toBe('Copy the link first: it is shown once.');
    // Switching to another row is refused the same way.
    toggle(await rowOf('Bravo Invited'));
    expect(screen.getAllByTestId('row-detail')).toHaveLength(1);
    expect((screen.getByTestId('link-field') as HTMLInputElement).value).toContain(TOKEN);
    fireEvent.click(screen.getByTestId('link-done'));
    expect(screen.queryByTestId('one-time-link')).toBeNull();
    expect(document.body.innerHTML).not.toContain(TOKEN);
    expect(JSON.stringify(Object.entries(localStorage))).not.toContain(TOKEN);
    toggle(row);
    expect(screen.queryByTestId('row-detail')).toBeNull();
  });

  it('a search that hides the row and clears again does not lose the link', async () => {
    mountAdmin();
    const row = await rowOf('Alpha Unclaimed');
    await waitFor(() => expect(row.getAttribute('data-status')).toBe('unclaimed'));
    toggle(row);
    fireEvent.click(screen.getByTestId('generate-invite'));
    await screen.findByTestId('one-time-link');
    fireEvent.change(screen.getByTestId('admin-search'), { target: { value: 'brav' } });
    fireEvent.change(screen.getByTestId('admin-search'), { target: { value: '' } });
    expect((await screen.findByTestId('link-field') as HTMLInputElement).value).toContain(TOKEN);
  });
});

describe('F3 a row whose reads fail says so and can retry', () => {
  it.each([
    ['ownership', 'o-un', 'Alpha Unclaimed'],
    ['invites', 'o-in', 'Bravo Invited'],
  ])('%s query failing', async (which, id, name) => {
    (which === 'ownership' ? failOwnership : failInvites).add(id);
    mountAdmin();
    const row = await rowOf(name);
    await screen.findAllByTestId('organiser-row');
    toggle(row);
    const err = await screen.findByTestId('row-load-error');
    expect(err.textContent).toContain('Could not load this organiser’s invite status');
    expect((screen.getByTestId('generate-invite') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText('Loading this organiser’s links.')).toBeNull();
    (which === 'ownership' ? failOwnership : failInvites).delete(id);
    fireEvent.click(screen.getByTestId('row-retry'));
    await waitFor(() => expect(row.getAttribute('data-status')).not.toBe('loading'));
    expect(screen.queryByTestId('row-load-error')).toBeNull();
    expect((screen.getByTestId('generate-invite') as HTMLButtonElement).disabled).toBe(false);
  });
});
