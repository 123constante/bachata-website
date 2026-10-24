// @vitest-environment jsdom
/**
 * People arc S7: /dancers/:id with flags.personWorlds reads the person's roles in the LOADER, so the
 * served HTML already holds the role tabs and the preview reserve (S6 critique finding 1: CLS 0.13-0.16
 * on dancers who also DJ). Table-driven over the prod shapes (survey 2026-10-24, counts only): dancer
 * only / DJ holder / teacher holder with teacher pages closed / holds both, each with a slug. The
 * chain under test is the real one: loader -> dehydrate -> hydrate -> renderToString -> hydrateRoot.
 * Flag OFF, a failed read and a late read must serve exactly what main serves (no tabs, same meta);
 * since S7b a failed or late read bounds the edge TTL (app/routes/dancers.cacheTags.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { act } from 'react';
import { HydrationBoundary, QueryClient, QueryClientProvider, type DehydratedState } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { installJsdomPolyfills } from '../../tests/client/jsdomPolyfills';

const h = vi.hoisted(() => ({
  flags: { personWorlds: true, teacherDetail: false, personHub: false } as Record<string, boolean>,
  snapshot: vi.fn(),
  /** true = the REAL loadPersonSnapshot (roles RPC + closed-page filter) over the rpc answers below. */
  real: false,
  rpc: {} as Record<string, unknown>,
  fromCalls: 0,
}));
vi.mock('@/lib/featureFlags', async (orig) => ({ flags: new Proxy((await orig<typeof import('@/lib/featureFlags')>()).flags, { get: (t, k: string) => (k in h.flags ? h.flags[k] : (t as Record<string, unknown>)[k]) }) }));
vi.mock('@/App', async () => {
  const { QueryClient: QC } = await import('@tanstack/react-query');
  return { createServerQueryClient: () => new QC({ defaultOptions: { queries: { retry: false } } }) };
});
vi.mock('@/pages/DancerProfile', () => ({ default: () => null }));
vi.mock('@/integrations/supabase/client', () => {
  const row = { id: 'p1', name: 'Ana', avatar_url: null };
  const chain = { select: () => chain, eq: () => chain, not: () => chain, maybeSingle: async () => ({ data: row, error: null }) };
  const answer = (fn: string) => (fn in h.rpc ? h.rpc[fn] : { data: null, error: null });
  return { supabase: { from: () => { h.fromCalls += 1; return chain; }, rpc: async (fn: string) => answer(fn) } };
});
vi.mock('@/modules/profile/dancerPublicProfile', () => ({
  DANCER_PUBLIC_COLS: '*',
  attachPublicDancerName: async (d: unknown) => d,
  mapDancerPublicProfile: (d: { name: string }) => ({
    displayName: d.name, avatarUrl: null, city: null, connectLinks: {}, favoriteStyles: [], achievements: [], yearsDancing: null, partnerRole: null,
  }),
}));
vi.mock('@/modules/person-page/reads', async (orig) => {
  const real = (await orig<typeof import('@/modules/person-page/reads')>()).loadPersonSnapshot;
  return { loadPersonSnapshot: (...a: Parameters<typeof real>) => (h.real ? real(...a) : h.snapshot(...a)) };
});
vi.mock('@/modules/dancer-app/public-page/loadPublicPage', () => ({
  DEGRADED_EDGE_TTL_SECONDS: 60,
  PUBLIC_PAGE_DEADLINE_MS: 30,
  loadPublicPageV2: async () => ({ page: null, degraded: false }),
}));
vi.mock('../lib/ssrLoaderTimeout', () => ({ withSsrLoaderTimeout: (_n: string, f: unknown) => f }));
vi.mock('../cacheTags', () => ({ stampDancer: () => 'tag' }));
vi.mock('../detailLoader', () => ({
  resolveEntityInLoader: async () => ({ id: 'p1', slug: 'ana-g' }),
  throwDetailNotFound: () => { throw new Error('404'); },
  cacheHeaders: () => ({}),
  taggedData: (d: unknown, tag: unknown, opts?: unknown) => ({ d, tag, opts }),
  redirectUuidToSlug: () => {},
  normalizeOgImage: () => 'og',
}));
// The teacher / DJ date reads: in flight (the reserve's case), as on the server's first render.
vi.mock('@/hooks/useProfileProgramAppearances', () => ({
  useProfileProgramAppearances: (_t: string, id: string | undefined) =>
    ({ data: undefined, isPending: true, isError: false, fetchStatus: id ? 'fetching' : 'idle' }),
}));

import { loader } from './dancers';
import { DancerWorldPage } from '@/modules/person-page/worlds/dancer/DancerWorldPage';

type Loaded = { d: { dehydratedState: DehydratedState; entityName: unknown; entitySlug: unknown; ogImage: unknown; publicPage: unknown }; tag: unknown; opts: unknown };
const run = () =>
  (loader as unknown as (a: unknown) => Promise<Loaded>)({ params: { id: 'ana-g' }, request: new Request('https://x.test/dancers/ana-g') });

const snap = (roles: string[], heldRoles = roles) => ({ id: 'p1', name: 'Ana', avatarUrl: null, city: null, instagramUrl: null, roles, heldRoles, djPhoto: null });

const page = (state: DehydratedState, qc: QueryClient) => (
  <QueryClientProvider client={qc}>
    <HydrationBoundary state={state}>
      <MemoryRouter initialEntries={['/dancers/ana-g']}>
        <DancerWorldPage
          id="p1"
          slug="ana-g"
          input={{ name: 'Ana', photo: null, nationality: null, city: null, danceRole: null, languages: null, contacts: [] }}
          shareTitle="Ana"
          inviteHref={null}
          breadcrumbs={[]}
        />
      </MemoryRouter>
    </HydrationBoundary>
  </QueryClientProvider>
);
const serve = (state: DehydratedState) => {
  const host = document.createElement('div');
  host.innerHTML = renderToString(page(state, new QueryClient()));
  return host;
};
// React 18: "Text content did not match", "Expected server HTML to contain", "Did not expect server
// HTML to contain", "...while hydrating"; the message is the first argument (the rest is the stack).
const mismatches = (err: { mock: { calls: unknown[][] } }) =>
  err.mock.calls.filter((c) => /hydrat|did not match|server HTML|server[- ]rendered/i.test(String(c[0])));
const tabs = (host: HTMLElement) => [...host.querySelectorAll('[data-testid="role-tab"]')].map((e) => e.getAttribute('data-role'));
const reserve = (host: HTMLElement) => !!host.querySelector('[data-testid="dancer-world-preview-reserve"]');

beforeEach(() => {
  installJsdomPolyfills();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  h.flags.personWorlds = true;
  h.flags.teacherDetail = false;
  h.snapshot.mockReset();
  h.real = false;
  h.rpc = {};
  h.fromCalls = 0;
});
afterEach(() => { vi.restoreAllMocks(); });

// prod 2026-10-24: dancer only 36, DJ 14, both 26 (teacher pages closed: teacher is held, not shown).
const SHAPES: { name: string; roles: string[]; held?: string[]; open?: boolean; tabs: string[]; reserve: boolean }[] = [
  { name: 'dancer only', roles: ['dancer'], tabs: [], reserve: false },
  { name: 'DJ holder', roles: ['dj', 'dancer'], tabs: ['dj', 'dancer'], reserve: true },
  { name: 'teacher holder, teacher pages closed', roles: ['dancer'], held: ['teacher', 'dancer'], tabs: [], reserve: false },
  { name: 'teacher + DJ, teacher pages closed', roles: ['dj', 'dancer'], held: ['teacher', 'dj', 'dancer'], tabs: ['dj', 'dancer'], reserve: true },
  { name: 'teacher + DJ, teacher pages open', roles: ['teacher', 'dj', 'dancer'], open: true, tabs: ['teacher', 'dj', 'dancer'], reserve: true },
];

describe('S7: the served HTML of /dancers/:id holds the role tabs (flag ON)', () => {
  it.each(SHAPES)('$name: tabs $tabs, reserve $reserve', async (s) => {
    h.flags.teacherDetail = !!s.open;
    h.snapshot.mockResolvedValue(snap(s.roles, s.held));
    const r = await run();
    const host = serve(r.d.dehydratedState);
    expect(tabs(host).sort()).toEqual([...s.tabs].sort());
    expect(reserve(host)).toBe(s.reserve);
    // A closed teacher role never links: no tab and no preview link to a 404.
    if (!s.open) expect(host.querySelector('a[href^="/teachers/"]')).toBeNull();
  });

  it('hydrates identically: no mismatch warning, tabs stay, no refetch on mount while fresh', async () => {
    h.snapshot.mockResolvedValue(snap(['dj', 'dancer']));
    const state = (await run()).d.dehydratedState;
    const host = serve(state);
    document.body.appendChild(host);
    h.snapshot.mockClear();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => { hydrateRoot(host, page(state, new QueryClient())); });
    expect(mismatches(err)).toEqual([]);
    expect(tabs(host)).toEqual(['dj', 'dancer']);
    expect(h.snapshot).not.toHaveBeenCalled();
    host.remove();
  });

  it('negative control: the mismatch check catches a client that renders without the seed', async () => {
    h.snapshot.mockResolvedValue(snap(['dj', 'dancer']));
    const state = (await run()).d.dehydratedState;
    const host = serve(state);
    document.body.appendChild(host);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const unseeded = { ...state, queries: state.queries.filter((q) => q.queryKey[0] !== 'person-snapshot') };
    await act(async () => { hydrateRoot(host, page(unseeded, new QueryClient()), { onRecoverableError: (e) => console.error(String(e)) }); });
    expect(mismatches(err).length).toBeGreaterThan(0);
    host.remove();
  });

  it('a stale seed (edge-cached HTML) is refetched after mount', async () => {
    h.snapshot.mockResolvedValue(snap(['dj', 'dancer']));
    const state = (await run()).d.dehydratedState;
    for (const q of state.queries) q.state.dataUpdatedAt -= 10 * 60 * 1000;
    const host = serve(state);
    document.body.appendChild(host);
    h.snapshot.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => { hydrateRoot(host, page(state, new QueryClient())); });
    expect(h.snapshot).toHaveBeenCalledWith(expect.anything(), 'p1');
    host.remove();
  });
});

// The REAL snapshot read: get_public_person_roles_v1 answers what the person HOLDS; the closed-page
// filter (derivePersonRoles, teacher pages closed on prod) must drop teacher before anything renders.
const DJ_ROW = { data: { id: 'p1', photo_url: null }, error: null };
const REAL: { name: string; held: string[]; dj: boolean; teacherOpen: boolean; tabs: string[]; reserve: boolean }[] = [
  { name: 'dancer only', held: ['dancer'], dj: false, teacherOpen: false, tabs: [], reserve: false },
  { name: 'DJ holder', held: ['dj', 'dancer'], dj: true, teacherOpen: false, tabs: ['dj', 'dancer'], reserve: true },
  { name: 'teacher holder, pages closed', held: ['teacher', 'dancer'], dj: false, teacherOpen: false, tabs: [], reserve: false },
  { name: 'teacher + DJ, pages closed', held: ['teacher', 'dj', 'dancer'], dj: true, teacherOpen: false, tabs: ['dj', 'dancer'], reserve: true },
  { name: 'teacher holder, pages open', held: ['teacher', 'dancer'], dj: false, teacherOpen: true, tabs: ['teacher', 'dancer'], reserve: true },
];

describe('S7: the real snapshot read in the loader (closed-page filter included)', () => {
  it.each(REAL)('$name: tabs $tabs, reserve $reserve, never a /teachers link while closed', async (s) => {
    h.real = true;
    h.flags.teacherDetail = s.teacherOpen;
    h.rpc = {
      get_public_person_roles_v1: { data: s.held, error: null },
      get_public_dj_v1: s.dj ? DJ_ROW : { data: null, error: null },
      get_public_teacher_detail_v1: { data: s.held.includes('teacher') ? [{ id: 'p1' }] : [], error: null },
    };
    const r = await run();
    const host = serve(r.d.dehydratedState);
    expect(tabs(host).sort()).toEqual([...s.tabs].sort());
    expect(reserve(host)).toBe(s.reserve);
    if (!s.teacherOpen) expect(host.querySelector('a[href^="/teachers/"]')).toBeNull();
    // One dancer read: the snapshot's joins the loader's own (same key, issued first).
    expect(h.fromCalls).toBe(1);
  });

  it('roles RPC not deployed (PGRST202): the inferred fallback still seeds, closed teacher still dropped', async () => {
    h.real = true;
    h.rpc = {
      get_public_person_roles_v1: { data: null, error: { code: 'PGRST202', message: 'missing' } },
      get_public_dj_v1: DJ_ROW,
    };
    const r = await run();
    expect(tabs(serve(r.d.dehydratedState)).sort()).toEqual(['dancer', 'dj']);
  });

  it('roles RPC errors: no seed, page served as main serves it', async () => {
    h.real = true;
    h.rpc = { get_public_person_roles_v1: { data: null, error: { code: '57014', message: 'timeout' } } };
    const r = await run();
    expect(r.d.dehydratedState.queries.some((q) => q.queryKey[0] === 'person-snapshot')).toBe(false);
    expect(r.d.entityName).toBe('Ana');
  });
});

describe('S7: everything else stays as main serves it', () => {
  const baseline = async () => {
    h.flags.personWorlds = false;
    const r = await run();
    h.flags.personWorlds = true;
    return r;
  };
  // bounded: S7b (owner call 2) -- a seed that did not answer caps the edge TTL at 60 s; all else as main.
  const same = (a: Loaded, b: Loaded, bounded = false) => {
    expect(a.d.entityName).toBe(b.d.entityName);
    expect(a.d.entitySlug).toBe(b.d.entitySlug);
    expect(a.d.ogImage).toBe(b.d.ogImage);
    expect(a.d.publicPage).toBe(b.d.publicPage);
    expect(a.opts).toEqual(bounded ? { edgeTtlBoundSeconds: 60 } : b.opts);
  };

  it('flag OFF: no roles read and only the dancer read in the dehydrated state', async () => {
    const r = await baseline();
    expect(h.snapshot).not.toHaveBeenCalled();
    expect(r.d.dehydratedState.queries.map((q) => q.queryKey)).toEqual([['dancer-profile', 'p1']]);
    expect(tabs(serve(r.d.dehydratedState))).toEqual([]);
  });

  // stampDancer is mocked here: the real tag ON vs OFF is asserted in dancers.cacheTags.test.ts (S7b).
  it('flag ON: meta and TTL equal flag OFF', async () => {
    h.snapshot.mockResolvedValue(snap(['dj', 'dancer']));
    same(await run(), await baseline());
  });

  it('read fails: page still served, no tabs, no seed, same meta, TTL bounded (S7b)', async () => {
    h.snapshot.mockRejectedValue(new Error('boom'));
    const r = await run();
    expect(r.d.dehydratedState.queries.some((q) => q.queryKey[0] === 'person-snapshot')).toBe(false);
    expect(tabs(serve(r.d.dehydratedState))).toEqual([]);
    same(r, await baseline(), true);
  });

  it('read late (past its deadline): page served without waiting for it, no tabs, same meta, TTL bounded (S7b)', async () => {
    let answer: (v: unknown) => void = () => {};
    h.snapshot.mockReturnValue(new Promise((res) => { answer = res; }));
    const r = await run();
    expect(r.d.dehydratedState.queries.some((q) => q.queryKey[0] === 'person-snapshot')).toBe(false);
    expect(tabs(serve(r.d.dehydratedState))).toEqual([]);
    answer(snap(['dj', 'dancer']));
    same(r, await baseline(), true);
  });
});
