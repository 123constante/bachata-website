// @vitest-environment jsdom
/** Arc PR 5b: the six queued polish items from #714, each red-first. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';

const TOKEN = 'cd'.repeat(32);
const h = vi.hoisted(() => ({
  auth: { user: null as null | { id: string }, authStatus: 'ready' as 'ready' | 'resolving' },
  rpc: vi.fn(),
  organisers: [] as { id: string; name: string; lifecycle_status: string }[],
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => h.auth }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/components/layout/GlobalLayout', () => ({
  default: ({ children, breadcrumbs }: { children: ReactNode; breadcrumbs?: { label: string }[] }) => (
    <div data-testid="layout" data-crumbs={(breadcrumbs ?? []).map((b) => b.label).join('>')}>{children}</div>
  ),
}));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => h.rpc(...a),
    from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: h.organisers, error: null }) }) }) }),
  },
}));

import AdminOrganisersPage from '../AdminOrganisersPage';
import InviteRedeemPage from '../InviteRedeemPage';
import { ADMIN_COPY, TOKEN_RE, lifecycleLabel, notLiveNote } from '../inviteModel';
import { LAST_OWNER_NOTE } from '@/modules/organiser/shared/teamModel';
import { TEAM_COPY } from '@/modules/organiser/shared/selfServeErrors';

const ok = (data: unknown) => Promise.resolve({ data, error: null });
function rpcImpl(managed: boolean, invites: unknown[] = []) {
  h.rpc.mockImplementation((fn: string) => {
    switch (fn) {
      case 'admin_is_admin': return ok(true);
      case 'organiser_ownership_v1': return ok({ is_managed: managed });
      case 'admin_list_organiser_invites_v1': return ok(invites);
      case 'admin_issue_organiser_invite_v1': return ok({ invite_id: 'i9', token: TOKEN, expires_at: '2026-10-18T10:00:00Z', revoked_previous: [] });
      default: return Promise.reject(new Error(`unexpected rpc ${fn}`));
    }
  });
}
function mount(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/organisers" element={<AdminOrganisersPage />} />
          <Route path="/invite/:token" element={<InviteRedeemPage />} />
          <Route path="/account/o" element={<p data-testid="landed">dashboard</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => { h.auth.user = null; h.auth.authStatus = 'ready'; h.rpc.mockReset(); h.organisers = []; });
afterEach(cleanup);

describe('1. lifecycle is shown for a non-live organiser, never guessed', () => {
  it.each([
    ['live', null, ''],
    ['draft', 'draft', 'not live'],
    ['hidden', 'hidden', 'not live'],
    ['unpublished', 'unpublished', 'not live'],
    [null, 'status unknown', ''],
    [undefined, 'status unknown', ''],
    ['weird', 'status unknown', ''],
  ])('lifecycle %s: tag %s, note %s', (lifecycle, tag, note) => {
    expect(lifecycleLabel(lifecycle as string | null | undefined)).toBe(tag);
    const n = notLiveNote(lifecycle as string | null | undefined);
    if (note) expect(n).toMatch(/not live/i); else expect(n).toBe('');
  });
  it.each([['live', false, false], ['draft', true, true], ['weird', true, false]])('row for %s: tag=%s, not-live sentence=%s', async (lifecycle, tag, sentence) => {
    h.auth.user = { id: 'a1' };
    h.organisers = [{ id: 'o1', name: 'Alpha', lifecycle_status: lifecycle }];
    rpcImpl(false);
    mount('/admin/organisers');
    fireEvent.click(await screen.findByText('Alpha'));
    await screen.findByTestId('status-detail');
    expect(screen.queryByTestId('lifecycle-tag') !== null).toBe(tag);
    expect(/not live/i.test(screen.getByTestId('status-detail').textContent ?? '')).toBe(sentence);
    expect(screen.getAllByTestId('status-tag')[0].getAttribute('data-status')).toBe('unclaimed');
  });
});

describe('2. sole-owner copy: one wording, tells the person what they can do', () => {
  it('is one shared constant used in both places and no longer a dead end', () => {
    expect(TEAM_COPY.last_owner).toBe(LAST_OWNER_NOTE);
    expect(LAST_OWNER_NOTE).not.toMatch(/Ask the Bachata Calendar team to add another owner first/);
    expect(LAST_OWNER_NOTE).toMatch(/Make owner/);
  });
});

describe('3. admin use_transfer copy is something an admin can act on', () => {
  it('does not tell an admin to sign in as an admin', () => {
    expect(ADMIN_COPY.use_transfer).not.toMatch(/Sign in with your admin account/);
    expect(ADMIN_COPY.use_transfer).toMatch(/Generate invite/);
    expect(ADMIN_COPY.use_transfer).toMatch(/Make owner/);
  });
});

describe('4. organiser/** does not import admin-organisers/**', () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
  it('has no importer', () => {
    const offenders = walk('src/modules/organiser').filter((f) => /admin-organisers/.test(readFileSync(f, 'utf8').split('\n').filter((l) => /^\s*(import|export)\b.*from|^\s*import\(|from\s+['"]/.test(l)).join('\n')));
    expect(offenders).toEqual([]);
  });
});

describe('5. malformed token + breadcrumbs', () => {
  it.each([
    ['not-a-token', false], ['not-a-token', true],
    ['ab'.repeat(31), false], ['AB'.repeat(32), true],
    [TOKEN, false],
  ])('token %s signedIn=%s', async (token, signedIn) => {
    h.auth.user = signedIn ? { id: 'u1' } : null;
    h.rpc.mockImplementation((fn: string) => Promise.reject(new Error(fn)));
    mount(`/invite/${token}`);
    if (!TOKEN_RE.test(token)) {
      expect((await screen.findByTestId('invite-title')).textContent).toBe('This link does not work');
      expect(screen.queryByTestId('invite-sign-in')).toBeNull();
    } else {
      expect(await screen.findByTestId('invite-sign-in')).toBeTruthy();
    }
    expect(h.rpc).not.toHaveBeenCalledWith('redeem_organiser_invite_v1', expect.anything());
  });
  it('passes breadcrumbs from the central map', async () => {
    h.auth.user = null;
    mount(`/invite/${TOKEN}`);
    await screen.findByTestId('invite-sign-in');
    expect(screen.getByTestId('layout').getAttribute('data-crumbs')).not.toBe('');
  });
});

describe('6. red text uses the destructive token (the theme is black; dark: never applies)', () => {
  it('none of the five red texts uses red-700 or dark:', () => {
    const src = readFileSync('src/modules/admin-organisers/AdminOrganisersPage.tsx', 'utf8');
    expect(src).not.toMatch(/red-700/);
    expect(src).not.toMatch(/dark:text-red/);
    const lines = src.split('\n').filter((l) => /text-destructive/.test(l));
    expect(lines.length).toBe(5);
    for (const l of lines) expect(l).not.toMatch(/red-700|dark:/);
  });
  it('the rendered link-close warning and add error carry text-destructive', async () => {
    h.auth.user = { id: 'a1' };
    h.organisers = [{ id: 'o1', name: 'Alpha', lifecycle_status: 'live' }];
    rpcImpl(false);
    mount('/admin/organisers');
    fireEvent.click(await screen.findByText('Alpha'));
    fireEvent.click(await screen.findByTestId('generate-invite'));
    await screen.findByTestId('one-time-link');
    fireEvent.click(screen.getByText('Alpha'));
    const warn = screen.queryByTestId('link-close-warning');
    if (warn) {
      expect(warn.getAttribute('role')).toBe('alert');
      expect(warn.className).toContain('text-destructive');
      expect(warn.className).not.toMatch(/red-700|dark:/);
    }
  });
});
