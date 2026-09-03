/**
 * Vector basemap constants -- deliberately their OWN module, for the same
 * reason `basemapTiles.ts` is one: `tests/homeMapTileCsp.test.ts` imports the
 * host list and the CSP together and compares them, which it cannot do from
 * EventMap.tsx (that module pulls Leaflet, MapLibre and three stylesheets).
 *
 * WHY VECTOR, and what it costs. MEASURED 2026-09-02 at the map's REAL default
 * view (51.5085,-0.128 @ z12.5, the 390x240 mobile card), wire bytes under
 * `curl --compressed`, every option taken to the same sharpness:
 *
 *   option                          tiles    requests   img px / CSS px
 *   legacy raster z13 (was live)     77,294     12       1.41
 *   legacy + detectRetina (z14)     311,838     40       2.83
 *   CARTO dark_all @2x              381,322      6       2.83
 *   Esri STATIC basemap tiles     1,495,442      6       2.83
 *   THIS (Esri vector, open)        256,536      4       DPR-native
 *
 * Vector is the cheapest retina-grade option ON TILES, and the gap widens with
 * the card: 356,554 B on the 700x450 desktop card against CARTO's 1,238,521
 * and static's 4,763,315.
 *
 * BUT THE TILE ROW IS NOT THE BILL, and an earlier version of this comment
 * stopped there and read as an unqualified win. The renderer is not a
 * rounding error against these numbers -- it is LARGER than any of them.
 * Measured from this branch's own production build, gzipped:
 *
 *   vendor-maplibre.js       250,570
 *   maplibre-gl-worker.js    134,699
 *   vendor-maplibre.css       10,585
 *   ----------------------------------
 *   renderer total           395,854
 *
 * So the honest comparison, per COLD first visit:
 *
 *   raster z13 (what is live today, blurry)      77,294
 *   raster + detectRetina (same sharpness tier) 311,838
 *   THIS (tiles + renderer)                     652,390
 *
 * Against the retina raster alternative that is +340,552 B cold and -55,302 B
 * warm, i.e. it pays for itself at roughly the SIXTH repeat map view. Against
 * what is actually live it is +575,096 B cold and never breaks even, because
 * the live option is cheaper on tiles too -- there the entire return is
 * sharpness. On a ~95%-mobile site that trade is a JUDGEMENT, and it was made
 * deliberately; it is not a free win, and nobody should re-derive it as one.
 *
 * "Lazy, hash-immutable and behind the placeholder still" is TRUE OF THE
 * MODULE AND FALSE OF THE FETCH: `HomeMapShell.tsx` prewarms the same dynamic
 * import at module scope, so ~261 KB of that renderer starts downloading right
 * after hydration on every homepage load, whether or not the visitor ever
 * looks at the map. `check:bundle-budget` stays green through all of it
 * because the ratchet cannot see lazy chunks. Whether that prefetch should
 * survive this weight increase is a live question with the numbers already
 * taken -- see `queued-home-map-renderer-weight.md`. Do not treat the green
 * budget as evidence that it is fine.
 *
 * DO NOT re-price this from per-tile figures at z13-15. The plan that led here
 * did exactly that and concluded "1.9x": the map opens at 12.5, MapLibre
 * resolves that to source tile z12, and z12 is the densest tile in the set
 * (61,337 B for `open`, against 25,272 at z14). A per-tile average over the
 * wrong zooms is a real measurement of the wrong thing.
 *
 * TOKEN SCOPE. Two endpoints are gated, not one, and the second cost a live
 * blank map on 2026-09-02:
 *
 *   - The STYLE endpoint: 401 without our referrer AND 401 without a token.
 *   - The source's TileJSON root (`.../VectorTileServer`, no path suffix):
 *     `{"error":{"code":499,"message":"Token Required."}}` -- served at
 *     **HTTP 200**. MapLibre parses that body as the TileJSON, finds no
 *     `tiles` array, and therefore requests NOT ONE TILE. No failed request,
 *     no `error` event, no console line: a flat empty ground at 200.
 *
 * The individual `/tile/{z}/{y}/{x}.pbf`, the sprite and the glyphs really do
 * answer 200 with no token and no Referer. The comment this replaces probed
 * exactly those, then generalised to "the tile server" -- and a status-code
 * probe of the root would have passed too, because the refusal IS a 200. That
 * is why `vectorTransformRequest()` below exists and why it must stay: the API
 * embeds a token into the style's `glyphs` URL but into neither `sources[].url`
 * nor `sprite`. Probe the ROOT with its BODY, never the tiles with their status.
 *
 * The key is a PUBLIC, referrer-locked client key BY DESIGN. Verified: 200 for
 * `https://bachatacalendar.co.uk` and `http://localhost:8080`, 401 for any
 * other Referer and 401 for none. Shipping it in the client bundle is the
 * intended use of this credential type, not a leak. Its referrer list lives on
 * ArcGIS item 0229d184e8404c53ad90fa782c78f440, and CHANGING that list
 * invalidates the key value -- see the regen trap in the handover before
 * touching it. The list is per-HOST: the apex and `www` are two entries, and
 * holding only the apex is what blanked the live map on 2026-09-02, because
 * every host 308s to www.
 *
 * THIS WHOLE MECHANISM RESTS ON A HEADER IN ANOTHER FILE. A referrer lock can
 * only work if the browser actually sends a Referer, so the basemap silently
 * depends on `vercel.json` `Referrer-Policy: strict-origin-when-cross-origin`
 * (vercel.json:136 at the time of writing). Tightening that to `no-referrer`
 * or `same-origin` -- an ordinary, sensible-looking security hardening that
 * nobody would connect to a map -- makes EVERY style request 401 and blanks
 * the ground. Nothing catches it: no test, no gate, no console error, and the
 * 401 arrives on a request no user-visible code awaits. This is the same
 * cross-file coupling `tests/homeMapTileCsp.test.ts` was written to fence for
 * the CSP hosts, and it deserves the same artefact comparison; until it has
 * one, this paragraph is the only thing standing between that edit and a dead
 * map, so do not delete it when the header next gets tidied.
 */

/** Style family. `open` (Overture/OSM) over `arcgis` (World_Basemap_v2) was
 *  Ricky's call, for small-city coverage the multi-country arc needs. The byte
 *  case agrees, but NOT for the reason the plan recorded: `arcgis` has the
 *  smaller style (6,251 B wire vs 8,408) and smaller tiles (209,722 vs
 *  256,536), yet needs FIVE Ubuntu fontstacks where `open` needs two Arial
 *  Unicode ones -- 253,360 B of glyphs against 92,845 -- and all five are
 *  reachable at z12.5. Net, `open` is ~139 KB cheaper on a cold mobile load. */
const STYLE_FAMILY = 'open';
const STYLE_NAME = 'dark-gray';

const STYLE_BASE =
  'https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles';

/**
 * VERBATIM from the vector service's own `copyrightText`
 * (basemaps-api.arcgis.com/arcgis/rest/services/OpenBasemap_v2/VectorTileServer
 * ?f=json), which is byte-identical to the `attribution` the style JSON puts on
 * its source. Esri's terms (platform agreement 3.1.4) require the service's
 * stated credit; an abridged "Esri" drops OpenStreetMap, Microsoft and the
 * Community Maps contributors. Re-read that field if the style is ever changed
 * -- do NOT hand-shorten it.
 *
 * This is a DIFFERENT string from `basemapTiles.ts`'s ATTR, and that is
 * correct, not drift: ATTR credits the legacy raster pair, which is what the
 * pre-mount stills under /map-placeholder are still rendered from. Two
 * providers are on screen at different moments, so they get their own credits.
 * When the stills are re-rendered from this style, the two collapse back into
 * one -- and HomeMapShell's static credit moves to this constant with them.
 *
 * `&copy;` rather than the raw character: the Cowork -> FUSE -> NTFS pipeline
 * round-trips Unicode punctuation through cp1252 and ships mojibake to prod.
 * Leaflet's attribution control assigns via innerHTML, so the entity renders.
 */
export const VECTOR_ATTR =
  'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Microsoft, Esri Community Maps contributors, Map layer by Esri';

/** Every distinct host the vector basemap touches: the style endpoint, the
 *  tile/glyph server, and the CDN the sprite is served from. The CSP test
 *  asserts each is permitted by `contentSecurityPolicy()` -- MapLibre fetches
 *  ALL of these with XHR/fetch, so they belong to connect-src, NOT img-src.
 *  Miss one and the map renders empty with no failed image request, which is
 *  the same silent failure mode basemapTiles.ts was split out to prevent.
 *
 *  HOW MUCH OF THIS IS ACTUALLY PINNED, said plainly because the CSP suite's
 *  green is narrower than the list looks: only the FIRST entry is derived from
 *  an artefact (the style URL `vectorStyleUrl()` builds). The other two are
 *  hand-written -- they are named inside the style DOCUMENT, which exists only
 *  over the network and behind the one token-gated endpoint, so no test in
 *  this repo can reach them. If Esri moves tiles, glyphs or sprites to a host
 *  that is not here, every check stays green AND NOTHING ELSE CATCHES IT.
 *  The runtime fallback that would have was reverted at review round 2 -- see
 *  EventMap.tsx for why. Until it lands, this hand-written list is the only
 *  thing between a host change and an empty map. */
export const VECTOR_HOSTS: readonly string[] = [
  'basemapstyles-api.arcgis.com',
  'basemaps-api.arcgis.com',
  'cdn.arcgis.com',
];

/**
 * The style URL, or null when no key is configured.
 *
 * NULL IS A REAL PATH, not a defensive nicety: `VITE_ARCGIS_API_KEY` is a
 * build-time env var, so a deploy that forgets it would otherwise ship a map
 * that renders nothing at HTTP 200 -- no error, no failed request, exactly the
 * shape of the CARTO watermark incident. Callers fall back to the legacy
 * raster pair instead, which is why `basemapTiles.ts` is still wired up and
 * still in img-src.
 */
/**
 * The configured key, TRIMMED, or null.
 *
 * The trim is not tidiness. `VITE_ARCGIS_API_KEY` reaching the build with a
 * trailing newline or a stray space is the single most likely way this value
 * goes wrong -- it is pasted through a dashboard -- and a non-empty-but-wrong
 * key is WORSE than a missing one: `vectorStyleUrl()` returns non-null, the
 * caller reads that as "vector is configured", the raster fallback is never
 * added, and the style 401s to a permanently blank ground. On 2026-09-02 this
 * env var was set to the .env FILE PATH and did exactly that, live.
 *
 * Whitespace is the one corruption class a local guard can actually catch;
 * everything else needs the runtime fallback that is still queued. Catch it.
 */
function configuredKey(): string | null {
  const key = import.meta.env.VITE_ARCGIS_API_KEY;
  if (typeof key !== 'string') return null;
  const trimmed = key.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function vectorStyleUrl(): string | null {
  const key = configuredKey();
  if (key === null) return null;
  return `${STYLE_BASE}/${STYLE_FAMILY}/${STYLE_NAME}?token=${encodeURIComponent(key)}`;
}

/**
 * Whether this browser can host MapLibre's renderer at all.
 *
 * WHY A SECOND GATE, when `vectorStyleUrl()` already guards the branch: that
 * function proves a key STRING existed at BUILD time. It says nothing about
 * the device. maplibre-gl v6 hard-requires WebGL2 -- `_setupPainter()` calls
 * `getContext('webgl2')`, and on null it fires a GPUInitializationError and
 * RETURNS, leaving `this.painter` undefined, whereupon the Map constructor
 * early-returns (`maplibre-gl-dev.mjs:26064-26080`, and the `if (!this.painter)
 * return` at :23274-23275). Nothing throws. The layer is added, the ground is
 * permanently empty, no request fails, and `getAttribution()` still paints
 * Esri's vector credit over the blank -- then unmount throws
 * `Cannot read properties of undefined (reading 'destroy')` out of the effect
 * cleanup, because the adapter's `onRemove` calls `_glMap.remove()` and
 * MapLibre's `remove()` destroys a painter that was never built. All three
 * symptoms are reproduced by `tests/client/homeMapVectorFallback.test.tsx`.
 * On a ~95%-mobile site the affected set is iOS < 15, older Android WebViews
 * and every GPU-blocklisted Chrome: a device class, not an edge case.
 *
 * SYNCHRONOUS BY DESIGN. The first draft of this fallback listened for that
 * error instead, and was reverted: the constructor dispatches it before
 * `.addTo()` returns, so a listener attached after `addTo` sees ZERO events,
 * and the early return means no style request follows to raise a second one.
 * A pre-flight probe needs no listener -- and the reason it is preferred over
 * the equivalent post-`addTo` `getMaplibreMap()?.painter === undefined` test
 * is that the MapLibre Map is then never constructed on an unsupported
 * device. There is no layer to unwind, no second credit to remove, and no
 * `removeLayer` path to get wrong; `EventMap.tsx` folds this straight into
 * the branch condition it already had.
 *
 * WHAT IT DOES NOT PROVE, said plainly because a non-null context reads like a
 * guarantee and is not one. Three gaps remain, and they are different sizes:
 *
 *   - IT ASKS AN EASIER QUESTION THAN THE RENDERER WILL. This calls
 *     `getContext('webgl2')` bare, while MapLibre asks with `stencil: true`
 *     and `powerPreference: 'high-performance'` (its
 *     `canvasContextAttributes` defaults at `maplibre-gl-dev.mjs:23066-23072`,
 *     merged with the four hard-coded in `_setupPainter()` at
 *     `:26065-26071`). A device that grants the plain context and refuses
 *     MapLibre's passes this probe. A shared attribute bag closing exactly
 *     that WAS built here and REVERTED at review round 2: its assertion was
 *     proven blind by mutation twice in the same place -- once on `stencil`,
 *     then on `failIfMajorPerformanceCaveat` -- so it is queued with a hard
 *     receipt requirement rather than patched a third time. Nor does a granted
 *     context promise `new Painter(gl)` then succeeds on it.
 *   - It answers for the instant it runs. A context lost between here and
 *     MapLibre's own `getContext` -- GPU-process crash, backgrounded WebView,
 *     eviction at the browser's live-context cap -- lands on the identical
 *     painterless map. That window is narrow, and it is the one place the
 *     unguarded `m.remove()` in EventMap's cleanup can still throw.
 *   - It is entirely silent about the style endpoint. A 401 there (every
 *     Vercel preview, any new host, any key regen) still leaves a blank
 *     ground, and no probe of the DEVICE could ever see it.
 *
 * All three are asynchronous or need a live GPU, so none can be gated by the
 * jsdom mount test that gates this one -- and shipping ungated code here is
 * exactly what got the first draft reverted. They are queued with their own
 * acceptance criteria: see `queued-home-map-runtime-fallback-REVERTED.md`.
 *
 * NOT MEMOISED, deliberately. It runs once per EventMap mount -- a handful of
 * times per session, since a breakpoint change remounts the component -- and
 * the probe context is released immediately below. A module-level cache would
 * buy nothing measurable and cost both a staleness hazard and a reset seam in
 * every test that wants to see both answers.
 */
export function hasWebgl2(): boolean {
  // Guarded for the node-environment suites that import this module for its
  // host list and its URL builders (`tests/homeMapTileCsp.test.ts`), where
  // there is no document at all. `false` is the honest answer there: no
  // document means no canvas means no renderer.
  if (typeof document === 'undefined') return false;
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = document.createElement('canvas').getContext('webgl2');
  } catch {
    // Hardened and privacy-hardened browsers throw out of getContext rather
    // than returning null. Same answer either way.
    gl = null;
  }
  // `!gl`, NOT `gl === null`. A spec-compliant getContext returns null, but the
  // browsers this probe is aimed at are exactly the ones that do not comply:
  // anti-fingerprinting extensions and privacy shims REPLACE
  // `HTMLCanvasElement.prototype.getContext`, and one returning `undefined`
  // walked straight through the strict compare, threw a TypeError on the
  // `gl.getExtension` below, had that swallowed by the "the extension is
  // optional" catch, and returned TRUE with no context at all -- the exact
  // blank ground this function exists to prevent, reached THROUGH it. The
  // throwing-browser case that motivated the strict compare is already covered
  // by the outer catch above.
  if (!gl) return false;
  // Release the probe's context rather than leaving it to GC. Browsers cap the
  // number of live WebGL contexts and evict the oldest once the cap is hit,
  // and the very next thing that happens on this path is MapLibre asking for
  // one of its own.
  try {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    // The extension is optional. Failing to release a context is not a reason
    // to report the device unsupported.
  }
  return true;
}

/** Host whose requests need the token appended. Scheme and trailing slash are
 *  part of the literal on purpose: a bare `includes()` on the bare hostname
 *  would also match `https://evil.test/?x=basemaps-api.arcgis.com/`, i.e. it
 *  would post our key to somebody else's origin. */
const TILE_ORIGIN = 'https://basemaps-api.arcgis.com/';

/**
 * MapLibre `transformRequest`, or undefined when no key is configured.
 *
 * WHAT THIS IS FOR, and it is not belt-and-braces: the style document Esri
 * serves carries a token in its `glyphs` URL but in NEITHER `sources[].url`
 * NOR `sprite`. The source URL is the TileJSON root, which answers
 * `{"error":{"code":499,"message":"Token Required."}}` at HTTP 200 -- so
 * without this, MapLibre reads an error body as its TileJSON, finds no `tiles`
 * array, and silently never requests a tile. See TOKEN SCOPE at the top.
 *
 * Scoped to the tile origin alone, so the key is never appended to the sprite
 * CDN or to any third-party URL a future style might name. Requests that
 * already carry a token (the glyphs) are left exactly as served -- appending a
 * second `token=` would change a URL Esri built for itself.
 */
export function vectorTransformRequest():
  | ((url: string) => { url: string })
  | undefined {
  const key = configuredKey();
  if (key === null) return undefined;
  return (url: string) => {
    if (!url.startsWith(TILE_ORIGIN)) return { url };
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { url };
    }
    // PARSED, not `url.includes('token=')`. A substring test passes on an
    // EMPTY `?token=`, on any differently-named param that happens to end in
    // `token=` (`?refreshtoken=`), and on a path segment -- and every one of
    // those skips signing, which lands on the silent 200-with-an-error-body
    // failure this module's header exists to warn about. It also means a
    // token Esri embedded itself could never be re-signed once it expires.
    const existing = parsed.searchParams.get('token');
    if (existing !== null && existing.length > 0) return { url };
    // `set` percent-encodes for us, so the RAW key goes in here -- passing an
    // already-encoded value would double-encode the `%` signs.
    parsed.searchParams.set('token', key);
    return { url: parsed.toString() };
  };
}
