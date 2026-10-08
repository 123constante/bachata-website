// @vitest-environment jsdom
/**
 * Team page load (2026-10-08 owner report: three grey bars for seconds). The
 * organiser_home_v1 read starts while the page chunk is still downloading
 * (OrganiserRoutes prefetches it once auth is known), and the skeleton is the
 * page's own frame (the Team card and its fixed note), not anonymous bars.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, type ReactNode } from 'react';

const rpc = vi.hoisted(() => vi.fn(() => new Promise(() => {})));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc, from: () => ({}) } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'me@x.example' }, session: null }) }));

afterEach(() => { cleanup(); rpc.mockClear(); vi.doUnmock('@/lib/lazyWithRetry'); vi.resetModules(); });

const wrap = (node: ReactNode, path: string) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
  </QueryClientProvider>
);

describe('team page load', () => {
  it('reads organiser_home_v1 while the page chunk is still loading (no chunk -> RPC waterfall)', async () => {
    // A page chunk that never arrives: this stand-in replaces lazyWithRetry itself.
    // eslint-disable-next-line local/no-bare-lazy-imports
    vi.doMock('@/lib/lazyWithRetry', () => ({ lazyWithRetry: () => lazy(() => new Promise(() => {})) }));
    const { default: OrganiserRoutes } = await import('../../shell/OrganiserRoutes');
    render(wrap(<Routes><Route path="/account/o/*" element={<OrganiserRoutes />} /></Routes>, '/account/o/team'));
    expect(screen.getByTestId('org-route-loading')).toBeTruthy();
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledWith('organiser_home_v1'));
  });

  it('while the team loads, the skeleton is the Team card with its fixed note', async () => {
    const { default: TeamPage } = await import('../index');
    render(wrap(<Routes><Route path="/account/o/team" element={<TeamPage />} /></Routes>, '/account/o/team'));
    expect(screen.getByTestId('team-loading')).toBeTruthy();
    expect(screen.getByTestId('team-list')).toBeTruthy();
    expect(screen.getByTestId('team-note').textContent).toMatch(/Owners add and remove people/);
  });
});
