/**
 * Display name for a city slug.
 *
 * Slugs are '{city}-{country}' (e.g. 'london-gb'): drop a trailing two-letter
 * country code and title-case every remaining word, so multi-word cities render
 * correctly ('new-york-us' -> 'New York', not 'New').
 *
 * EXTRACTED RATHER THAN COPIED. pages/Index.tsx owned the only copy, as a local
 * useMemo that nothing exported. CityMap needs the same derivation for its SEO
 * title, and a second copy of this exact logic is what this branch already
 * refused to make for the venue-name join -- so it moved here and Index calls
 * it, instead of the same string being derived in two places and drifting.
 *
 * Returns null for a missing slug rather than a placeholder: the two call sites
 * want different fallbacks (Index shows 'Your City', buildSeoForRoute falls
 * back to its own CITY_DEFAULT), and baking either one in here would force the
 * other to unpick it.
 */
export function cityDisplayFromSlug(slug: string | null | undefined): string | null {
  if (!slug) return null;
  const parts = slug.split('-');
  if (parts.length > 1 && parts[parts.length - 1].length === 2) parts.pop();
  return parts.map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
}
