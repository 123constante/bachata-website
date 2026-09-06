/**
 * City-scoped canonical resolution, and the OG copy for city subpages whose
 * canonical is THEMSELVES.
 *
 * Lives here rather than inline in middleware.ts for the same reason
 * app/truncate.ts and app/edgeCacheControl.ts do: the Edge runtime bundle
 * cannot resolve src/-rooted imports (that is what broke the Vercel build in
 * #272), so anything the middleware needs must be a dependency-free leaf. The
 * second reason is testability -- a rule that exists only inside middleware.ts
 * has no spec at all, because importing that file drags in @vercel/edge. Every
 * rule below is exercised by app/cityCanonical.test.ts.
 */

// Clean (non-city-prefixed) public listing routes. City-prefixed duplicates
// (/city/:slug/<listing>) canonicalise onto these so equity consolidates on the
// prerendered clean pages instead of splitting across the /city/* variants.
export const CLEAN_LISTINGS = new Set([
  'parties', 'classes', 'tonight', 'venues', 'discounts', 'practice-partners',
  'choreography', 'dancers', 'festivals', 'teachers', 'djs', 'organisers',
  'cities', 'videographers', 'vendors', 'search',
]);

export interface CitySubpageSeo {
  title: string;
  description: string;
}

/**
 * TWIN of src/lib/cityDisplayName.ts, byte-pinned by app/cityCanonical.test.ts
 * over a slug battery. It is a twin rather than an import because nothing in
 * src/ may be reached from the Edge bundle, and a re-export the other way would
 * be the FIRST src/-imports-app/ edge in the repo -- a new architectural
 * direction, not a review fix.
 */
function cityDisplayFromSlug(slug: string | null | undefined): string | null {
  if (!slug) return null;
  const parts = slug.split('-');
  if (parts.length > 1 && parts[parts.length - 1].length === 2) parts.pop();
  return parts.map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
}

/**
 * City subpages that are DISTINCT PAGES rather than city-prefixed duplicates of
 * a clean listing, keyed to their own OG copy. Membership in CITY_SELF_CANONICAL
 * is DERIVED from this table rather than declared beside it, so a new entry
 * cannot be added to one and forgotten in the other.
 *
 * A Map, not an object literal: an object's lookup answers for every
 * Object.prototype key, so `SELF_CANONICAL_SUBPAGES['constructor']` returned a
 * truthy function whose result had an undefined title -- an empty <title> from
 * a URL segment. Unreachable through citySelfCanonicalListing()'s Set gate, and
 * that is exactly the "safe because of a distant caller" that stops being true.
 *
 * COPY IS DUPLICATED FROM src/lib/seo/buildSeoForRoute.ts, KNOWINGLY. The Edge
 * bundle cannot import from src/, so these strings cannot be shared at runtime
 * -- but they CAN be pinned at test time, and cityCanonical.test.ts asserts this
 * table's output equals buildSeoForRoute('city.map', ...) field by field. Edit
 * one side and that spec names the other.
 *
 * /city/:slug/calendar is deliberately NOT here. It renders <Index/>, i.e. the
 * homepage with the Calendar tab open, so '/' is the correct canonical for it
 * and it stays on the fallback arm below.
 */
const SELF_CANONICAL_SUBPAGES = new Map<string, (cityName: string) => CitySubpageSeo>([
  ['map', (cityName) => ({
    title: `Bachata Map of ${cityName}`,
    description:
      `Every bachata venue in ${cityName} on one map - find what's on near you, ` +
      `see each venue's regular nights, and filter by parties, classes or courses.`,
  })],
]);

export const CITY_SELF_CANONICAL = new Set(SELF_CANONICAL_SUBPAGES.keys());

/**
 * The self-canonical listing for a /city/... path, or null.
 *
 * `segments` is the pathname split on '/' with empties dropped, i.e.
 * ['city', '<slug>', ...rest] -- the array middleware.ts already has.
 *
 * EXACTLY three segments. A deeper path (/city/london-gb/map/anything) is not a
 * route on this site, and canonicalising it onto the page whose name it happens
 * to carry would mint an indexable alias for a URL that 404s in the browser.
 * The pre-existing CLEAN_LISTINGS arm below deliberately keeps its looser
 * behaviour -- narrowing it is a separate, wider change (see
 * queued-city-subpath-soft-404.md).
 */
export function citySelfCanonicalListing(segments: string[]): string | null {
  if (segments.length !== 3) return null;
  const listing = segments[2];
  return CITY_SELF_CANONICAL.has(listing) ? listing : null;
}

/**
 * OG copy for a self-canonical city subpage, or null for anything else.
 * `listing` is expected to come from citySelfCanonicalListing(), so the
 * 3-segment rule is applied once rather than restated here.
 *
 * TAKES THE SLUG, NOT THE CITY NAME, and that is the finding it exists to
 * answer. The middleware has `cities.name` from the DB in hand and it is the
 * better string ("Stoke-on-Trent"); src/pages/CityMap.tsx titles the SAME URL
 * from cityDisplayFromSlug(slug) ("Stoke On Trent"), because CityContext
 * carries only a slug and no name. Two derivations for one URL is a
 * disagreement a crawler that renders JS can see, so the edge gives up the
 * better hyphenation to NARROW that disagreement. Pinning the templates while
 * feeding the two sides different NAMES was a test that could stay green
 * through exactly that divergence.
 *
 * NARROW, NOT CLOSED, and this comment said "provably identical" until review
 * round 2 disproved it by reading. The two sides still emit DIFFERENT strings
 * for the same URL: useSeo applies withSuffix() to both document.title and
 * og:title (src/lib/seo/useSeo.ts:110,122), so the SPA says "Bachata Map of
 * London | Bachata Calendar" where this emits the bare title, and the edge
 * additionally truncates to 90/160 where the SPA does not. What is pinned is
 * the TEMPLATE the two sides share, which is the thing that can silently drift
 * when someone edits one copy. The emitted-output gap is real, deliberately not
 * fixed here, and queued in queued-city-map-title-output-parity.md.
 */
export function citySubpageSeo(
  listing: string | null | undefined,
  citySlug: string | null | undefined,
): CitySubpageSeo | null {
  if (!listing) return null;
  const build = SELF_CANONICAL_SUBPAGES.get(listing);
  if (!build) return null;
  const cityName = cityDisplayFromSlug(citySlug);
  // No derivable name: fall back to the CITY card rather than titling a page
  // "Bachata Map of null".
  //
  // THIS BAIL-OUT IS A SEAM, named by review round 2 and NOT closed here.
  // cityCanonicalPath() decides self-canonical from citySelfCanonicalListing()
  // alone and never consults this function, so if this arm ever fires the URL
  // is emitted as its own canonical while carrying the CITY's title and
  // description -- the thin duplicate the whole change exists to prevent.
  // Unreachable from middleware.ts, whose slug is CITY_SLUG_RE-validated before
  // it gets here -- and "unreachable because a distant caller gates it" is
  // exactly the reasoning the SELF_CANONICAL_SUBPAGES comment above REFUSES to
  // accept for the Object.prototype case. The inconsistency is real. Closing it
  // means one shared gate rather than two, which is new logic, and new logic
  // does not ship in a round-2 remediation: queued in
  // queued-city-map-title-output-parity.md alongside the output gap.
  if (!cityName) return null;
  return build(cityName);
}

/**
 * Canonical PATH (origin-relative, always leading '/') for a /city/... URL.
 * The caller prefixes SITE_URL, which carries no trailing slash.
 *
 * Order is load-bearing: self-canonical resolves BEFORE the clean-listing
 * consolidation, so a slug present in both sets would silently take the
 * self-canonical arm. The two sets are disjoint by definition -- a path cannot
 * both consolidate onto /parties and be its own canonical -- and
 * cityCanonical.test.ts asserts that disjointness rather than trusting it.
 */
export function cityCanonicalPath(segments: string[]): string {
  // Bare /city/:slug is the homepage equivalent.
  if (segments.length === 2) return '/';

  const selfListing = citySelfCanonicalListing(segments);
  if (selfListing) return `/city/${segments[1]}/${selfListing}`;

  if (CLEAN_LISTINGS.has(segments[2])) return `/${segments[2]}`;
  return '/';
}

// Exported for the twin-parity spec ONLY -- middleware.ts must keep going
// through citySubpageSeo(), which is what guarantees the slug is the input.
export const __cityDisplayFromSlugTwin = cityDisplayFromSlug;
