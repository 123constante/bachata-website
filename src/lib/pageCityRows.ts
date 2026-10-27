/**
 * The list half of pageCity (see pageCity.ts): cutting a city-wide list to the
 * page city, and the empty-city test for the global directories. Only the
 * venues and directory pages (and tests) read these, so they live outside
 * pageCity.ts, which rides lib-event-rules (vite.chunks.ts) -- a chunk in the
 * first load of EVERY route, /app included. Split out 2026-10-27, when /app
 * was over its 374 KB first-load budget.
 */
import type { PageCity } from '@/lib/pageCity';

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
