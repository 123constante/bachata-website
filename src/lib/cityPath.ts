export const CITY_PATH_PREFIX = '/city';

/**
 * Build a URL for a city-scoped page.
 *
 *   buildCityPath('london-gb')              → '/city/london-gb'
 *   buildCityPath('london-gb', 'parties')   → '/city/london-gb/parties'
 *   buildCityPath(undefined, 'parties')     → '/parties'     (no city context)
 *   buildCityPath(null)                     → '/'            (home)
 */
export function buildCityPath(
  slug: string | null | undefined,
  segment?: string
): string {
  if (!slug) {
    return segment ? `/${segment}` : '/';
  }
  return segment
    ? `${CITY_PATH_PREFIX}/${slug}/${segment}`
    : `${CITY_PATH_PREFIX}/${slug}`;
}
