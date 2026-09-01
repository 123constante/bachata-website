/**
 * Binds the basemap tile hosts to the CSP img-src allowlist.
 *
 * WHY THIS EXISTS. `app/csp.ts` and `src/modules/home-map/basemapTiles.ts` hold
 * two halves of one fact and nothing connected them. Change the tile provider
 * and forget the CSP line and every tile is BLOCKED, which renders as an empty
 * map with no failed request, no console error the user sees, and no red gate:
 * `check-first-load-requests.mjs` excludes images, no e2e spec touches the map,
 * and the tile host appears in no other source file. That is the same
 * 200-OK-but-degraded shape as the CARTO watermark this basemap swap removed.
 *
 * It compares the ARTEFACTS, not a pattern over them: both modules are imported
 * and the real `contentSecurityPolicy()` output is parsed. A regex scrape of
 * either source would pass the moment the next author spelled the same fact
 * differently.
 *
 * BOTH EDGES ARE PINNED. `permits()` is proven to REJECT as well as accept
 * (`rejects a host that is not listed`), so a directive parse that silently
 * matched everything -- the fail-open this guard would otherwise have -- is
 * itself caught. Without that case the suite passes against a `permits()` that
 * returns true unconditionally.
 */
import { describe, it, expect } from 'vitest';
import { contentSecurityPolicy } from '../app/csp';
import { TILE_HOSTS, TILE_URL, TILE_REF_URL } from '../src/modules/home-map/basemapTiles';

/** The img-src source list, as the browser would read it. */
function imgSrc(policy: string): string[] {
  const directive = policy
    .split(';')
    .map((d) => d.trim())
    .find((d) => d === 'img-src' || d.startsWith('img-src '));
  if (!directive) throw new Error('CSP has no img-src directive at all');
  return directive.split(/\s+/).slice(1);
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

describe('home map basemap tiles vs CSP img-src', () => {
  const sources = imgSrc(contentSecurityPolicy('test-nonce'));

  it('permits every host the map fetches tiles from', () => {
    expect(TILE_HOSTS.length).toBeGreaterThan(0);
    for (const host of TILE_HOSTS) {
      expect(permits(sources, host), `img-src does not permit basemap host ${host}`).toBe(true);
    }
  });

  it('covers the meta form too (prerendered routes serve the same tiles)', () => {
    const metaSources = imgSrc(contentSecurityPolicy('test-nonce', { forMeta: true }));
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
