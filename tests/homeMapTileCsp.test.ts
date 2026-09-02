/**
 * Binds the basemap hosts to the CSP allowlists.
 *
 * WHY THIS EXISTS. `app/csp.ts` and the two basemap modules hold halves of one
 * fact and nothing connected them. Change the provider and forget the CSP line
 * and every fetch is BLOCKED, which renders as an empty map with no failed
 * request, no console error the user sees, and no red gate:
 * `check-first-load-requests.mjs` excludes images, no e2e spec touches the map,
 * and the hosts appear in no other source file. That is the same
 * 200-OK-but-degraded shape as the CARTO watermark this basemap work removed.
 *
 * It compares the ARTEFACTS, not a pattern over them: the modules are imported
 * and the real `contentSecurityPolicy()` output is parsed. A regex scrape of
 * either source would pass the moment the next author spelled the fact
 * differently.
 *
 * BOTH EDGES ARE PINNED. `permits()` is proven to REJECT as well as accept, so
 * a directive parse that silently matched everything -- the fail-open this
 * guard would otherwise have -- is itself caught. Without that case the suite
 * passes against a `permits()` that returns true unconditionally.
 *
 * THE VECTOR HALF IS NOT img-src. MapLibre fetches the style, TileJSON, .pbf
 * tiles, glyph ranges and the sprite with fetch/XHR, so those hosts have to be
 * on connect-src. They were absent when the vector layer was written, and
 * their absence renders the same empty map.
 *
 * This paragraph used to end "and it builds its worker from a module BLOB, so
 * worker-src has to admit `blob:`". STRUCK, because it is false and it points
 * the reader at the wrong edit: the blob shim is MapLibre's CROSS-origin path
 * only, the worker here is a same-origin Vite asset, and the last case in this
 * file asserts the exact OPPOSITE -- that blob: stays OUT. Anyone who trusted
 * that sentence would widen the CSP and red this suite.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { contentSecurityPolicy } from '../app/csp';
import { TILE_HOSTS, TILE_URL, TILE_REF_URL } from '../src/modules/home-map/basemapTiles';
import { VECTOR_HOSTS, vectorStyleUrl } from '../src/modules/home-map/vectorBasemap';

/** One directive's source list, as the browser would read it. */
function directive(policy: string, name: string): string[] {
  const found = policy
    .split(';')
    .map((d) => d.trim())
    .find((d) => d === name || d.startsWith(`${name} `));
  if (!found) throw new Error(`CSP has no ${name} directive at all`);
  return found.split(/\s+/).slice(1);
}

/** CSP host matching, including the one wildcard form this policy uses. */
function permits(sources: string[], host: string): boolean {
  return sources.some((src) => {
    const bare = src.replace(/^https:\/\//, '');
    if (bare === host) return true;
    if (bare.startsWith('*.')) {
      const suffix = bare.slice(1); // ".example.com"
      return host.endsWith(suffix) && host.length > suffix.length;
    }
    return false;
  });
}

describe('home map raster basemap vs CSP img-src', () => {
  const sources = directive(contentSecurityPolicy('test-nonce'), 'img-src');

  it('permits every host the raster fallback fetches tiles from', () => {
    expect(TILE_HOSTS.length).toBeGreaterThan(0);
    for (const host of TILE_HOSTS) {
      expect(permits(sources, host), `img-src does not permit basemap host ${host}`).toBe(true);
    }
  });

  it('covers the meta form too (prerendered routes serve the same tiles)', () => {
    const metaSources = directive(contentSecurityPolicy('test-nonce', { forMeta: true }), 'img-src');
    for (const host of TILE_HOSTS) {
      expect(permits(metaSources, host), `meta img-src does not permit ${host}`).toBe(true);
    }
  });

  it('rejects a host that is not listed', () => {
    // The second edge. Without this, `permits()` could return true for anything
    // and the two cases above would still pass -- a guard that gates nothing.
    expect(permits(sources, 'tiles.example.invalid')).toBe(false);
    expect(permits(sources, 'basemaps.cartocdn.com')).toBe(false);
  });

  it('derives its hosts from the URLs the map actually uses', () => {
    // Pins TILE_HOSTS to its own inputs, so emptying or hardcoding it cannot
    // make the assertions above vacuously true.
    for (const url of [TILE_URL, TILE_REF_URL]) {
      expect(TILE_HOSTS).toContain(new URL(url.replace(/\{[a-z]\}/g, '0')).host);
    }
  });
});

describe('home map vector basemap vs CSP connect-src', () => {
  const connect = directive(contentSecurityPolicy('test-nonce'), 'connect-src');

  it('permits every host MapLibre fetches from', () => {
    expect(VECTOR_HOSTS.length).toBeGreaterThan(0);
    for (const host of VECTOR_HOSTS) {
      expect(permits(connect, host), `connect-src does not permit vector host ${host}`).toBe(true);
    }
  });

  it('covers the meta form too', () => {
    const meta = directive(contentSecurityPolicy('test-nonce', { forMeta: true }), 'connect-src');
    for (const host of VECTOR_HOSTS) {
      expect(permits(meta, host), `meta connect-src does not permit ${host}`).toBe(true);
    }
  });

  it('rejects a vector-shaped host that is not listed', () => {
    // Second edge, again. `arcgis.com` is deliberately close to the real
    // entries: a wildcard slipped into the policy would light this up.
    expect(permits(connect, 'tiles.arcgis.example.invalid')).toBe(false);
    expect(permits(connect, 'arcgis.com')).toBe(false);
  });

  // Cleanup belongs HERE, not at the end of the test body. `vi.unstubAllEnvs()`
  // as the last statement of a test only runs when every assertion above it
  // passed, and vitest.config.ts sets no `unstubEnvs: true` -- so one failure
  // in the case below used to leak VITE_ARCGIS_API_KEY='' into every later test
  // in the worker, turning a single red into a cascade pointing at innocent
  // files. afterEach runs on the failing path too.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('derives its hosts from the style URL the layer actually builds', () => {
    // Pins VECTOR_HOSTS to a real input the same way the raster case does.
    // BOTH env states are stubbed rather than either being assumed: a
    // developer checkout has a real VITE_ARCGIS_API_KEY in .env and CI does
    // not, so an assertion that read the ambient value would pass on one
    // machine and fail on the other. (It did: this test was first written
    // expecting null and reddened against a local .env.)
    vi.stubEnv('VITE_ARCGIS_API_KEY', 'test-key');
    const url = vectorStyleUrl();
    expect(url).not.toBeNull();
    expect(VECTOR_HOSTS).toContain(new URL(url as string).host);
    expect(url).toContain('token=test-key');

    // The fallback edge: no key means no style URL, which is what sends
    // EventMap to the raster pair instead of drawing an empty map.
    vi.stubEnv('VITE_ARCGIS_API_KEY', '');
    expect(vectorStyleUrl()).toBeNull();
  });

  it('admits that two of the three hosts are hand-written, and pins what it can', () => {
    // HONEST SCOPE, recorded because the green here is narrower than it looks.
    // The case above derives basemapstyles-api.arcgis.com from the URL the
    // layer really builds. The other two entries -- the tile/glyph server and
    // the sprite CDN -- appear in no artefact this process can reach: they are
    // named inside the STYLE DOCUMENT, which only exists over the network and
    // behind the one token-gated endpoint. So they are asserted to be
    // well-formed and distinct, and nothing more.
    //
    // What that leaves open, stated rather than papered over: if Esri moves
    // tiles, glyphs or sprites to a host not on this list, THIS SUITE STAYS
    // GREEN and the map draws nothing. That failure is caught by the runtime
    // fallback in EventMap (a style/GPU error swaps in the raster pair), not
    // here. Do not read this case as coverage of the whole list.
    expect(new Set(VECTOR_HOSTS).size).toBe(VECTOR_HOSTS.length);
    for (const host of VECTOR_HOSTS) {
      expect(host, `${host} is not a bare host`).toMatch(/^[a-z0-9.-]+\.arcgis\.com$/);
    }
  });
});

describe('MapLibre worker vs CSP worker-src', () => {
  it('declares worker-src at all, in both delivery forms', () => {
    // What this pins is that worker sources stay NARROWED to same-origin. It
    // is NOT that the worker would otherwise be blocked: worker-src falls back
    // to child-src and then script-src, script-src here carries `'self'` with
    // no 'strict-dynamic', and that already permits the same-origin worker
    // asset. The claim that used to sit here -- "without the directive the
    // worker never starts ... the map renders empty at HTTP 200" -- is struck
    // as a wrong cause; see app/csp.ts for what the empty map actually was.
    //
    // `directive()` THROWS when the name is absent, so deleting the line from
    // csp.ts fails here rather than passing vacuously -- that throw is this
    // case's second edge.
    for (const opts of [undefined, { forMeta: true }]) {
      const sources = directive(contentSecurityPolicy('test-nonce', opts), 'worker-src');
      expect(sources).toContain("'self'");
    }
  });

  it('does NOT carry blob:, which MapLibre only needs cross-origin', () => {
    // Not a style preference -- a measured claim. MapLibre wraps its worker in
    // a blob module shim only when the worker URL is CROSS-origin (`Oi()` gates
    // it on `Ci()`, an origin comparison). EventMap passes a Vite-emitted
    // same-origin asset URL, and the browser confirmed the direct
    // `new Worker(url, {type:'module'})` path with no blob: worker created.
    //
    // This case exists so that re-adding blob: is a DECISION with a failing
    // test in front of it, not a quiet widening. If the assets ever move to a
    // separate CDN origin, blob: becomes genuinely required -- delete this case
    // then, and say why in the same diff.
    const sources = directive(contentSecurityPolicy('test-nonce'), 'worker-src');
    expect(sources).not.toContain('blob:');
  });
});
