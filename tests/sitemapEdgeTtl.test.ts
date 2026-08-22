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

// Chainable no-op query builder: every method returns itself, and the object
// resolves (via `then`) to an empty, error-free result -- enough for every
// fetcher in the sitemap loader to complete with zero rows.
const emptyQuery: Record<string, unknown> = {};
for (const method of ['select', 'eq', 'neq', 'order', 'limit']) {
  emptyQuery[method] = () => emptyQuery;
}
(emptyQuery as { then: PromiseLike<unknown>['then'] }).then = (resolve) =>
  Promise.resolve({ data: [], error: null }).then(resolve as never);

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => emptyQuery },
}));

vi.mock('@/lib/featureFlags', () => ({
  flags: {
    teachersDirectory: false,
    organisersDirectory: false,
    venueDetail: false,
    organiserDetail: false,
    teacherDetail: false,
  },
}));

describe('sitemap edge TTL', () => {
  it('calls edgeCacheControl() -- not a restated literal -- for its header', async () => {
    const { loader } = await import('../app/routes/sitemap');
    const result = await loader();
    expect(result.headers.get('Vercel-CDN-Cache-Control')).toBe(SENTINEL);
  });
});
