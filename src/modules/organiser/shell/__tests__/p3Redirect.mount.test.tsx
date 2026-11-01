// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { AccountGateStatus } from '@/lib/accountGate';

// Brief p3-landing-r2 item 2: MOUNT OrganiserRoutes (not just the pure r1AreaRedirect) and prove the
// wiring -- /account/o/events/:id -> /account/p3/events/:id while P3 is live; ?legacy=1 keeps the old
// area and sticks for the tab; the redirect runs BEFORE AuthGuard (a signed-out visitor is never asked
// to sign in to R1 first); flag OFF = no redirect, R1 exactly as before.

const state = vi.hoisted(() => ({
  gate: 'complete' as AccountGateStatus,
  flags: { organiserP3: false, organiserSelfServe: true },
}));

vi.mock('@/lib/featureFlags', async (orig) => {
  const real = await orig<typeof import('@/lib/featureFlags')>();
  // Getters: OrganiserRoutes is re-imported per mount (vi.resetModules) and reads them then.
  const flags = { ...real.flags } as Record<string, boolean>;
  Object.defineProperty(flags, 'organiserP3', { get: () => state.flags.organiserP3 });
  Object.defineProperty(flags, 'organiserSelfServe', { get: () => state.flags.organiserSelfServe });
  return { ...real, flags };
});
vi.mock('@/lib/accountGate', () => ({
  useAccountGate: () => ({ status: state.gate, dancerProfileId: state.gate === 'complete' ? 'p1' : null, deletion: null }),
}));
// AuthGuard marks that the old area's sign-in wrapper rendered (signed-out: it would ask to sign in).
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <div data-testid="auth-guard">{children}</div> }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: () => new Promise(() => {}), from: () => ({}) } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, session: null }) }));

vi.setConfig({ testTimeout: 20_000 });

const ON = { organiserP3: true, organiserSelfServe: true };
const OFF = { organiserP3: false, organiserSelfServe: true };

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
}

async function mount(at: string, flags: typeof ON, gate: AccountGateStatus = 'complete') {
  state.flags = flags;
  state.gate = gate;
  vi.resetModules();
  const { default: OrganiserRoutes } = await import('../OrganiserRoutes');
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path="/account/o/*" element={<OrganiserRoutes />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const where = async () => (await screen.findByTestId('where')).textContent;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-01T12:00:00Z')); // inside the legacy window (to 7 Dec)
  window.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('OrganiserRoutes mounted: /account/o/* while P3 is live', () => {
  it.each([
    ['/account/o/events/ev-1', '/account/p3/events/ev-1'],
    ['/account/o/events/ev-1?o=org-2', '/account/p3/events/ev-1?o=org-2'],
    ['/account/o', '/account/p3'],
    ['/account/o/team', '/account/p3/you/team'],
  ])('%s -> %s, AuthGuard never renders', async (from, to) => {
    await mount(from, ON);
    expect(await where()).toBe(to);
    expect(screen.queryByTestId('auth-guard')).toBeNull();
  });

  it('signed-out: the redirect runs BEFORE AuthGuard (lands on P3, which owns its own sign-in)', async () => {
    await mount('/account/o/events/ev-1', ON, 'signed-out');
    expect(await where()).toBe('/account/p3/events/ev-1');
    expect(screen.queryByTestId('auth-guard')).toBeNull();
  });

  it('/account/o/complete (the profile wizard P3 links to) stays in R1', async () => {
    await mount('/account/o/complete', ON);
    expect(screen.getByTestId('auth-guard')).toBeTruthy();
    expect(screen.queryByTestId('where')).toBeNull();
  });
});

describe('?legacy=1 keeps the old area and persists per tab', () => {
  it('stays in R1, then a later R1 link without ?legacy stays too (same tab)', async () => {
    await mount('/account/o/events/ev-1?legacy=1', ON);
    expect(screen.getByTestId('auth-guard')).toBeTruthy();
    expect(screen.queryByTestId('where')).toBeNull();
    expect(window.sessionStorage.getItem('organiser.legacyArea')).toBe('1');
    cleanup();
    await mount('/account/o/team', ON);
    expect(screen.getByTestId('auth-guard')).toBeTruthy();
    expect(screen.queryByTestId('where')).toBeNull();
  });

  it('a new tab (empty sessionStorage) is redirected again', async () => {
    await mount('/account/o/events/ev-1?legacy=1', ON);
    cleanup();
    window.sessionStorage.clear();
    await mount('/account/o/events/ev-1', ON);
    expect(await where()).toBe('/account/p3/events/ev-1');
  });

  it('after the window closes (8 Dec, London) ?legacy=1 is ignored', async () => {
    vi.setSystemTime(new Date('2026-12-08T12:00:00Z'));
    await mount('/account/o/events/ev-1?legacy=1', ON);
    expect(await where()).toBe('/account/p3/events/ev-1');
  });
});

describe('flag OFF: no redirect, R1 exactly as before', () => {
  it.each(['/account/o/events/ev-1', '/account/o', '/account/o/team'])('%s stays in R1', async (from) => {
    await mount(from, OFF);
    expect(screen.getByTestId('auth-guard')).toBeTruthy();
    expect(screen.queryByTestId('where')).toBeNull();
  });

  it('OFF never writes the legacy key', async () => {
    await mount('/account/o?legacy=1', OFF);
    expect(window.sessionStorage.getItem('organiser.legacyArea')).toBeNull();
  });

  it('P3 on but self-serve OFF (P3 not mounted): no redirect', async () => {
    await mount('/account/o/events/ev-1', { organiserP3: true, organiserSelfServe: false });
    expect(screen.getByTestId('auth-guard')).toBeTruthy();
  });
});
