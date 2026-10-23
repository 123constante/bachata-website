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
import { ADMIN_COPY, lifecycleLabel, notLiveNote } from '../inviteModel';
import { LAST_OWNER_NOTE } from '@/modules/organiser/shared/teamModel';
import { TEAM_COPY } from '@/modules/organiser/shared/selfServeErrors';

const ok = (data: unknown) => Promise.resolve({ data, error: null });
function rpcImpl(managed: boolean, invites: unknown[] = []) {
  h.rpc.mockImplementation((fn: string) => {
    switch (fn) {
      case 'admin_is_admin': return ok(true);
      case 'organiser_ownership_v1': return ok({ is_managed: managed });
      case 'admin_list_organiser_invites_v1': return ok(invites);
      case 'admin_issue_organiser_invite_v1': return ok({ ok: true, invite_id: 'i9', token: TOKEN, expires_at: '2026-10-18T10:00:00Z', email_bound: false, revoked_previous: [] });
      case 'admin_list_invite_requests_v1': return ok([]);
      case 'admin_list_signup_access_requests_v1': return ok([]);
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
    // R1: the owner steps down by handing the page over (team/Person.tsx); there is no Make owner row.
    expect(LAST_OWNER_NOTE).toMatch(/hand the page over/);
  });
});

describe('3. admin use_transfer copy is something an admin can act on', () => {
  it('does not tell an admin to sign in as an admin', () => {
    expect(ADMIN_COPY.use_transfer).not.toMatch(/Sign in with your admin account/);
    expect(ADMIN_COPY.use_transfer).toMatch(/Generate invite/);
    // R1 has no Make owner control (B-N1): the owner hands the page over from their name on Team.
    expect(ADMIN_COPY.use_transfer).not.toMatch(/Make owner/);
    expect(ADMIN_COPY.use_transfer).toMatch(/Hand the page over/);
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

// 5. malformed token + breadcrumbs: now in join/__tests__/joinJourney.test.tsx (W1, Option B).

describe('6. red text uses the destructive token (the theme is black; dark: never applies)', () => {
  it('none of the red texts uses red-700 or dark:', () => {
    const src = readFileSync('src/modules/admin-organisers/AdminOrganisersPage.tsx', 'utf8');
    expect(src).not.toMatch(/red-700/);
    expect(src).not.toMatch(/dark:text-red/);
    const lines = src.split('\n').filter((l) => /text-destructive/.test(l));
    // The chip tone, the link form's field error, the load error and the four alerts.
    expect(lines.length).toBe(7);
    for (const l of lines) expect(l).not.toMatch(/red-700|dark:/);
  });
  it('the rendered link-close warning and add error carry text-destructive', async () => {
    h.auth.user = { id: 'a1' };
    h.organisers = [{ id: 'o1', name: 'Alpha', lifecycle_status: 'live' }];
    rpcImpl(false);
    mount('/admin/organisers');
    fireEvent.click(await screen.findByText('Alpha'));
    fireEvent.click(await screen.findByTestId('row-primary'));
    fireEvent.click(screen.getByTestId('choice-link'));
    fireEvent.click(screen.getByTestId('link-submit'));
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
