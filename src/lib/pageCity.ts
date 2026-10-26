/**
 * pageCity -- the ONE mapping from "which city is this page about" to the
 * name the page shows and whether London-only copy (guide links, "in London")
 * applies. Parties, Classes, Tonight, Venues, Organisers, Dancers, DJs, search
 * and the empty-city note all read it, so a Bristol page can never say London
 * in one place and Bristol in another.
 *
 * No slug (a bare /parties prerender, a first visit) is the site default:
 * London, the same fallback buildSeoForRoute's CITY_DEFAULT uses.
 *
 * Pure on purpose (no React, no Supabase): the home feed derivations import it.
 * The hook is in src/hooks/usePageCity.ts.
 */
import { cityDisplayFromSlug } from '@/lib/cityDisplayName';

export const DEFAULT_CITY_SLUG = 'london-gb';
export const DEFAULT_CITY_NAME = 'London';

export type PageCity = {
  /** The slug the page is about; null when nothing names a city. */
  slug: string | null;
  /** The display name, e.g. 'Bristol'. London when no slug. */
  name: string;
  /** London-only copy and links apply. */
  isLondon: boolean;
};

export function resolvePageCity(slug: string | null | undefined): PageCity {
  const s = (slug ?? '').trim().toLowerCase() || null;
  if (!s || s === DEFAULT_CITY_SLUG) {
    return { slug: s, name: DEFAULT_CITY_NAME, isLondon: true };
  }
  const name = cityDisplayFromSlug(s) ?? DEFAULT_CITY_NAME;
  // By name, not slug: a bare 'london' slug (older links, fixtures) is London too.
  return { slug: s, name, isLondon: name === DEFAULT_CITY_NAME };
}


/**
 * A city-wide list (venues) cut to the page city by its city_name. London is
 * returned untouched -- the London page is byte-identical to before, its
 * three off-city venues included under "Elsewhere".
 */
export function rowsForCity<T extends { city_name?: string | null }>(rows: readonly T[], city: PageCity): readonly T[] {
  if (city.isLondon) return rows;
  const want = city.name.toLowerCase();
  return rows.filter((r) => (r.city_name ?? '').trim().toLowerCase() === want);
}

/**
 * Global directories (dancers, DJs, organisers) list everyone; true when the
 * page city is not London and no row is in it, so the page shows the
 * empty-city note above the everyone-list.
 */
export function cityHasNoRows<T>(rows: readonly T[], city: PageCity, cityOf: (row: T) => string | null | undefined): boolean {
  if (city.isLondon) return false;
  const want = city.name.toLowerCase();
  return !rows.some((r) => (cityOf(r) ?? '').trim().toLowerCase() === want);
}

/** The line under the note on a global directory. */
export const SHOWING_EVERYONE = 'Showing everyone for now.';
