// @vitest-environment jsdom
/** {signed out, non-admin, admin} x /admin/organisers, plus the row/invite-state matrix. The /invite journey is in join/__tests__/joinJourney.test.tsx (W1, Option B). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

const TOKEN = 'cd'.repeat(32);
const h = vi.hoisted(() => ({
  auth: { user: null as null | { id: string }, authStatus: 'ready' as 'ready' | 'resolving' },
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
vi.mock('@/components/layout/GlobalLayout', () => ({
  default: ({ children, breadcrumbs }: { children: ReactNode; breadcrumbs?: { label: string }[] }) => (
    <div data-testid="layout" data-crumbs={(breadcrumbs ?? []).map((b) => b.label).join('>')}>{children}</div>
  ),
}));
vi.mock('@/components/auth/AuthGuard', async () => {
  const { Navigate } = await import('react-router-dom');
  return { AuthGuard: ({ children }: { children: ReactNode }) => (h.auth.user ? <>{children}</> : <Navigate to="/auth?mode=signin&returnTo=%2Fadmin%2Forganisers" replace />) };
});
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => h.rpc(...a),
    from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: h.organisers, error: null }) }) }) }),
  },
}));

import AdminOrganisersPage from '../AdminOrganisersPage';

const ok = (data: unknown) => Promise.resolve({ data, error: null });
let managedIds: Set<string>;
let invitesFor: Record<string, unknown[]>;

function rpcImpl(isAdmin: boolean) {
  h.rpc.mockImplementation((fn: string, args: Record<string, unknown>) => {
    switch (fn) {
      case 'admin_is_admin': return ok(isAdmin);
      case 'organiser_ownership_v1': return ok({ is_managed: managedIds.has(args.p_organiser_id as string) });
      case 'admin_list_organiser_invites_v1': return ok(invitesFor[args.p_organiser_id as string] ?? []);
      case 'admin_issue_organiser_invite_v1': return ok({ ok: true, invite_id: 'i9', organiser_id: args.p_organiser_id, token: TOKEN, expires_at: '2026-10-18T10:00:00Z', email_bound: false, revoked_previous: [] });
      case 'admin_list_invite_requests_v1': return ok([]);
      case 'admin_list_signup_access_requests_v1': return ok([]);
      case 'admin_revoke_organiser_invite_v1': return ok({ revoked: 1 });
      case 'admin_add_entity_member_v1': return ok({ id: 'm1' });
      default: return Promise.reject(new Error(`unexpected rpc ${fn}`));
    }
  });
}

function Where() { const l = useLocation(); return <p data-testid="where">{l.pathname}{l.search}</p>; }
function mount(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Where />
        <Routes>
          <Route path="/admin/organisers" element={<AdminOrganisersPage />} />
          <Route path="/account/o" element={<p data-testid="landed">dashboard</p>} />
          {/* Arc 1 7c: a new seat lands on the welcome (1d for a first page, 7c for another). */}
          <Route path="/account/o/welcome" element={<p data-testid="landed">dashboard</p>} />
          <Route path="/auth" element={<p data-testid="auth">sign in</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const ORGS = [
  { id: 'o-un', name: 'Alpha Unclaimed', lifecycle_status: 'live' },
  { id: 'o-in', name: 'Bravo Invited', lifecycle_status: 'live' },
  { id: 'o-ex', name: 'Charlie Expired', lifecycle_status: 'live' },
  { id: 'o-mg', name: 'Delta Managed', lifecycle_status: 'live' },
];
const sent = { invite_id: 'i1', status: 'sent', issued_at: '2026-10-10T10:00:00Z', expires_at: '2026-10-17T10:00:00Z' };
const expired = { invite_id: 'i2', status: 'expired', issued_at: '2026-09-01T10:00:00Z', expires_at: '2026-09-08T10:00:00Z' };

beforeEach(() => {
  h.auth.user = null; h.auth.authStatus = 'ready';
  h.organisers = ORGS;
  managedIds = new Set(['o-mg']);
  invitesFor = { 'o-in': [sent], 'o-ex': [expired] };
  h.rpc.mockReset();
});
afterEach(cleanup);

describe('/admin/organisers x viewer', () => {
  it('signed out: sent to sign in, no admin RPC called', async () => {
    rpcImpl(true);
    mount('/admin/organisers');
    expect(await screen.findByTestId('auth')).toBeTruthy();
    expect(h.rpc).not.toHaveBeenCalledWith('redeem_organiser_invite_v1', expect.anything());
  });

  it('signed in, not an admin: a plain page that names nothing about the screen', async () => {
    h.auth.user = { id: 'u1' };
    rpcImpl(false);
    mount('/admin/organisers');
    expect(await screen.findByTestId('admin-not-available')).toBeTruthy();
    expect(screen.queryByTestId('admin-organisers')).toBeNull();
    expect(screen.getByTestId('layout').getAttribute('data-crumbs')).toBe('');
    expect(screen.getByTestId('layout').textContent).not.toMatch(/invite|organiser access|admin/i);
    expect(h.rpc.mock.calls.map((c) => c[0])).toEqual(['admin_is_admin']);
  });

  it('admin: the list, breadcrumbs, and an invite read for every visible row, managed included', async () => {
    h.auth.user = { id: 'a1' };
    rpcImpl(true);
    mount('/admin/organisers');
    expect(await screen.findByTestId('admin-organisers')).toBeTruthy();
    expect(screen.getByTestId('layout').getAttribute('data-crumbs')).toBe('Organiser access');
    await waitFor(() => expect(screen.getAllByTestId('organiser-row').map((r) => r.getAttribute('data-status'))).toEqual(['unclaimed', 'invited', 'invite_expired', 'managed']));
    const listed = h.rpc.mock.calls.filter((c) => c[0] === 'admin_list_organiser_invites_v1').map((c) => (c[1] as { p_organiser_id: string }).p_organiser_id).sort();
    expect(listed).toEqual(['o-ex', 'o-in', 'o-mg', 'o-un']);
  });

  it('the counts use the same mapping as the rows', async () => {
    h.auth.user = { id: 'a1' };
    rpcImpl(true);
    mount('/admin/organisers');
    await waitFor(() => expect(screen.getByTestId('count-invited').textContent).toContain('1'));
    for (const s of ['unclaimed', 'invited', 'invite_expired', 'managed']) {
      expect(screen.getByTestId(`count-${s}`).textContent).toContain('1');
      expect(screen.getByTestId(`count-${s}`).querySelector('[data-testid="status-tag"]')?.getAttribute('data-status')).toBe(s);
    }
  });

  it('search narrows by name and an empty search says what to do', async () => {
    h.auth.user = { id: 'a1' };
    rpcImpl(true);
    mount('/admin/organisers');
    await screen.findAllByTestId('organiser-row');
    fireEvent.change(screen.getByTestId('admin-search'), { target: { value: 'brav' } });
    expect(screen.getAllByTestId('organiser-row')).toHaveLength(1);
    fireEvent.change(screen.getByTestId('admin-search'), { target: { value: 'zzz' } });
    expect(screen.getByTestId('admin-empty').textContent).toContain('Clear the search');
  });
});

describe('row actions x invite state', () => {
  const open = async (name: string) => {
    h.auth.user = { id: 'a1' };
    rpcImpl(true);
    mount('/admin/organisers');
    const row = (await screen.findAllByText(name))[0].closest('li') as HTMLElement;
    await waitFor(() => expect(row.getAttribute('data-status')).not.toBe('loading'));
    fireEvent.click(row.querySelector('button')!);
    return row;
  };
  const issueCalls = () => h.rpc.mock.calls.filter((c) => c[0] === 'admin_issue_organiser_invite_v1');

  // One button per row (5a, 5d, 5e, 5f); Withdraw only beside a live link; a live link is replaced only after the form says so.
  it.each([
    ['Alpha Unclaimed', { primary: 'Invite', choose: true, withdraw: false, replaces: false }],
    ['Bravo Invited', { primary: 'Copy new link', choose: false, withdraw: true, replaces: true }],
    ['Charlie Expired', { primary: 'Send a new link', choose: false, withdraw: false, replaces: false }],
    ['Delta Managed', { primary: 'Add another person', choose: true, withdraw: false, replaces: false }],
  ])('%s', async (name, want) => {
    await open(name);
    const primary = screen.getByTestId('row-primary') as HTMLButtonElement;
    expect(primary.textContent).toBe(want.primary);
    expect(primary.disabled).toBe(false);
    expect(screen.queryByTestId('withdraw-invite') !== null).toBe(want.withdraw);
    fireEvent.click(primary);
    if (want.choose) {
      expect(screen.getByTestId('invite-choices').textContent).toContain('Send a link');
      fireEvent.click(screen.getByTestId('choice-link'));
    }
    expect(screen.queryByTestId('link-replaces-note') !== null).toBe(want.replaces);
    expect(issueCalls()).toHaveLength(0);
    fireEvent.click(screen.getByTestId('link-submit'));
    expect((await screen.findByTestId('link-field') as HTMLInputElement).value).toBe(`${window.location.origin}/invite/${TOKEN}`);
    expect(issueCalls()[0][1]).toEqual({ p_organiser_id: ORGS.find((o) => o.name === name)!.id, p_email: null, p_first_name: null, p_city_id: null });
  });

  it('shows the link once with a WhatsApp message; Copy is the primary; Done drops it and the token is nowhere else', async () => {
    await open('Alpha Unclaimed');
    fireEvent.click(screen.getByTestId('row-primary'));
    fireEvent.click(screen.getByTestId('choice-link'));
    fireEvent.click(screen.getByTestId('link-submit'));
    await screen.findByTestId('one-time-link');
    expect(screen.getByTestId('link-once-note').textContent).toBe('Shown once. Works once, runs out in 7 days.');
    expect(screen.getByTestId('copy-link').className).toContain('bg-primary');
    const wa = screen.getByTestId('whatsapp-link') as HTMLAnchorElement;
    expect(wa.href.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(wa.href)).toContain(TOKEN);
    expect(wa.rel).toContain('noreferrer');
    fireEvent.click(screen.getByTestId('link-done'));
    expect(screen.queryByTestId('one-time-link')).toBeNull();
    expect(document.body.innerHTML).not.toContain(TOKEN);
    expect(JSON.stringify(Object.entries(localStorage))).not.toContain(TOKEN);
  });

  it('withdraws a live link', async () => {
    await open('Bravo Invited');
    fireEvent.click(screen.getByTestId('withdraw-invite'));
    await waitFor(() => expect(h.rpc.mock.calls.some((c) => c[0] === 'admin_revoke_organiser_invite_v1')).toBe(true));
  });

  it('add person ("They already have an account"): disabled with a reason until an email is entered, then calls the RPC', async () => {
    await open('Alpha Unclaimed');
    fireEvent.click(screen.getByTestId('row-primary'));
    fireEvent.click(screen.getByTestId('choice-existing'));
    expect((screen.getByTestId('add-submit') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('add-note').textContent).toMatch(/Enter their email/);
    fireEvent.change(screen.getByTestId('add-email'), { target: { value: 'ana@example.com' } });
    fireEvent.change(screen.getByTestId('add-role'), { target: { value: 'contributor' } });
    fireEvent.click(screen.getByTestId('add-submit'));
    await screen.findByTestId('add-done');
    expect(h.rpc).toHaveBeenCalledWith('admin_add_entity_member_v1', { p_entity_type: 'organiser', p_entity_id: 'o-un', p_email: 'ana@example.com', p_member_role: 'contributor', p_is_primary: false });
  });

  it('add person: a refusal reads in plain English', async () => {
    await open('Alpha Unclaimed');
    fireEvent.click(screen.getByTestId('row-primary'));
    fireEvent.click(screen.getByTestId('choice-existing'));
    const base = h.rpc.getMockImplementation()!;
    h.rpc.mockImplementation((fn: string, a: Record<string, unknown>) => (fn === 'admin_add_entity_member_v1' ? Promise.resolve({ data: null, error: { message: 'user_not_found' } }) : base(fn, a)));
    fireEvent.change(screen.getByTestId('add-email'), { target: { value: 'ghost@example.com' } });
    fireEvent.click(screen.getByTestId('add-submit'));
    expect((await screen.findByTestId('add-error')).textContent).toMatch(/No account has that email address/);
  });
});
