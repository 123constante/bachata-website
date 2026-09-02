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
 * Vector is the CHEAPEST retina-grade option on tiles at every viewport, and
 * the gap widens with the card: 356,554 B on the 700x450 desktop card against
 * CARTO's 1,238,521 and static's 4,763,315. Its whole price is the one-time
 * MapLibre renderer, which is lazy, hash-immutable, and sits behind the
 * placeholder still.
 *
 * DO NOT re-price this from per-tile figures at z13-15. The plan that led here
 * did exactly that and concluded "1.9x": the map opens at 12.5, MapLibre
 * resolves that to source tile z12, and z12 is the densest tile in the set
 * (61,337 B for `open`, against 25,272 at z14). A per-tile average over the
 * wrong zooms is a real measurement of the wrong thing.
 *
 * TOKEN SCOPE -- probed, not assumed. Only the STYLE endpoint is gated: it is
 * 401 without our referrer AND 401 without a token. The tile server, the
 * sprite and the glyph endpoints all answer 200 with no token and no Referer
 * whatsoever. So there is no `transformRequest` here and none is needed -- the
 * key rides on the style URL alone, and the API embeds its own token into the
 * style's `glyphs` URL when it serves it. If you ever see a 401 on a TILE,
 * that is a service policy change, not a missing header.
 *
 * The key is a PUBLIC, referrer-locked client key BY DESIGN. Verified: 200 for
 * `https://bachatacalendar.co.uk` and `http://localhost:8080`, 401 for any
 * other Referer and 401 for none. Shipping it in the client bundle is the
 * intended use of this credential type, not a leak. Its referrer list lives on
 * ArcGIS item 0229d184e8404c53ad90fa782c78f440, and CHANGING that list
 * invalidates the key value -- see the regen trap in the handover before
 * touching it.
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
export function vectorStyleUrl(): string | null {
  const key = import.meta.env.VITE_ARCGIS_API_KEY;
  if (typeof key !== 'string' || key.length === 0) return null;
  return `${STYLE_BASE}/${STYLE_FAMILY}/${STYLE_NAME}?token=${encodeURIComponent(key)}`;
}
