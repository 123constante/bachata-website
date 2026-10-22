// @vitest-environment jsdom
/** Round-2 fix-up: a managed organiser keeps its live-link actions (G1); the ownership read is refreshed and never lets a stale read claim "owner has since left" (G2). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { accessStatus, rowActions, statusDetail, type InviteRow, type InviteStatus } from '../inviteModel';

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  organisers: [] as { id: string; name: string; lifecycle_status: string }[],
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, authStatus: 'ready' }) }));
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

const inv = (status: InviteStatus): InviteRow => ({ inviteId: `i-${status}`, status, issuedAt: '2026-10-01T10:00:00Z', expiresAt: '2026-10-08T10:00:00Z', usedAt: null, revokedAt: null });
const fmt = (iso: string) => iso.slice(0, 10);
const OWNER_NOTE = 'This organiser already has an owner. A new link would add another owner.';

describe('G1 one mapping: {not managed, managed} x invite state', () => {
  // [managed, invite, badge, detail, confirms, revoke]
  const table: [boolean, InviteStatus | 'none', string, string, boolean, boolean][] = [
    [false, 'none', 'unclaimed', 'No link sent yet.', false, false],
    [false, 'sent', 'invited', 'Link works until 2026-10-08.', true, true],
    [false, 'used', 'unclaimed', 'The last link was used, but the owner has since left.', false, false],
    [false, 'revoked', 'unclaimed', 'The last link was revoked.', false, false],
    [false, 'expired', 'invite_expired', 'The last link ran out on 2026-10-08.', false, false],
    [true, 'none', 'managed', 'Has an owner.', false, false],
    [true, 'sent', 'managed', 'Has an owner. Link works until 2026-10-08.', true, true],
    [true, 'used', 'managed', 'Has an owner.', false, false],
    [true, 'revoked', 'managed', 'Has an owner.', false, false],
    [true, 'expired', 'managed', 'Has an owner.', false, false],
  ];
  it.each(table)('managed=%s invite=%s', (managed, state, badge, detail, confirms, revoke) => {
    const invites = state === 'none' ? [] : [inv(state)];
    const status = accessStatus(managed, invites);
    expect(status).toBe(badge);
    expect(statusDetail(status, invites, fmt)).toBe(detail);
    const a = rowActions(status, invites);
    expect([a.canGenerate, a.generateConfirms, a.canRevoke]).toEqual([true, confirms, revoke]);
    expect(a.generateNote).toBe(managed ? OWNER_NOTE : null);
    if (revoke) expect(a.revokeNote).toBeNull(); else expect(a.revokeNote).toMatch(/no live link/);
  });
});

describe('G2 the "owner has since left" wording needs a fresh ownership read', () => {
  it('is neutral while the read is refreshing', () => {
    expect(statusDetail('unclaimed', [inv('used')], fmt, false)).not.toMatch(/since left/);
    expect(statusDetail('unclaimed', [inv('used')], fmt, false)).toBe('The last link was used.');
  });
});

describe('admin page', () => {
  let ownership: (id: string) => Promise<unknown>;
  let invites: Record<string, unknown[]>;
  const ok = (data: unknown) => Promise.resolve({ data, error: null });
  beforeEach(() => {
    h.organisers = [{ id: 'o1', name: 'Alpha', lifecycle_status: 'live' }];
    invites = {};
    ownership = () => ok({ is_managed: false });
    h.rpc.mockReset().mockImplementation((fn: string, args?: Record<string, unknown>) => {
      const id = args?.p_organiser_id as string;
      if (fn === 'admin_is_admin') return ok(true);
      if (fn === 'organiser_ownership_v1') return ownership(id);
      if (fn === 'admin_list_organiser_invites_v1') return ok(invites[id] ?? []);
      if (fn === 'admin_revoke_organiser_invite_v1') return ok({ revoked: 1 });
      if (fn === 'admin_list_invite_requests_v1' || fn === 'admin_list_signup_access_requests_v1') return ok([]);
      return Promise.reject(new Error(`unexpected rpc ${fn}`));
    });
  });
  afterEach(cleanup);
  const mount = () => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><AdminOrganisersPage /></MemoryRouter>
    </QueryClientProvider>,
  );
  const live = { invite_id: 'i1', status: 'sent', issued_at: '2026-10-10T10:00:00Z', expires_at: '2026-10-17T10:00:00Z' };

  it('G1: a managed organiser shows its live link, lets the admin revoke it and asks before replacing', async () => {
    ownership = () => ok({ is_managed: true });
    invites.o1 = [live];
    mount();
    await waitFor(() => expect(screen.getByTestId('organiser-row').getAttribute('data-status')).toBe('managed'));
    fireEvent.click(screen.getByRole('button', { name: /Alpha/ }));
    await waitFor(() => expect(screen.getByTestId('status-detail').textContent).toMatch(/Has an owner\. A link works until/));
    expect((screen.getByTestId('withdraw-invite') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId('row-primary').textContent).toBe('Add another person');
    fireEvent.click(screen.getByTestId('row-primary'));
    fireEvent.click(screen.getByTestId('choice-link'));
    expect(screen.getByTestId('link-replaces-note').textContent).toMatch(/old one stops working/);
    expect(screen.getByTestId('link-owner-note').textContent).toMatch(/adds another owner/);
  });

  it('G2: opening a row whose cached ownership is stale ends Managed and never claims the owner left', async () => {
    invites.o1 = [{ ...live, status: 'used', used_at: '2026-10-11T09:00:00Z' }];
    let call = 0;
    let release!: () => void;
    ownership = () => (++call === 1 ? ok({ is_managed: false }) : new Promise((res) => { release = () => res({ data: { is_managed: true }, error: null }); }));
    mount();
    await waitFor(() => expect(screen.getByTestId('organiser-row').getAttribute('data-status')).toBe('unclaimed'));
    fireEvent.click(screen.getByRole('button', { name: /Alpha/ }));
    await waitFor(() => expect(call).toBe(2));
    // refetch pending: neutral, never the false fact
    expect(screen.getByTestId('status-detail').textContent).not.toMatch(/since left/);
    release();
    await waitFor(() => expect(screen.getByTestId('organiser-row').getAttribute('data-status')).toBe('managed'));
    expect(screen.getByTestId('status-detail').textContent).toMatch(/^Has an owner\. Joined /);
    expect(document.body.textContent).not.toMatch(/since left/);
  });
});
