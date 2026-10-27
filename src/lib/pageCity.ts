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
 * Pure on purpose (no React, no Supabase): the home feed derivations import it,
 * and it rides the lib-event-rules chunk (vite.chunks.ts). Pages pass it the
 * /city/:slug URL segment, else the stored city (useCity); prerendered bare
 * /parties and /classes pass only the URL segment.
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

const cache = new Map<string, PageCity>();

/** Same slug, same object: safe as a hook dependency without a useMemo per page. */
export function resolvePageCity(slug: string | null | undefined): PageCity {
  const s = (slug ?? '').trim().toLowerCase() || null;
  const key = s ?? '';
  const hit = cache.get(key);
  if (hit) return hit;
  let city: PageCity;
  if (!s || s === DEFAULT_CITY_SLUG) {
    city = { slug: s, name: DEFAULT_CITY_NAME, isLondon: true };
  } else {
    const name = cityDisplayFromSlug(s) ?? DEFAULT_CITY_NAME;
    // By name, not slug: a bare 'london' slug (older links, fixtures) is London too.
    city = { slug: s, name, isLondon: name === DEFAULT_CITY_NAME };
  }
  cache.set(key, city);
  return city;
}
