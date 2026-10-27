/**
 * The ONE mapping from "which city did the URL ask for" to everything the
 * teachers directory says about it: which list to fetch, the heading, the
 * subtitle, the document title context and the empty-city note. Teachers.tsx,
 * the sitemap and the tests all read it, so the copy cannot drift between them.
 *
 * Only ACTIVE cities (cities.is_active) have a directory page. An unknown or
 * inactive slug falls back to London's list with a note naming what was asked
 * for -- never a blank page (owner decision, brief teachers-directory-city).
 */
import { buildSeoForRoute } from '@/lib/seo/buildSeoForRoute';
import { DEFAULT_TEACHERS_CITY, teachersPath } from './teachersRedirect';

export { DEFAULT_TEACHERS_CITY, teachersPath, teachersRedirectTarget } from './teachersRedirect';

export type CityRow = { slug: string; name: string };

export type TeachersCityMode =
  /** The URL names an active city: show its own list. */
  | 'active'
  /** The URL names a city we know but that is not active yet. */
  | 'inactive'
  /** The URL names no city we know. */
  | 'unknown';

export type TeachersCityView = {
  mode: TeachersCityMode;
  /** The slug passed to get_public_teachers_list_v1 as p_city_slug. */
  listSlug: string;
  /** The city the page is about (London on a fallback). */
  cityName: string;
  /** What the visitor asked for, for the fallback note ("that city" when unknown). */
  requestedName: string;
  /** The page's own canonical path. */
  canonicalPath: string;
};

/**
 * @param slug          the :slug URL segment
 * @param activeCities  cities with is_active = true
 * @param requestedRow  the cities row for `slug` when it is not active (null when no such city)
 */
export function resolveTeachersCity(
  slug: string | null | undefined,
  activeCities: readonly CityRow[],
  requestedRow: CityRow | null = null,
): TeachersCityView {
  const wanted = (slug ?? '').trim().toLowerCase();
  const active = activeCities.find((c) => c.slug === wanted);
  if (active) {
    return { mode: 'active', listSlug: active.slug, cityName: active.name, requestedName: active.name, canonicalPath: teachersPath(active.slug) };
  }
  const fallback = activeCities.find((c) => c.slug === DEFAULT_TEACHERS_CITY.slug) ?? DEFAULT_TEACHERS_CITY;
  const known = requestedRow && requestedRow.slug === wanted ? requestedRow : null;
  return {
    mode: known ? 'inactive' : 'unknown',
    listSlug: fallback.slug,
    cityName: fallback.name,
    requestedName: known ? known.name : 'that city',
    canonicalPath: teachersPath(fallback.slug),
  };
}

export type TeachersCityCopy = {
  heading: string;
  subtitle: string;
  /**
   * The empty-city note, followed on screen by the "Tell us" action (the
   * ListingRequestForm). Shown above London's list on a fallback, or as the
   * empty state of an active city with no teachers. Null when there is nothing to say.
   */
  note: string | null;
  /** On a fallback only: says whose list is shown instead. */
  fallbackLine: string | null;
  /** The SEO context for buildSeoForRoute('teachers', ...). */
  seo: { cityDisplay: string; entitySlug: string; canonicalPath: string };
};

export const TELL_US_LABEL = 'Tell us';

export function teachersCityCopy(view: TeachersCityView, teacherCount: number | null): TeachersCityCopy {
  const seo = { cityDisplay: view.cityName, entitySlug: view.listSlug, canonicalPath: view.canonicalPath };
  // The heading IS the document title and the subtitle IS the meta description:
  // one copy, in buildSeoForRoute's teachers spec.
  const { title: heading, description: subtitle } = buildSeoForRoute('teachers', seo);
  let note: string | null = null;
  let fallbackLine: string | null = null;
  if (view.mode !== 'active') {
    note = `No teachers listed in ${view.requestedName} yet. Know one?`;
    fallbackLine = `Showing teachers in ${view.cityName} instead.`;
  } else if (teacherCount === 0) {
    note = `No teachers listed in ${view.cityName} yet. Know one?`;
  }
  return {
    heading,
    subtitle,
    note,
    fallbackLine,
    seo,
  };
}

/** Sitemap: one directory URL per ACTIVE city. */
export function teachersSitemapPaths(activeCities: readonly CityRow[]): string[] {
  return [...activeCities].sort((a, b) => a.slug.localeCompare(b.slug)).map((c) => teachersPath(c.slug));
}
