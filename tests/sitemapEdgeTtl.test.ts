// @vitest-environment node
/**
 * /sitemap.xml's edge TTL must stay derived from edgeCacheControl()'s default,
 * not a hand-copied literal -- see app/routes/sitemap.tsx:208. A restated
 * `"public, s-maxage=3600, stale-while-revalidate=86400"` string can drift
 * silently the day EDGE_S_MAXAGE/EDGE_SWR are retuned in detailLoader.ts,
 * because nothing compares the two.
 *
 * Asserted by SENTINEL, not by value-equality against a freshly-computed
 * edgeCacheControl(): comparing to a fresh call proves only that the header
 * happens to match the function's CURRENT output, which a hardcoded literal
 * at today's values would also do -- catching only a future constant retune,
 * not a reversion to a hand-copied literal right now. Mocking edgeCacheControl()
 * to return a value no hardcoded literal could produce by accident proves the
 * loader actually CALLS it.
 */
import { describe, it, expect, vi } from 'vitest';

const SENTINEL = 'sentinel-edge-cache-control-9f3a';

vi.mock('../app/detailLoader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../app/detailLoader')>();
  return { ...actual, edgeCacheControl: vi.fn(() => SENTINEL) };
});

// Chainable no-op query builder: each ALLOWED method returns the builder, and
// the builder resolves (via `then`) to an empty, error-free result -- enough
// for every fetcher in the sitemap loader to complete with zero rows.
//
// ALLOWED is a closed list rather than a permissive catch-all: a method the
// real PostgrestBuilder would reject must red here too, so anything outside it
// stays `undefined` and still makes the chain throw. The Proxy's only job is to
// RECORD the name on the way past. Without that record the failure is mute --
// app/routes/sitemap.tsx rethrows a bare `new Response(..., { status: 500 })`,
// discarding the cause, so the spec dies on a serialized `Response { status:
// 500 }` naming no method. That is how `.not()` (#329) got past this mock.
//
// `unmocked` is asserted BEFORE the header, because a missing method throws out
// of the loader and would otherwise end the test before the name is reported.
const ALLOWED = new Set(['select', 'eq', 'neq', 'order', 'limit', 'not']);
const unmocked = new Set<string>();

const emptyQuery: Record<string, unknown> = new Proxy(
  {},
  {
    get(_target, prop) {
      if (typeof prop !== 'string') return undefined;
      if (prop === 'then') {
        return (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(resolve);
      }
      if (ALLOWED.has(prop)) return () => emptyQuery;
      unmocked.add(prop);
      return undefined;
    },
  },
) as Record<string, unknown>;

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => emptyQuery },
}));

// Every flag ON, so all five fetchers actually run. Under the shipped defaults
// three of them (fetchVenues, fetchOrganiserProfiles, fetchTeacherProfileIds)
// are skipped, and a builder method missing from ALLOWED in any of those three
// goes undetected: with the flags off, deleting 'neq' -- reached only by
// fetchVenues -- leaves this spec GREEN. The flags are read per-call inside the
// loader, so turning them on here costs nothing but a few more empty chains.
vi.mock('@/lib/featureFlags', () => ({
  flags: {
    teachersDirectory: true,
    organisersDirectory: true,
    venueDetail: true,
    organiserDetail: true,
    teacherDetail: true,
  },
}));

describe('sitemap edge TTL', () => {
  it('calls edgeCacheControl() -- not a restated literal -- for its header', async () => {
    const { loader } = await import('../app/routes/sitemap');

    let result: Response | undefined;
    let thrown: unknown;
    try {
      result = await loader();
    } catch (error) {
      thrown = error;
    }

    // First, so an unmocked builder method is REPORTED BY NAME rather than
    // surfacing as the loader's opaque rethrown 500.
    expect(
      [...unmocked],
      "loader called builder methods absent from the mock's ALLOWED set",
    ).toEqual([]);
    if (thrown) throw thrown;

    expect(result?.headers.get('Vercel-CDN-Cache-Control')).toBe(SENTINEL);
  });
});
