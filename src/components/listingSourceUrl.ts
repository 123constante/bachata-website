/**
 * The page path + query the receiver sees as "Submitted from". A bare route
 * (/djs) does not name the city a stored-city visitor was looking at, so the
 * slug is added as ?city=<slug> unless the path already carries /city/<slug>/.
 *
 * Its own module, not listingFormBase.ts: only EmptyCityNote needs it, and the
 * form rides ComingSoonGate into the first load of /app and /auth (2026-10-27,
 * /app over its 374 KB pin). The form takes the result through its
 * getSourceUrl prop.
 */
export function listingSourceUrl(pathname: string, search: string, citySlug?: string | null): string {
  if (!citySlug || pathname.startsWith(`/city/${citySlug}`)) return pathname + search;
  const q = new URLSearchParams(search);
  q.set('city', citySlug);
  return `${pathname}?${q.toString()}`;
}
