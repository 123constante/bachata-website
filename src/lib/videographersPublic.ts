// Owner decision 2026-10-13: "We are not ready for videographers yet."
// When false, the public /videographers page is hidden everywhere it could be
// found: the route falls through to the site's NotFound (and the catchall gate
// answers a real HTTP 404), and it is out of the sitemap and the SEO map.
// All page code and its data query are kept, so flipping this to true restores
// the page. Dependency-free on purpose: the sitemap, the catchall gate and
// tests all import it, and some of them mock '@/lib/featureFlags'.
//
// Deliberately NOT hidden (existing event content): videographers credited in
// an event's lineup.
export const VIDEOGRAPHERS_PUBLIC_ENABLED = false;

export const VIDEOGRAPHERS_PATH = '/videographers';

/** False only for the videographers directory path while it is hidden. */
export function isPathPublic(path: string, enabled: boolean = VIDEOGRAPHERS_PUBLIC_ENABLED): boolean {
  return enabled || path !== VIDEOGRAPHERS_PATH;
}
