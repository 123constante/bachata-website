// Content-Security-Policy for SSR document responses. Set per-request in
// entry.server (NOT vercel.json — a static header there can't carry the
// per-request nonce, and a duplicate CSP header would intersect and re-break
// hydration). Mirrors the directives that used to live in vercel.json, with the
// one change that matters for framework mode: script-src uses a per-request
// 'nonce-…' instead of 'unsafe-inline', so RR7's inline hydration script runs
// under a strict policy. style-src keeps 'unsafe-inline' (framer-motion / inline
// styles; per-style nonces are impractical).
// `forMeta`: when the policy is delivered via <meta http-equiv> (prerendered
// static routes — see entry.server's injectCspMeta) the browser IGNORES
// `frame-ancestors` and logs a console error for it, so we omit it there.
// Clickjacking is still covered by X-Frame-Options: DENY (vercel.json /(.*)).
// The HTTP header form (live SSR responses) keeps frame-ancestors.
export function contentSecurityPolicy(nonce: string, opts?: { forMeta?: boolean }): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    // server.arcgisonline.com is the BASEMAP host (was *.basemaps.cartocdn.com,
    // dropped when CARTO started watermarking keyless tiles). A basemap swap is
    // not just EventMap's TILE_URL: miss this line and every tile is silently
    // CSP-blocked, which renders as an empty map with no failed request.
    "img-src 'self' data: blob: https://pub-07f606224cac4f2596903c44df723644.r2.dev https://*.r2.dev https://*.supabase.co https://flagcdn.com https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev https://server.arcgisonline.com",
    "media-src 'self' blob: https://*.r2.dev https://*.supabase.co",
    // The three arcgis hosts are the VECTOR basemap, and they belong here
    // rather than in img-src because MapLibre fetches every part of a vector
    // map -- style, TileJSON, .pbf tiles, glyph ranges and the sprite sheet --
    // with fetch/XHR. Only the sprite is an image, and it is still a fetch.
    // basemapstyles-api = the style document (the one token-gated endpoint),
    // basemaps-api = tiles + glyphs, cdn.arcgis = sprites. Miss one and the
    // map draws nothing at HTTP 200 with no failed IMAGE request, which is the
    // img-src failure mode above wearing a different hat.
    "connect-src 'self' https://*.r2.cloudflarestorage.com https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io https://basemapstyles-api.arcgis.com https://basemaps-api.arcgis.com https://cdn.arcgis.com",
    // MapLibre parses tiles in a Worker. This directive is a deliberate
    // NARROWING, not an enabler, and the difference matters to anyone deciding
    // whether it can go: worker-src falls back to child-src and then
    // script-src, script-src here is `'self' 'nonce-...'`, and there is no
    // 'strict-dynamic' to switch host-sources off -- so `'self'` ALREADY
    // permits the same-origin worker asset EventMap emits. What stating
    // worker-src buys is that worker sources stay pinned to same-origin
    // whatever script-src later has to admit.
    //
    // An earlier note here read "without this directive the worker never
    // starts ... the map renders empty at HTTP 200". That is struck, not
    // reworded: it was wrong about the fallback chain, and the empty map it
    // cited was really the blob: worker failing BEFORE the same-origin
    // `?worker&url` fix in EventMap. Right observation, wrong cause.
    //
    // 'self' ONLY, and blob: is deliberately NOT here. MapLibre wraps its
    // worker in a `new Blob(['import ...'])` shim exclusively when the worker
    // URL is CROSS-origin -- maplibre-gl.mjs `Oi()` gates the shim on `Ci()`,
    // which is an origin comparison. EventMap hands it a Vite-emitted asset
    // URL, so the URL is same-origin and the direct `new Worker(url,
    // {type:'module'})` branch is taken. VERIFIED in the browser rather than
    // read off the source: the only worker request is a same-origin GET for
    // maplibre-gl-worker.mjs, and no blob: worker is created.
    // If the assets are ever moved to a separate CDN origin, this is one of
    // the things that breaks, and blob: is the fix.
    "worker-src 'self'",
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
    ...(opts?.forMeta ? [] : ["frame-ancestors 'none'"]),
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
