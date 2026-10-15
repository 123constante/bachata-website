/**
 * TEST UTIL (never imported by app code). One call gives a wave-2 test the
 * router, a signed-in (or signed-out) person, the gate, the profile-completeness
 * context and the in-memory backend:
 *
 *   // once per test file, at the top (vi.mock is hoisted):
 *   vi.mock('@/hooks/useAuth', async (importOriginal) =>
 *     (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));
 *
 *   const { backend } = renderInShell({ path: '/app/me/edit', backend: { shape: 'nameCityOnly' } });
 *   afterEach(resetShell);
 *
 * CityProvider is mounted as in production. Routes mounted: /app/* (the real DancerAppRoutes: AuthGuard + gate + shell),
 * today's /account, /account/dancer, /finish-profile wrapped in the real
 * RedirectIfAllowed around stub pages, /account/o and /auth stubs, and a
 * catch-all stub. `location()` reads the current URL.
 */
import type { ReactElement, ReactNode } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { CityProvider } from '@/contexts/CityContext';
import { ProfileGateContext, type ProfileGateValue } from '@/hooks/useAuth';
import { profileGateValue, type ProfileCompletionStatus } from '@/lib/profileCompletion';
import { myAccessRequestsQueryKey, organiserHomeQueryKey } from '@/modules/organiser/shared/selfServeApi';
import { setFakeBackend } from '../api/rpc';
import { createFakeBackend, type FakeBackendOptions, type FakeDancerBackend } from '../api/fakeBackend';
import { FAKE_USER_ID } from '../api/fixtures';
import { setDancerAnalyticsUser } from '../analytics/events';
import { RedirectIfAllowed } from '../gate/RedirectIfAllowed';
import { DancerAppRoutes } from './DancerAppRoutes';
import { setTestUser, type TestUser } from './testAuth';

export type RenderInShellOptions = {
  /** Initial URL. Default /app/home. */
  path?: string;
  /** 'signed-out', or the person. Default: a signed-in person (FAKE_USER_ID). */
  auth?: 'signed-out' | TestUser;
  /** A backend you built, or options for a new one. Default: allowed, fourFieldComplete. */
  backend?: FakeDancerBackend | FakeBackendOptions;
  /**
   * ProfileGateContext (what AppChrome publishes). Default: from the backend's
   * profile (complete / incomplete / no_profile); null when signed out.
   */
  profileGate?: ProfileCompletionStatus | 'loading' | null;
  /**
   * The organiser reads RedirectIfAllowed uses, pre-seeded into the cache (so no
   * real request): counts, or 'fail' for a failed read, or 'pending' to leave
   * it loading. Default 0 organisers, 0 open requests.
   */
  organisers?: number | 'fail' | 'pending';
  openRequests?: number | 'fail' | 'pending';
  /** Extra <Route> elements, e.g. a page under test outside /app. */
  extraRoutes?: ReactNode;
};

export type RenderInShellResult = RenderResult & {
  backend: FakeDancerBackend;
  queryClient: QueryClient;
  /** pathname + search of the router right now. */
  location: () => string;
};

/** Renders the router's pathname + search; RenderInShellResult.location() reads it back from the DOM. */
const LocationProbe = () => {
  const loc = useLocation();
  return <span data-testid="test-location" hidden>{`${loc.pathname}${loc.search}`}</span>;
};

const Stub = ({ id }: { id: string }) => <div data-testid={`today-${id}`}>today {id}</div>;

const isBackend = (b: unknown): b is FakeDancerBackend => typeof b === 'object' && b !== null && 'calls' in b;

const seed = (qc: QueryClient, userId: string, organisers: RenderInShellOptions['organisers'], openRequests: RenderInShellOptions['openRequests']) => {
  const put = (key: readonly unknown[], v: number | 'fail' | 'pending' | undefined, make: (n: number) => unknown) => {
    // An in-flight fetch that never settles: the hook joins it instead of calling the real fetcher.
    if (v === 'pending') {
      void qc.prefetchQuery({ queryKey: key, queryFn: () => new Promise<never>(() => {}) });
      return;
    }
    // A failed read; retryOnMount off so the hook keeps the error instead of calling the real fetcher.
    if (v === 'fail') {
      qc.setQueryDefaults(key, { retryOnMount: false });
      void qc.prefetchQuery({ queryKey: key, queryFn: () => Promise.reject(new Error('read failed')), retry: false });
      return;
    }
    qc.setQueryData(key, make(v ?? 0));
  };
  put(organiserHomeQueryKey(userId), organisers, (n) => ({ organisers: Array.from({ length: n }, (_, i) => ({ id: `org-${i}` })) }));
  put(myAccessRequestsQueryKey(userId), openRequests, (n) => Array.from({ length: n }, (_, i) => ({ id: `req-${i}`, status: 'open' })));
};

const gateFromStatus = (status: ProfileCompletionStatus | 'loading' | null): ProfileGateValue | 'loading' | null => {
  if (status === null) return null;
  if (status === 'loading') return 'loading';
  return profileGateValue({ status, missing: [], profileId: null });
};

// Radix (the Switch inside HideSurnameSwitch on Edit) measures with ResizeObserver, which jsdom lacks.
class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }

export const renderInShell = (opts: RenderInShellOptions = {}): RenderInShellResult => {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverStub;
  const backend = isBackend(opts.backend) ? opts.backend : createFakeBackend(opts.backend);
  setFakeBackend(backend);

  const user = opts.auth === 'signed-out' ? null : opts.auth ?? { id: FAKE_USER_ID };
  setTestUser(user);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0, staleTime: Infinity, gcTime: Infinity } },
  });
  if (user) seed(queryClient, user.id, opts.organisers, opts.openRequests);

  const profile = backend.current();
  const derived: ProfileCompletionStatus | null = !user ? null : !profile ? 'no_profile' : profile.complete ? 'complete' : 'incomplete';
  const gate = gateFromStatus(opts.profileGate !== undefined ? opts.profileGate : derived);

  const ui: ReactElement = (
    <QueryClientProvider client={queryClient}>
      <ProfileGateContext.Provider value={gate}>
        <MemoryRouter initialEntries={[opts.path ?? '/app/home']}>
          <LocationProbe />
          {/* Production mounts CityProvider above every route (W2b: Home's calendar reads the active city). */}
          <CityProvider>
          <Routes>
            <Route path="/app/*" element={<DancerAppRoutes />} />
            <Route path="/account" element={<RedirectIfAllowed><Stub id="account" /></RedirectIfAllowed>} />
            <Route path="/account/dancer" element={<RedirectIfAllowed><Stub id="account-dancer" /></RedirectIfAllowed>} />
            <Route path="/finish-profile" element={<RedirectIfAllowed><Stub id="finish-profile" /></RedirectIfAllowed>} />
            <Route path="/account/o/*" element={<Stub id="organiser-home" />} />
            <Route path="/auth" element={<Stub id="auth" />} />
            {opts.extraRoutes}
            <Route path="*" element={<Stub id="elsewhere" />} />
          </Routes>
          </CityProvider>
        </MemoryRouter>
      </ProfileGateContext.Provider>
    </QueryClientProvider>
  );

  const result = render(ui);
  const location = () => result.container.querySelector('[data-testid="test-location"]')?.textContent ?? '';
  return { ...result, backend, queryClient, location };
};

/** afterEach: real backend back, nobody signed in, no analytics identity. */
export const resetShell = (): void => {
  setFakeBackend(null);
  setTestUser(null);
  setDancerAnalyticsUser(null);
};
