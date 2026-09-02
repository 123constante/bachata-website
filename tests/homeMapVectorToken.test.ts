/**
 * Covers the two functions that decide whether the vector basemap draws at
 * all, neither of which had a single case before review round 2.
 *
 * WHY THIS FILE EXISTS, and why it is not folded into homeMapTileCsp.test.ts:
 * that suite compares the host list against the CSP artefact. This one asserts
 * RUNTIME SIGNING behaviour, and it needs its own env isolation -- the CSP
 * suite's stubs are shared across its cases by design.
 *
 * The defect being fenced is not hypothetical. `vectorTransformRequest()` was
 * absent when the vector layer first shipped, and its absence blanked the live
 * map on 2026-09-02: Esri's style embeds a token in `glyphs` but in NEITHER
 * `sources[].url` NOR `sprite`, and the unsigned TileJSON root answers
 * `{"error":{"code":499,"message":"Token Required."}}` at HTTP 200. MapLibre
 * reads that error body as its TileJSON, finds no `tiles` array, and requests
 * not one tile. No failed request, no error event, no console line.
 *
 * So the whole failure mode is INVISIBLE to every signal a normal test reaches
 * for. What is left is asserting the signing decision directly, which is what
 * this file does. Before it existed, a mutant returning `undefined` from
 * `vectorTransformRequest()` -- i.e. the exact live defect -- left the entire
 * suite green.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { vectorStyleUrl, vectorTransformRequest } from '../src/modules/home-map/vectorBasemap';

const TILE_ROOT =
  'https://basemaps-api.arcgis.com/arcgis/rest/services/basemap/v1/open/VectorTileServer';

/** `vectorTransformRequest()` with a known key, or a failure if it declined. */
function signerWith(key: string): (url: string) => { url: string } {
  vi.stubEnv('VITE_ARCGIS_API_KEY', key);
  const signer = vectorTransformRequest();
  if (signer === undefined) throw new Error('expected a signer for a non-empty key');
  return signer;
}

afterEach(() => {
  // Not at the end of a test body: a failing assertion would skip it and leak
  // the stub into every later case in this worker. Same trap the CSP suite
  // documents.
  vi.unstubAllEnvs();
});

describe('vectorTransformRequest -- token signing', () => {
  it('signs the TileJSON root, which is the request that blanked the live map', () => {
    // THE regression case. The root carries no token in the style document,
    // and unsigned it returns an error body at HTTP 200.
    const out = signerWith('real-key')(TILE_ROOT);
    expect(new URL(out.url).searchParams.get('token')).toBe('real-key');
  });

  it('returns a signer at all when a key is configured', () => {
    // Pins the mutant that made this whole module inert: returning undefined
    // unconditionally reproduces the live defect exactly, and before this
    // case nothing anywhere went red for it.
    vi.stubEnv('VITE_ARCGIS_API_KEY', 'real-key');
    expect(vectorTransformRequest()).not.toBeUndefined();
  });

  it('declines to sign when no key is configured, so the raster fallback stands', () => {
    // The other edge. A signer built around an empty key would append
    // `token=` and turn a clean "vector is not configured" into a 401.
    vi.stubEnv('VITE_ARCGIS_API_KEY', '');
    expect(vectorTransformRequest()).toBeUndefined();
  });

  it('never appends the key to a third-party origin', () => {
    // The guard is `startsWith(TILE_ORIGIN)` including scheme and trailing
    // slash, precisely so a hostile URL that merely CONTAINS the host string
    // cannot collect our credential. Drop the guard and this goes red.
    const sign = signerWith('real-key');
    for (const hostile of [
      'https://evil.test/?x=basemaps-api.arcgis.com/',
      'https://basemaps-api.arcgis.com.evil.test/tile/1/2/3.pbf',
      'http://basemaps-api.arcgis.com/tile/1/2/3.pbf',
      'https://cdn.arcgis.com/sprite.png',
    ]) {
      const out = sign(hostile);
      expect(out.url, `${hostile} must be returned untouched`).toBe(hostile);
      expect(out.url, `${hostile} must not carry the key`).not.toContain('real-key');
    }
  });

  it('leaves a request Esri already tokened exactly as served', () => {
    // The glyphs URL arrives pre-signed. Appending a second `token=` would
    // rewrite a URL the API built for itself.
    const sign = signerWith('real-key');
    const glyphs = `${TILE_ROOT}/resources/fonts/Arial/0-255.pbf?token=esri-own-token`;
    expect(sign(glyphs).url).toBe(glyphs);
  });

  it('re-signs an EMPTY token param rather than trusting the substring', () => {
    // Round 1 replaced `url.includes('token=')` with a parsed lookup. These
    // are the inputs that separate the two: a substring test treats every one
    // of them as already-signed and skips signing, landing on the silent
    // 200-with-an-error-body failure.
    const sign = signerWith('real-key');
    for (const unsigned of [
      `${TILE_ROOT}?token=`,
      `${TILE_ROOT}?refreshtoken=abc`,
      `${TILE_ROOT}/token=/1/2/3.pbf`,
    ]) {
      const got = new URL(sign(unsigned).url).searchParams.get('token');
      expect(got, `${unsigned} should have been signed`).toBe('real-key');
    }
  });

  it('percent-encodes once, so the key survives a round trip', () => {
    // `set()` encodes, so the RAW key goes in. Passing an already-encoded
    // value here would double-encode the `%` and send a key that does not
    // match the issued one.
    const awkward = 'AAPK+slash/and%25percent';
    const out = signerWith(awkward)(TILE_ROOT);
    expect(new URL(out.url).searchParams.get('token')).toBe(awkward);
  });
});

describe('configuredKey -- whitespace is the corruption class we can catch', () => {
  it('treats a whitespace-only key as absent, in both consumers', () => {
    // Round 1's fix. A non-empty-but-wrong key is WORSE than a missing one:
    // vectorStyleUrl() returns non-null, the caller reads that as "vector is
    // configured", the raster fallback is never added, and the style 401s to
    // a permanently blank ground. Delete the `.trim()` and both of these go
    // red -- before this case, neither did.
    vi.stubEnv('VITE_ARCGIS_API_KEY', '   \n\t ');
    expect(vectorStyleUrl()).toBeNull();
    expect(vectorTransformRequest()).toBeUndefined();
  });

  it('strips surrounding whitespace off a real key rather than signing with it', () => {
    // The likelier shape: a trailing newline off a dashboard paste. The key
    // must be usable, not merely non-null.
    vi.stubEnv('VITE_ARCGIS_API_KEY', '  real-key\n');
    expect(vectorStyleUrl()).toContain('token=real-key');
    const signer = vectorTransformRequest();
    expect(signer).not.toBeUndefined();
    const out = (signer as (u: string) => { url: string })(TILE_ROOT);
    expect(new URL(out.url).searchParams.get('token')).toBe('real-key');
  });
});
