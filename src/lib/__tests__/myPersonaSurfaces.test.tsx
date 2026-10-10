// @vitest-environment jsdom
/**
 * Every "my profile" surface x every persona shape. An account can be LINKED to
 * an admin-made dancer profile (dancer_profiles.claimed_by); the server's
 * `_my_dancer_profile_id_v1()` is the one answer to "which profile is mine". A
 * surface that keys on auth.uid() instead shows a linked person their empty
 * sign-up stub. The mapping under test is lib/myPersona (personaIdForReads,
 * isMyProfile), shared by every surface below.
 *
 * Shapes:
 * - own stub only      : resolver -> the account id
 * - linked             : resolver -> a DIFFERENT id (the admin-made profile)
 * - no persona         : resolver -> NULL (no row to read: today's "no row" path)
 * - resolver error     : the call failed -> the account id (today's behaviour)
 * - archived-stub URL  : DancerProfile only (the linked account's old stub page)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
// jsdom has no IntersectionObserver; the dashboard's lazy sections ask for one.
(globalThis as { IntersectionObserver?: unknown }).IntersectionObserver ??= NoopObserver;

const ACCOUNT = 'acct-1';
const ADMIN_PROFILE = 'admin-made-1';
const STRANGER = 'stranger-1';

const COMPLETE_ROW = {
  first_name: 'Ana',
  surname: 'B',
  based_city_id: 'c1',
  dance_role: 'Follower',
  avatar_url: 'https://x/y.jpg',
  meta_data: null,
  dancing_role_details: null,
};

type Persona = { kind: 'id'; id: string | null } | { kind: 'error' };

const h = vi.hoisted(() => {
  const state = {
    persona: { kind: 'id', id: 'acct-1' } as { kind: 'id'; id: string | null } | { kind: 'error' },
    reads: [] as string[],
    rows: {} as Record<string, Record<string, unknown>>,
    rpcs: [] as string[],
    navigations: [] as string[],
  };
  // A PostgREST builder stand-in: every method chains, `eq('id', x)` on
  // dancer_profiles is recorded, maybeSingle/single answer from `rows`.
  const chain = (table: string) => {
    let id: string | null = null;
    const builder: Record<string | symbol, unknown> = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'then') {
            return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
              Promise.resolve({ data: [], error: null }).then(res, rej);
          }
          if (prop === 'eq') {
            return (col: string, val: string) => {
              if (table === 'dancer_profiles' && col === 'id') {
                state.reads.push(val);
                id = val;
              }
              return builder;
            };
          }
          if (prop === 'maybeSingle' || prop === 'single') {
            return async () => ({
              data: table === 'dancer_profiles' && id ? (state.rows[id] ? { id, ...state.rows[id] } : null) : null,
              error: null,
            });
          }
          return () => builder;
        },
      },
    );
    return builder;
  };
  const user = { id: 'acct-1', is_anonymous: false };
  return { state, chain, user };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => h.chain(table),
    rpc: async (name: string) => {
      h.state.rpcs.push(name);
      return { data: [], error: null };
    },
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  },
}));
vi.mock('@/integrations/supabase/rpcLoose', () => ({
  rpcLoose: async (fn: string) => {
    if (fn === '_my_dancer_profile_id_v1') {
      const p = h.state.persona;
      return p.kind === 'error' ? { data: null, error: { message: 'boom' } } : { data: p.id, error: null };
    }
    return { data: null, error: null };
  },
}));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  // ONE object: a fresh user per render re-runs every [user] effect forever.
  useAuth: () => ({
    user: h.user,
    isLoading: false,
    authStatus: 'ready',
    retryAuth: () => {},
  }),
}));
vi.mock('@/modules/organiser/shared/ownershipApi', () => ({ fetchCurrentUserOrganiserIds: async () => [] }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/lib/seo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/seo')>()),
  useSeo: () => {},
  useEntitySlugOrId: (param: string | undefined) => ({ id: param ?? null, slug: null, arrivedViaUuid: true }),
  useCanonicalReplaceState: () => {},
}));
vi.mock('@/contexts/CityContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/contexts/CityContext')>()),
  useCity: () => ({ citySlug: null, cityId: null, cityName: null, setCity: () => {}, cities: [], loading: false }),
}));
vi.mock('@/components/profile/DancerProfileGrid', () => ({ DancerProfileGrid: () => null }));

import { AuthGuard } from '@/components/auth/AuthGuard';
import { useUserIds } from '@/hooks/useUserIds';
import EditProfile from '@/pages/EditProfile';
import PracticePartners from '@/pages/PracticePartners';
import DancerProfile from '@/pages/DancerProfile';
import { DancerDashboard } from '@/components/profile/DancerDashboard';
import { isMyProfile, personaIdForReads } from '@/lib/myPersona';

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const wrap = (ui: ReactNode, path = '/') => (
  <QueryClientProvider client={client()}>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>home</p>} />
        <Route path="/profile" element={ui} />
        <Route path="/edit-profile" element={ui} />
        <Route path="/practice-partners" element={ui} />
        <Route path="/dancers/:id" element={ui} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>
);

/** What each shape must read: the row id the surface keys on, or none at all. */
const SHAPES: { name: string; persona: Persona; reads: string | null }[] = [
  { name: 'own stub only', persona: { kind: 'id', id: ACCOUNT }, reads: ACCOUNT },
  { name: 'linked to an admin-made profile', persona: { kind: 'id', id: ADMIN_PROFILE }, reads: ADMIN_PROFILE },
  { name: 'no persona (NULL)', persona: { kind: 'id', id: null }, reads: null },
  { name: 'resolver error', persona: { kind: 'error' }, reads: ACCOUNT },
];

beforeEach(() => {
  h.state.reads = [];
  h.state.rpcs = [];
  h.state.rows = { [ACCOUNT]: { ...COMPLETE_ROW }, [ADMIN_PROFILE]: { ...COMPLETE_ROW } };
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(cleanup);

describe('the shared mapping (lib/myPersona)', () => {
  it.each([
    [{ status: 'resolved', id: ADMIN_PROFILE } as const, ADMIN_PROFILE],
    [{ status: 'resolved', id: ACCOUNT } as const, ACCOUNT],
    [{ status: 'none' } as const, null],
    [{ status: 'error' } as const, ACCOUNT],
  ])('personaIdForReads(%o) = %s', (resolution, expected) => {
    expect(personaIdForReads(resolution, ACCOUNT)).toBe(expected);
  });

  it.each([
    ['my linked persona', ADMIN_PROFILE, ADMIN_PROFILE, true],
    ['my archived stub, while linked', ACCOUNT, ADMIN_PROFILE, true],
    ['my own stub, not linked', ACCOUNT, ACCOUNT, true],
    ['a stranger, while linked', STRANGER, ADMIN_PROFILE, false],
    ['a stranger, no persona', STRANGER, null, false],
    ['my stub, no persona yet', ACCOUNT, null, true],
    ['nothing loaded', null, ADMIN_PROFILE, false],
  ] as const)('isMyProfile: %s', (_name, viewedId, personaId, expected) => {
    expect(isMyProfile({ viewedId, personaId, accountId: ACCOUNT })).toBe(expected);
  });
});

describe.each(SHAPES)('persona shape: $name', ({ persona, reads }) => {
  beforeEach(() => {
    h.state.persona = persona;
  });

  const expectReads = async () => {
    if (reads) {
      await waitFor(() => expect(h.state.reads).toContain(reads));
      // Never the account's stub when the persona is somewhere else.
      if (reads !== ACCOUNT) expect(h.state.reads).not.toContain(ACCOUNT);
    } else {
      // Give the effects time to run, then: no row was asked for.
      await new Promise((r) => setTimeout(r, 30));
      expect(h.state.reads).toEqual([]);
    }
  };

  it('AuthGuard: the onboarding gate reads the persona', async () => {
    render(wrap(<AuthGuard><p>inside</p></AuthGuard>, '/profile'));
    await expectReads();
  });

  it('useUserIds: dancerId is the persona (Profile, VendorDashboard inherit it)', async () => {
    const { result } = renderHook(() => useUserIds(), {
      wrapper: ({ children }) => <QueryClientProvider client={client()}>{children}</QueryClientProvider>,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expectReads();
    expect(result.current.dancerId).toBe(reads);
    expect(result.current.dancerProfileComplete).toBe(Boolean(reads));
  });

  it('EditProfile: the form loads the persona', async () => {
    render(wrap(<EditProfile />, '/edit-profile'));
    await expectReads();
  });

  it('DancerDashboard: the dashboard loads the persona', async () => {
    render(wrap(<DancerDashboard />, '/profile'));
    await expectReads();
  });

  it('PracticePartners: "my profile" for matching is the persona', async () => {
    render(wrap(<PracticePartners />, '/practice-partners'));
    await expectReads();
  });
});

describe('DancerProfile: isSelfView (attendance is fetched only on my own page)', () => {
  it.each([
    ['linked: my admin-made profile', { kind: 'id', id: ADMIN_PROFILE }, ADMIN_PROFILE, true],
    ['linked: my archived stub URL', { kind: 'id', id: ADMIN_PROFILE }, ACCOUNT, true],
    ['linked: a stranger', { kind: 'id', id: ADMIN_PROFILE }, STRANGER, false],
    ['own stub: my page', { kind: 'id', id: ACCOUNT }, ACCOUNT, true],
    ['own stub: a stranger', { kind: 'id', id: ACCOUNT }, STRANGER, false],
    ['no persona: a stranger', { kind: 'id', id: null }, STRANGER, false],
    ['resolver error: my stub', { kind: 'error' }, ACCOUNT, true],
    ['resolver error: a stranger', { kind: 'error' }, STRANGER, false],
  ] as [string, Persona, string, boolean][])('%s', async (_name, persona, viewedId, self) => {
    h.state.persona = persona;
    h.state.rows[STRANGER] = { ...COMPLETE_ROW };
    render(wrap(<DancerProfile />, `/dancers/${viewedId}`));
    if (self) {
      await waitFor(() => expect(h.state.rpcs).toContain('get_my_event_attendance_v2'));
    } else {
      await new Promise((r) => setTimeout(r, 80));
      expect(h.state.rpcs).not.toContain('get_my_event_attendance_v2');
    }
  });
});
