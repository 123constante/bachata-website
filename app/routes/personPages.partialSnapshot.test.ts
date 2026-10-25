/**
 * People arc S7c item 2-3: a person snapshot whose DJ read or teacher RPC failed still answers (the
 * page stays up, missing that tab), but must not be edge-cached for the full hour. Through the REAL
 * loadPersonSnapshot (supabase faked at its boundary), seedPersonSnapshot, cacheTags, taggedData and
 * cacheHeaders, so the asserted headers are the served ones, for /dancers/:id (flags.personWorlds)
 * and /people/:id (flags.personHub). Flag OFF: main's headers, byte for byte.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { edgeCacheControl } from '../edgeCacheControl';

const { ID, h } = vi.hoisted(() => ({ ID: '0f8fad5b-d9cb-469f-a165-70867728950e', h: {
  flags: { personWorlds: true, personHub: true, teacherDetail: true } as Record<string, boolean>,
  djFails: false,
  teacherFails: false,
  rolesDeployed: true,
} }));
vi.mock('@/lib/featureFlags', async (orig) => ({ flags: new Proxy((await orig<typeof import('@/lib/featureFlags')>()).flags, { get: (t, k: string) => (k in h.flags ? h.flags[k] : (t as Record<string, unknown>)[k]) }) }));
vi.mock('@/App', async () => {
  const { QueryClient: QC } = await import('@tanstack/react-query');
  return { createServerQueryClient: () => new QC({ defaultOptions: { queries: { retry: false } } }) };
});
vi.mock('@/pages/DancerProfile', () => ({ default: () => null }));
vi.mock('@/modules/person-page/PersonPage', () => ({ default: () => null }));
vi.mock('@/integrations/supabase/client', () => {
  const row = { id: ID, first_name: 'Ana', avatar_url: null, cities: { name: 'London' }, dancing_role_details: null };
  const chain = { select: () => chain, eq: () => chain, not: () => chain, maybeSingle: async () => ({ data: row, error: null }) };
  return {
    supabase: {
      from: () => chain,
      rpc: async (fn: string) => {
        if (fn === 'get_public_person_roles_v1') {
          return h.rolesDeployed ? { data: ['teacher', 'dj', 'dancer'], error: null } : { data: null, error: { code: '42883' } };
        }
        if (fn === 'get_public_dj_v1') return h.djFails ? { data: null, error: { code: '57014' } } : { data: { id: ID }, error: null };
        return h.teacherFails ? { data: null, error: { code: '57014' } } : { data: [{ entity_id: ID }], error: null };
      },
    },
  };
});
vi.mock('@/modules/profile/dancerPublicProfile', async (orig) => ({
  ...(await orig<typeof import('@/modules/profile/dancerPublicProfile')>()),
  attachPublicDancerName: async (d: Record<string, unknown>) => ({ ...d, surname: null, display_name: 'Ana' }),
}));
vi.mock('@/modules/dancer-app/public-page/loadPublicPage', () => ({
  DEGRADED_EDGE_TTL_SECONDS: 60,
  PUBLIC_PAGE_DEADLINE_MS: 2000,
  loadPublicPageV2: async () => ({ page: null, degraded: false }),
}));
vi.mock('../lib/ssrLoaderTimeout', () => ({ withSsrLoaderTimeout: (_n: string, f: unknown) => f }));
vi.mock('../detailLoader', async (orig) => ({
  ...(await orig<typeof import('../detailLoader')>()),
  resolveEntityInLoader: async () => ({ id: ID, slug: 'ana-g' }),
  throwDetailNotFound: () => { throw new Error('404'); },
  redirectUuidToSlug: () => {},
  normalizeOgImage: () => 'og',
}));

import * as dancers from './dancers';
import * as people from './people';

type Served = { data: unknown; init: { headers: Record<string, string> } };
type Route = { loader: unknown; headers: unknown };
const serve = async (route: Route, path: string) => {
  const r = await (route.loader as (a: unknown) => Promise<Served>)({
    params: { id: 'ana-g' },
    request: new Request(`https://x.test${path}`),
  });
  const served = (route.headers as (a: unknown) => Record<string, string>)({ loaderHeaders: new Headers(r.init.headers) });
  return { tag: served['Vercel-Cache-Tag'], edge: served['Vercel-CDN-Cache-Control'] };
};
const maxAge = (edge: string) => Number(/s-maxage=(\d+)/.exec(edge)?.[1]);
const FULL = maxAge(edgeCacheControl());
const BOUND = maxAge(edgeCacheControl(60));
const MAIN_TAG = `dancer-${ID},dancers`;
const ROLE_TAG = `dancer-${ID},dj-${ID},teacher-${ID},dancers`;

const ROUTES = [
  { name: '/dancers/:id', flag: 'personWorlds', route: dancers, path: '/dancers/ana-g' },
  { name: '/people/:id', flag: 'personHub', route: people, path: '/people/ana-g' },
];
const READS = [
  { name: 'neither fails', dj: false, teacher: false },
  { name: 'DJ read fails', dj: true, teacher: false },
  { name: 'teacher RPC fails', dj: false, teacher: true },
  { name: 'both fail', dj: true, teacher: true },
];
// Prod has get_public_person_roles_v1 (roles from the DB: the teacher answer is not used, so its
// failure loses nothing); the fallback infers roles from the reads, where it does.
const ROLES = [
  { name: 'roles from the DB', deployed: true },
  { name: 'roles inferred', deployed: false },
];
const rows = ROUTES.flatMap((r) =>
  ROLES.flatMap((roles) => READS.flatMap((x) => [true, false].map((on) => ({ ...r, roles, reads: x, on })))),
);

beforeEach(() => {
  h.flags.personWorlds = true;
  h.flags.personHub = true;
  h.djFails = false;
  h.teacherFails = false;
  h.rolesDeployed = true;
});

describe('S7c: a partial person snapshot bounds the edge TTL, through the served headers', () => {
  it.each(rows)('$name, flag $flag $on, $roles.name, $reads.name', async (r) => {
    h.flags[r.flag] = r.on;
    h.rolesDeployed = r.roles.deployed;
    h.djFails = r.reads.dj;
    h.teacherFails = r.reads.teacher;
    const s = await serve(r.route, r.path);
    if (r.on) {
      expect(s.tag).toBe(ROLE_TAG);
      // The bound only for a partial answer; a complete one keeps the full TTL.
      const partial = r.reads.dj || (r.reads.teacher && !r.roles.deployed);
      expect(maxAge(s.edge)).toBe(partial ? BOUND : FULL);
    } else {
      // Flag OFF: main's tag and edge directive, byte for byte, whatever the reads did.
      expect(s.tag).toBe(MAIN_TAG);
      expect(s.edge).toBe(edgeCacheControl());
    }
  });
});
