/**
 * Basemap tile constants -- their OWN module, with no side-effectful imports, so
 * that `tests/homeMapTileCsp.test.ts` can bind the tile host to the CSP img-src
 * allowlist by importing BOTH artefacts and comparing them. Kept inside
 * EventMap.tsx they were unreachable from a test (that module pulls in Leaflet
 * and three stylesheets), and the only alternative was a regex scrape of the
 * source -- a guard shape this repo has been burned by: it passes whenever the
 * next author spells the same fact differently.
 */

// Esri's dark canvas, NOT CARTO. CARTO began watermarking keyless traffic --
// `basemaps.cartocdn.com/dark_all` returns HTTP 200 with "API KEY REQUIRED"
// burned into the raster, so nothing errors and no guard sees it. It was live
// on prod. `rastertiles/dark_all` is byte-identical, so it is not a way out;
// the only CARTO fix is an account + key, which is queued.
//
// Esri's tile scheme is /{z}/{y}/{x} -- y BEFORE x, the opposite of the usual
// XYZ order -- and it has no {s} subdomains and no {r} retina variant.
//
// THE RETINA COST, which is the largest quality regression in this swap and is
// NOT fixable on this provider. The CARTO URL ended `{z}/{x}/{y}{r}.png`, and
// Leaflet fills {r} with '@2x' from `Browser.retina` ALONE -- leaflet-src.js
// line 12201, not gated on the `detectRetina` option -- so on a DPR>=2 device
// CARTO served a 512px raster into a 256px tile slot. Esri has no such variant:
// requesting the same tile with '@2x' appended returns a BYTE-IDENTICAL 12935
// bytes (measured 2026-09-01), i.e. the suffix is ignored, not honoured. So
// every basemap tile is now half-resolution at EVERY zoom on essentially every
// phone, and this site is ~95% mobile. It compounds with TILE_MAX_NATIVE_ZOOM
// below: at z17-18 the upscale is 4x-8x rather than 2x-4x.
// This is the honest price of getting the "API KEY REQUIRED" watermark off
// production today, and it is the strongest argument for the queued CARTO key
// -- weigh it there, alongside the brightness stopgap in homeMap.css and the
// two-line attribution. Do not re-derive it from the tile URLs; it is invisible
// in them.
//
// CHANGING THIS HOST? `app/csp.ts` img-src must change with it, or every tile is
// silently CSP-blocked and the map renders empty with no failed request. That
// coupling is not a comment you have to remember: tests/homeMapTileCsp.test.ts
// fails the build.
export const TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';

// The label half of the pair. Transparent PNG; must be added AFTER the base.
export const TILE_REF_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}';

// MEASURED over London, and over BOTH services of the pair, not read off a docs
// page: z<=16 serves real tiles; z17 upward returns a fixed-size "Map data not
// yet available" placeholder at HTTP 200 -- 2521 bytes on Base, 875 on
// Reference. It is LIGHT GREY and would read as a broken map on this dark
// theme. maxNativeZoom pins fetching at 16 and lets Leaflet upscale, so the
// zoom RANGE is unchanged; what changes is that a pinch past 16 is now upscaled
// where CARTO served native tiles to 19. Queued, not fixed here: Esri's cache
// depth varies by REGION, so outside London z14-16 may serve that same
// placeholder -- 200 OK, no tileerror, and homeMap.css's brightness filter
// darkens it into what reads as empty land. Byte length is an exact detector.
export const TILE_MAX_NATIVE_ZOOM = 16;

// VERBATIM from the service's own metadata -- server.arcgisonline.com/ArcGIS/rest/
// services/Canvas/World_Dark_Gray_Base/MapServer?f=json -> copyrightText. Esri's
// terms require the service's stated credit, and an abridged "Esri" alone drops
// HERE, Garmin and the OSM contributors. Re-read that field if the service is
// ever changed; do not hand-shorten it.
export const ATTR =
  'Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, and the GIS user community';

/** Every distinct host the map fetches tiles from. The CSP test asserts each one
 *  is permitted by `contentSecurityPolicy()`, so adding a third service here
 *  without widening img-src fails the build rather than prod. */
export const TILE_HOSTS: readonly string[] = Array.from(
  new Set([TILE_URL, TILE_REF_URL].map((u) => new URL(u.replace(/\{[a-z]\}/g, '0')).host)),
);
