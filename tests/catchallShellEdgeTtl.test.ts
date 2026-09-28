// @vitest-environment node
/**
 * staticShellCacheHeaders() backs the /* catchall's edge caching (see
 * app/routes/catchall.tsx). Two properties matter and neither is visible from
 * reading the emitted string:
 *
 * 1. THE TTL IS DERIVED, not hand-copied. Same rule and same SENTINEL method as
 *    tests/sitemapEdgeTtl.test.ts: comparing against a freshly-computed
 *    edgeCacheControl() proves only that the output happens to match the
 *    function's CURRENT value, which a restated
 *    `"public, s-maxage=3600, stale-while-revalidate=86400"` literal would also
 *    do -- it would catch a future retune of EDGE_S_MAXAGE/EDGE_SWR and would
 *    NOT catch a reversion to a literal today. Mocking the leaf module to
 *    return a value no literal could produce by accident proves the call.
 *
 * 2. IT IS UNBOUNDED, i.e. called with no TTL bound. The catchall has no loader
 *    and no pinned day key, so there is nothing for a bound to protect against;
 *    passing one would silently shorten every shell's life for no reason. The
 *    mock records its arguments so this is asserted rather than assumed.
 *
 * NOT asserted here, deliberately: that catchall.tsx actually calls this. That
 * route statically imports AnimatedRoutes and eagerAuthClient -- the whole
 * client tree -- so importing it in a node test proves nothing about production
 * and costs a pile of mocks. It was verified end-to-end against a running
 * react-router dev server instead (0 occurrences of the header on /teachers
 * before the change at HTTP 200, 1 after), which is the stronger evidence of
 * the two because it exercises the real server runtime's headers() resolution.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const SENTINEL = 'sentinel-shell-cache-control-4c71';

const edgeCacheControlMock = vi.fn(() => SENTINEL);

vi.mock('../app/edgeCacheControl', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../app/edgeCacheControl')>();
  return { ...actual, edgeCacheControl: edgeCacheControlMock };
});

const { staticShellCacheHeaders, cacheHeaders } = await import('../app/detailLoader');

describe('staticShellCacheHeaders', () => {
  beforeEach(() => {
    edgeCacheControlMock.mockClear();
  });

  it('derives Vercel-CDN-Cache-Control from edgeCacheControl() rather than a literal', () => {
    expect(staticShellCacheHeaders()['Vercel-CDN-Cache-Control']).toBe(SENTINEL);
    expect(edgeCacheControlMock).toHaveBeenCalledTimes(1);
  });

  it('asks for the UNBOUNDED policy -- no TTL bound argument', () => {
    staticShellCacheHeaders();
    expect(edgeCacheControlMock).toHaveBeenCalledWith();
  });

  it('emits no Vercel-Cache-Tag: a deploy is the purge, so there is no tag to write', () => {
    expect(staticShellCacheHeaders()).not.toHaveProperty('Vercel-Cache-Tag');
  });

  it('keeps the browser on the same no-store convention as every tagged route', () => {
    // Compared against cacheHeaders' OWN output rather than the literal
    // "public, max-age=0, must-revalidate", so the two cannot drift apart the
    // day BROWSER_NO_STORE is retuned -- the same derivation rule this file
    // enforces for the edge header one test up.
    const tagged = cacheHeaders(new Headers({ 'Vercel-Cache-Tag': 'any-tag' }));
    expect(staticShellCacheHeaders()['Cache-Control']).toBe(tagged['Cache-Control']);
  });

  it('REFUSES the untagged-loader path: cacheHeaders() with no tag still emits no edge caching', () => {
    // The negative case, and the reason the two are separate entry points. A
    // route that loses its loader must go UNCACHED, not silently inherit this
    // function's constant-output policy. If this ever starts returning an edge
    // header, the safe default is gone and staticShellCacheHeaders' own doc
    // comment has stopped being true.
    expect(cacheHeaders(new Headers())).not.toHaveProperty('Vercel-CDN-Cache-Control');
  });
});
