// @vitest-environment jsdom
/**
 * The WebGL2 gate on the home map's vector basemap.
 *
 * WHAT THIS EXISTS TO CATCH, and why a predicate spec would not have caught
 * it. maplibre-gl v6 hard-requires WebGL2. Without a context it fires a
 * GPUInitializationError from inside `_setupPainter()`, leaves `painter`
 * undefined and early-returns out of its own constructor -- so NOTHING throws
 * at construction, the Leaflet layer is added, and the map is permanently
 * blank at HTTP 200. jsdom has no GPU, so mounting `EventMap` here reproduces
 * that live state EXACTLY, with no mock and no seam. Before the fix, this file
 * saw all three of its symptoms at once:
 *
 *   Tf [GPUInitializationError]: WebGL2 is required to display this map...
 *   attribution: "...Map layer by Esri"      <- vector credit over a blank
 *   TypeError: Cannot read properties of undefined (reading 'destroy')
 *                                            <- unmount, out of effect cleanup
 *
 * The previous attempt at this fallback was REVERTED at review round 2 for one
 * reason: a mutant disabling the whole handler kept the entire suite green,
 * because nothing in this repo mounted `EventMap` at all (the home-map specs
 * live in `tests/e2e-attic/`, which no runner collects). This file is the gate
 * that condition demanded. The mutation receipt is in the PR body.
 *
 * WHAT THIS FILE CANNOT SEE, stated so nobody reads its green as broader than
 * it is:
 *
 *   - The style-endpoint 401 (Vercel previews, a new host, a key regen). It is
 *     asynchronous and needs a live painter to be reached at all, so no case
 *     here can drive it. Queued with its own criteria in
 *     `queued-home-map-runtime-fallback-REVERTED.md`.
 *   - Anything visual. jsdom does no layout and paints nothing; every
 *     assertion below is about WHICH LAYER was constructed, never how it looks.
 *   - THE VECTOR SIDE OF THE BRANCH, at the call site. Measured, not assumed:
 *     the mutant `if (false && vectorStyle && hasWebgl2())` -- which forces the
 *     raster pair on every device and silently undoes the whole arc --
 *     SURVIVES this file, 6 passed. It cannot be killed here, because taking
 *     the vector branch in jsdom builds a MapLibre map with no painter, and
 *     tearing that down throws; the only ways to close it are a fake WebGL2
 *     context or an afterEach that tolerates an unmount throw, and the latter
 *     would swallow exactly the failure the second case below exists to catch.
 *     The equivalent mutant one level down (`hasWebgl2()` hard-wired to
 *     `return false`) IS killed, by the "is true when a context is available"
 *     case. So the probe is pinned on both edges and its call site is pinned
 *     on one. The defect this leaves open is a map that renders the previous,
 *     working raster basemap -- not a blank one -- and the seam the queued 401
 *     work needs is the thing that would close it.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import L from 'leaflet';
import { installJsdomPolyfills } from './jsdomPolyfills';
import { hasWebgl2 } from '../../src/modules/home-map/vectorBasemap';
import EventMap from '../../src/modules/home-map/EventMap';

/** Distinctive substrings of the two provider credits, which are the cheapest
 *  honest proof of which basemap was built: `basemapTiles.ts`'s ATTR (raster
 *  pair) names HERE and Garmin, `vectorBasemap.ts`'s VECTOR_ATTR (vector) ends
 *  "Map layer by Esri". Substrings rather than the constants themselves on
 *  purpose -- Leaflet assigns the credit via innerHTML, so the `&copy;` both
 *  strings carry comes back decoded, and an equality check would be comparing
 *  a source literal against rendered DOM. */
const RASTER_CREDIT = 'HERE, Garmin';
const VECTOR_CREDIT = 'Map layer by Esri';

function creditText(container: HTMLElement): string {
  return container.querySelector('.leaflet-control-attribution')?.innerHTML ?? '';
}

beforeEach(() => {
  installJsdomPolyfills();
  // jsdom reports no 3D-transform support, so Leaflet never builds the zoom
  // proxy that `@maplibre/maplibre-gl-leaflet`'s onAdd reads UNGUARDED
  // (`L.DomEvent.on(map._proxy, ...)` at leaflet-maplibre-gl.mjs:24, reached
  // whenever `map.options.zoomAnimation` is on -- which it is by default).
  // Every real browser this ships to has it. Without this line the MUTANT run
  // still reds, but it reds on that adapter bug instead of on the blank
  // ground, i.e. the receipt would be naming a mutant that never reached its
  // verdict. See `mutation_harness_measures_nothing`.
  (L as unknown as { Browser: { any3d: boolean } }).Browser.any3d = true;
  // A key string present at BUILD time is the whole precondition for this
  // gate: it is what makes `vectorStyleUrl()` non-null, so the vector branch
  // is the one under test rather than the no-key fallback that already
  // existed. The value never leaves the process -- nothing here is fetched.
  vi.stubEnv('VITE_ARCGIS_API_KEY', 'gate-spec-key');
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function renderMap() {
  return render(
    <div style={{ position: 'relative', width: 390, height: 240 }}>
      <EventMap
        events={[]}
        visible={[]}
        glow={[]}
        selected={null}
        hovered={null}
        onSelect={() => {}}
        onHover={() => {}}
      />
    </div>,
  );
}

describe('home map basemap gate', () => {
  it('builds the raster pair, not the vector layer, when WebGL2 is absent', () => {
    const view = renderMap();

    // The structural half. `.leaflet-gl-layer` is the container the MapLibre
    // adapter creates in `_initContainer`; the raster pair is two Leaflet tile
    // layers in the tile pane. Asserted alongside the credit because a credit
    // is a string a later edit could set from anywhere, while these are the
    // layers themselves.
    expect(view.container.querySelector('.leaflet-gl-layer')).toBeNull();
    expect(
      view.container.querySelectorAll('.leaflet-tile-pane .leaflet-layer'),
    ).toHaveLength(2);

    // The credit half. Exactly one provider may be on screen -- the reverted
    // draft's worst defect was a swap that left both.
    expect(creditText(view.container)).toContain(RASTER_CREDIT);
    expect(creditText(view.container)).not.toContain(VECTOR_CREDIT);
  });

  it('unmounts without throwing when WebGL2 is absent', () => {
    const view = renderMap();
    // Not a formality. Constructing MapLibre without a painter makes the
    // adapter's onRemove call `_glMap.remove()`, which destroys a painter that
    // was never built -- `Cannot read properties of undefined (reading
    // 'destroy')`, raised out of React's effect cleanup, which takes the page
    // down rather than just the map.
    //
    // "UNREACHABLE" IS THE WRONG WORD FOR WHAT THE PROBE BUYS, and an earlier
    // draft of this comment used it. The probe stops the painterless map being
    // BUILT, which removes the whole device class -- previously every unmount
    // on a WebGL2-less browser threw here. It does not make the state
    // impossible: a context lost between the probe and MapLibre's own
    // `getContext` (GPU-process crash, backgrounded WebView, context-cap
    // eviction) leaves `painter` undefined identically. In that window the
    // `m.remove()` in EventMap's cleanup is still unguarded, and a throw there
    // skips the seven statements after it -- `onReady?.(null)` and every ref
    // reset -- leaving the parent holding a live MapApi onto a dead map. That
    // is pre-existing, is made far rarer rather than introduced by this
    // change, and is queued rather than patched here because no case in this
    // file can drive a throwing `remove()`.
    expect(() => view.unmount()).not.toThrow();
  });
});

describe('hasWebgl2', () => {
  it('is false in an environment with no WebGL2 context', () => {
    // jsdom's own answer, unstubbed. The same fact the mount cases ride on,
    // asserted directly so a failure names the probe rather than the map.
    expect(hasWebgl2()).toBe(false);
  });

  it('is true when a context is available, and releases it', () => {
    // The OTHER edge, and the reason it is here: without it a probe hard-wired
    // to `return false` passes every case above while silently reverting the
    // whole arc to raster.
    const loseContext = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      ((id: string) =>
        id === 'webgl2'
          ? {
              getExtension: (name: string) =>
                name === 'WEBGL_lose_context' ? { loseContext } : null,
            }
          : null) as unknown as HTMLCanvasElement['getContext'],
    );

    expect(hasWebgl2()).toBe(true);
    // Browsers cap live WebGL contexts and evict the oldest once the cap is
    // hit, and the next thing this path does is let MapLibre ask for its own.
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it('is false when getContext returns undefined rather than null', () => {
    // NOT hypothetical, and not a style point. Anti-fingerprinting extensions
    // and privacy shims replace `HTMLCanvasElement.prototype.getContext`
    // outright, and a replacement returning `undefined` walked through the
    // strict `gl === null` this replaced, threw on `gl.getExtension`, had the
    // throw swallowed by the "extension is optional" catch, and reported the
    // device SUPPORTED with no context in hand. That is the blank ground the
    // probe exists to prevent, reached through the probe -- so this case is
    // pinned rather than left to the reading of one comparison operator.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      (() => undefined) as unknown as HTMLCanvasElement['getContext'],
    );

    expect(hasWebgl2()).toBe(false);
  });

  it('is false when getContext throws instead of returning null', () => {
    // Hardened and privacy-hardened browsers do this. An uncaught throw here
    // would surface out of the render effect, which is strictly worse than the
    // blank map the probe exists to prevent.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      throw new Error('canvas blocked');
    });

    expect(hasWebgl2()).toBe(false);
  });
});
