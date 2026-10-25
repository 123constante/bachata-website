/**
 * People arc S7b: /dancers/:id with flags.personWorlds serves the role tabs from the loader, so the
 * page must be purged by a DJ or teacher write too (critique #1011 section 5), and a roles seed that
 * did not answer must not be edge-cached for the full hour (section 6). Table-driven over the prod
 * shapes (survey 2026-10-24, counts only) x flag ON/OFF x seed outcomes, through the REAL
 * cacheTags / taggedData / cacheHeaders, so the asserted headers are the served ones.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { edgeCacheControl } from '../edgeCacheControl';
import { stampDancer } from '../cacheTags';

const h = vi.hoisted(() => ({
  flags: { personWorlds: true } as Record<string, boolean>,
  snapshot: vi.fn(),
  row: { id: 'p1', name: 'Ana', avatar_url: null } as Record<string, unknown> | null,
  degraded: false,
  /** Late answers still in flight, awaited after each test so none lands in the next one. */
  late: [] as Promise<unknown>[],
}));
vi.mock('@/lib/featureFlags', async (orig) => ({ flags: new Proxy((await orig<typeof import('@/lib/featureFlags')>()).flags, { get: (t, k: string) => (k in h.flags ? h.flags[k] : (t as Record<string, unknown>)[k]) }) }));
vi.mock('@/App', async () => {
  const { QueryClient: QC } = await import('@tanstack/react-query');
  return { createServerQueryClient: () => new QC({ defaultOptions: { queries: { retry: false } } }) };
});
vi.mock('@/pages/DancerProfile', () => ({ default: () => null }));
vi.mock('@/integrations/supabase/client', () => {
  const chain = { select: () => chain, eq: () => chain, not: () => chain, maybeSingle: async () => ({ data: h.row, error: null }) };
  return { supabase: { from: () => chain, rpc: async () => ({ data: null, error: null }) } };
});
vi.mock('@/modules/profile/dancerPublicProfile', () => ({
  DANCER_PUBLIC_COLS: '*',
  attachPublicDancerName: async (d: unknown) => d,
  mapDancerPublicProfile: (d: { name: string }) => ({ displayName: d.name }),
}));
vi.mock('@/modules/person-page/reads', () => ({ loadPersonSnapshot: (...a: unknown[]) => h.snapshot(...a) }));
vi.mock('@/modules/dancer-app/public-page/loadPublicPage', () => ({
  DEGRADED_EDGE_TTL_SECONDS: 60,
  PUBLIC_PAGE_DEADLINE_MS: 30,
  loadPublicPageV2: async () => ({ page: null, degraded: h.degraded }),
}));
vi.mock('../lib/ssrLoaderTimeout', () => ({ withSsrLoaderTimeout: (_n: string, f: unknown) => f }));
vi.mock('../detailLoader', async (orig) => ({
  ...(await orig<typeof import('../detailLoader')>()),
  resolveEntityInLoader: async () => ({ id: ID, slug: 'ana-g' }),
  throwDetailNotFound: () => { throw new Error('404'); },
  redirectUuidToSlug: () => {},
  normalizeOgImage: () => 'og',
}));

import { loader, headers } from './dancers';

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
type Served = { data: unknown; init: { headers: Record<string, string> } };
const run = async () => {
  const r = (await (loader as unknown as (a: unknown) => Promise<Served>)({
    params: { id: 'ana-g' },
    request: new Request('https://x.test/dancers/ana-g'),
  }));
  const served = (headers as unknown as (a: unknown) => Record<string, string>)({ loaderHeaders: new Headers(r.init.headers) });
  return { tag: served['Vercel-Cache-Tag'], edge: served['Vercel-CDN-Cache-Control'], body: r.data };
};
const maxAge = (edge: string) => Number(/s-maxage=(\d+)/.exec(edge)?.[1]);
// The full edge TTL, and the degraded one (edgeCacheControl owns the store margin it takes off).
const FULL = maxAge(edgeCacheControl());
const BOUND = maxAge(edgeCacheControl(60));

const snap = (roles: string[]) => ({ id: 'p1', name: 'Ana', avatarUrl: null, city: null, instagramUrl: null, roles, heldRoles: roles, djPhoto: null });

// prod 2026-10-24, get_public_person_roles_v1 over dancer_profiles (191; archived = archived_at set).
const SHAPES: { name: string; roles: string[] }[] = [
  { name: 'dancer only (29)', roles: ['dancer'] },
  { name: 'dancer + DJ (10; DJ only 4)', roles: ['dj', 'dancer'] },
  { name: 'dancer + teacher (36; teacher only 62)', roles: ['teacher', 'dancer'] },
  { name: 'all three (25; teacher + DJ 1)', roles: ['teacher', 'dj', 'dancer'] },
  { name: 'no roles, live (5)', roles: [] },
];

// What the seed does. `bounded` = the seed did not answer, so the edge TTL is the degraded 60 s.
const SEEDS: { name: string; arrange: () => void; bounded: boolean }[] = [
  { name: 'answers', arrange: () => {}, bounded: false },
  { name: 'answers null', arrange: () => h.snapshot.mockResolvedValue(null), bounded: false },
  { name: 'fails', arrange: () => h.snapshot.mockRejectedValue(new Error('57014')), bounded: true },
  { name: 'never answers', arrange: () => h.snapshot.mockReturnValue(new Promise(() => {})), bounded: true },
  {
    name: 'answers after the deadline',
    arrange: () => {
      const answer = new Promise((res) => setTimeout(() => res(snap(['dj', 'dancer'])), 80));
      h.late.push(answer);
      h.snapshot.mockReturnValue(answer);
    },
    bounded: true,
  },
];

// main 8d82d611 serves exactly these for a dancer (flag OFF, any shape, any seed).
const MAIN_TAG = `dancer-${ID},dancers`;
const ROLE_TAG = `dancer-${ID},dj-${ID},teacher-${ID},dancers`;

beforeEach(() => {
  h.flags.personWorlds = true;
  h.snapshot.mockReset();
  h.row = { id: 'p1', name: 'Ana', avatar_url: null };
  h.degraded = false;
});
afterEach(async () => {
  await Promise.all(h.late.splice(0));
});

describe('S7b: tags and edge TTL of /dancers/:id', () => {
  const rows = SHAPES.flatMap((s) => SEEDS.map((seed) => ({ ...s, seed })));

  it.each(rows)('flag ON, $name, seed $seed.name: dj + teacher tags, TTL bound only when the seed did not answer', async (r) => {
    h.snapshot.mockResolvedValue(snap(r.roles));
    r.seed.arrange();
    const s = await run();
    // Every shape gets the role tags, roles or not: a NEW DJ / teacher write must purge this page too.
    expect(s.tag).toBe(ROLE_TAG);
    expect(maxAge(s.edge)).toBe(r.seed.bounded ? BOUND : FULL);
  });

  it.each(rows)('flag OFF, $name, seed $seed.name: tag and headers byte-identical to main', async (r) => {
    h.flags.personWorlds = false;
    h.snapshot.mockResolvedValue(snap(r.roles));
    r.seed.arrange();
    const off = await run();
    expect(h.snapshot).not.toHaveBeenCalled();
    expect(off.tag).toBe(MAIN_TAG);
    expect(off.edge).toBe(edgeCacheControl());
  });

  it('flag ON, seed answers: the edge directive equals flag OFF (no bound added on a good answer)', async () => {
    h.snapshot.mockResolvedValue(snap(['dj', 'dancer']));
    const on = await run();
    h.flags.personWorlds = false;
    const off = await run();
    expect(on.edge).toBe(off.edge);
  });

  it('a degraded public-page read still bounds the TTL, flag ON and OFF, seed answered or not', async () => {
    h.degraded = true;
    h.snapshot.mockResolvedValue(snap(['dancer']));
    expect(maxAge((await run()).edge)).toBe(BOUND);
    h.flags.personWorlds = false;
    expect(maxAge((await run()).edge)).toBe(BOUND);
  });

  it('archived (19) / unknown dancer: 404 before any tag is stamped, flag ON and OFF', async () => {
    h.row = null;
    await expect(run()).rejects.toThrow('404');
    h.flags.personWorlds = false;
    await expect(run()).rejects.toThrow('404');
  });

  it('the longest tag header (a person with all three roles) stays far under the Vercel tag limits', () => {
    // Vercel: up to 128 tags per response, 256 characters per tag. Ids are uuids (36 chars).
    const header = stampDancer(ID, true);
    const tags = header.split(',');
    expect(tags.length).toBe(4);
    expect(Math.max(...tags.map((t) => t.length))).toBeLessThanOrEqual(256);
    // 136 characters today (4 tags); the bound is the claim, not the exact count.
    expect(header.length).toBeLessThan(1024);
  });
});
