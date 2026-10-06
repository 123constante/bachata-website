// Dependency-free leaf module (same rule as app/edgeCacheControl.ts and
// app/cacheTags.ts): zero imports, so a spec can exercise it without pulling in
// node:stream / react-dom/server, and nothing transitive can break the build.
//
// The LAST word on a live SSR document's cache headers, applied in
// entry.server.tsx after the route's headers() (cacheHeaders /
// staticShellCacheHeaders in ./detailLoader) has already run. Those decide
// WHAT the edge may cache; this decides whether anything else on the response
// silently cancels it, and keeps error documents out of the edge.
//
// WHY IT EXISTS (2026-10-06 DB incident). Every edge-cached route already emits
// Vercel-CDN-Cache-Control with s-maxage, yet production reported
// x-vercel-cache: MISS on /city/london-gb while Supabase sat at ~89% CPU. The
// one thing on the document that defeats a shared cache is entry.server's
// skew-protection cookie: Vercel's CDN does not store a response that carries
// Set-Cookie, so with skew protection on, EVERY document -- all of the
// s-maxage/tag/purge apparatus included -- went to the origin and the DB. The
// installed @vercel/react-router reference entry sets no such cookie; it was
// local to this repo. Unverified at the edge from the authoring container (no
// route to production), so the cookie is the prime suspect, not a measured
// cause: check x-vercel-cache after deploy.
//
// WHAT DROPPING THE COOKIE COSTS. Only cacheable documents lose it. A visitor
// whose first page was a cached document is not pinned to that deployment, so
// after a deploy their next lazy chunk may 404; src/lib/staleChunk.ts (the
// vite:preloadError handler) turns that into one reload. The cookie would have
// been wrong on a cached copy anyway: it names the deployment that RENDERED the
// document, and a shared copy hands that same pin to every visitor.
//
// NO PERSONALISATION REACHES THIS DOCUMENT. No SSR loader reads Cookie or
// Authorization (sign-in is client-side; /account and the organiser self-serve
// screens render signed-in data in the browser), so the anonymous document IS
// the document, and caching it shares nothing per-user.

/** True when the route's headers() granted the edge a positive fresh window. */
export function isEdgeCacheable(headers: Headers): boolean {
  const cdn = headers.get("Vercel-CDN-Cache-Control");
  if (!cdn) return false;
  const m = /(?:^|[\s,])s-maxage=(\d+)/i.exec(cdn);
  return m !== null && Number(m[1]) > 0;
}

/**
 * Finalise a live SSR document's cache headers in place.
 *
 * - status >= 400: strip the edge directives and send `no-store`. A thrown
 *   404/500 already carries no tag (cacheHeaders leaves it uncached), but a
 *   render that fails AFTER a tagged loader would otherwise keep the route's
 *   s-maxage, and Vercel stores 404s. Belt for the 500 path the incident
 *   produced.
 * - skew-protection cookie: set only on a document the edge will NOT store.
 */
export function finalizeDocumentCacheHeaders(
  headers: Headers,
  status: number,
  skew: { enabled: boolean; deploymentId: string | undefined },
): void {
  if (status >= 400) {
    headers.delete("Vercel-CDN-Cache-Control");
    headers.delete("Vercel-Cache-Tag");
    headers.set("Cache-Control", "no-store");
  }
  if (skew.enabled && skew.deploymentId && !isEdgeCacheable(headers)) {
    headers.append("Set-Cookie", `__vdpl=${skew.deploymentId}; HttpOnly`);
  }
}
