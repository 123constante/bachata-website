// The /city/:slug/map page's derivations. Pure, no React, no DOM -- the same
// split mapListDerivations was extracted for, and the reason the filter
// arithmetic below is testable without mounting Leaflet.

import type { MapEvent, MapCategory } from './mapTypes';
import { deriveCategory, matchesQuery } from './mapTypes';
import { dedupePins, groupPinsByLocation, isOnCityMap } from './mapListDerivations';
import { venueCoordKey } from './venueNights';

/** The type filter's chips. 'all' is the absence of a filter, not a fourth
 *  chip -- it is what removing the active one returns to. */
export type MapTypeFilter = 'all' | 'parties' | 'classes' | 'courses';

export const TYPE_FILTERS: { id: MapTypeFilter; label: string }[] = [
  { id: 'parties', label: 'Parties' },
  { id: 'classes', label: 'Classes' },
  { id: 'courses', label: 'Courses' },
];

export const isMapTypeFilter = (v: string | null): v is MapTypeFilter =>
  v === 'all' || v === 'parties' || v === 'classes' || v === 'courses';

/** A course is its own shape, not a class that repeats. deriveCategory cannot
 *  answer this -- it maps a course onto 'class' -- so the format field is read
 *  directly, with the legacy generated `type` as the fallback the rest of the
 *  codebase uses (see isFestivalByFormat for the same two-step). */
const isCourse = (e: MapEvent): boolean =>
  e.format != null ? e.format === 'course' : e.type === 'course';

/**
 * Does a row belong under a type chip?
 *
 * Parties and classes are NOT mutually exclusive: a "Class & Party" night has
 * both flags and genuinely belongs under both chips, which is what makes the
 * per-chip counts add up to more than the total and is correct. Courses are
 * excluded from both, because a course listed under "Classes" would bury the
 * drop-in classes that chip exists to find.
 */
export function matchesType(e: MapEvent, t: MapTypeFilter): boolean {
  if (t === 'all') return true;
  if (t === 'courses') return isCourse(e);
  if (isCourse(e)) return false;
  return t === 'parties' ? e.has_party : e.has_class;
}

/** One row of the list under the map, and one pin on it. */
export interface VenueRow {
  /** The group's representative occurrence_id -- the marker's identity, and
   *  what the URL carries as the selected venue. */
  repOccId: string;
  venueName: string | null;
  area: string | null;
  lat: number;
  lng: number;
  /** Rounded key, for resolving this venue's raw rows in regularNights. */
  coordKey: string;
  /** The distinct events at this venue-coordinate. */
  eventIds: Set<string>;
  /** Distinct events currently passing the filter. */
  visibleCount: number;
  /** Soonest upcoming instance_date among the visible members, else null. */
  nextDate: string | null;
  /** Category swatches for the visible members, stable order, no repeats. */
  categories: MapCategory[];
}

export interface CityMapArgs {
  citySlug: string | null | undefined;
  type: MapTypeFilter;
  q: string;
  /** The homepage tab this page was opened from. 'tonight' narrows to today
   *  and renders the removable chip; null is the whole horizon. */
  from: 'tonight' | null;
  /** London day key. */
  today: string;
}

export interface CityMapModel {
  /** Every city pin, deduped one per event+coord. This is EventMap's `events`
   *  and it does NOT move when a filter changes: markers are built once and the
   *  filter narrows `visible`, so filtering never rebuilds the marker layer. */
  pins: MapEvent[];
  /** The occurrence_ids passing the filter -- EventMap's `visible`. */
  visible: string[];
  /** Rows for the list, filtered set only, soonest first. */
  rows: VenueRow[];
  /** Venues currently shown, and venues in the city. "N of M". */
  shownVenues: number;
  totalVenues: number;
}

/** Category swatches in a stable order, so a row's dots do not reshuffle
 *  between renders on Set iteration order. */
const CATEGORY_ORDER: MapCategory[] = ['party', 'class', 'mix', 'fest', 'social'];

/**
 * Everything the page draws, from the raw rows and the active filter.
 *
 * The pin set is derived from the UNFILTERED city rows on purpose. EventMap
 * rebuilds every marker when its `events` prop changes and merely toggles
 * layers when `visible` changes, so filtering through `visible` keeps a filter
 * tap cheap -- and keeps the marker a user has selected alive underneath a
 * filter that hides it, which is what lets clearing the filter restore it.
 */
export function buildCityMapModel(rows: MapEvent[], a: CityMapArgs): CityMapModel {
  const cityRows = rows.filter((e) => isOnCityMap(e, a.citySlug));
  const { pins } = dedupePins(cityRows);
  const groups = groupPinsByLocation(pins);

  const passes = (e: MapEvent): boolean => {
    if (a.from === 'tonight' && e.instance_date !== a.today) return false;
    if (!matchesType(e, a.type)) return false;
    return matchesQuery(e, a.q);
  };

  const visible: string[] = [];
  const venueRows: VenueRow[] = [];
  for (const g of groups) {
    const shown = g.members.filter(passes);
    for (const e of shown) visible.push(e.occurrence_id);
    if (!shown.length) continue;

    const cats = new Set(shown.map(deriveCategory));
    // Soonest among the VISIBLE members. A pin row already carries its event's
    // soonest date (dedupePins), so this is a min over those, not a re-scan of
    // every occurrence.
    let next: string | null = null;
    for (const e of shown) {
      if (!e.instance_date) continue;
      if (next === null || e.instance_date < next) next = e.instance_date;
    }

    venueRows.push({
      repOccId: g.repOccId,
      venueName: g.venueName,
      area: g.area,
      lat: g.lat,
      lng: g.lng,
      coordKey: venueCoordKey(g.lat, g.lng),
      eventIds: new Set(g.members.map((e) => e.event_id)),
      visibleCount: shown.length,
      nextDate: next,
      categories: CATEGORY_ORDER.filter((c) => cats.has(c)),
    });
  }

  // Soonest first, then name, then repOccId. The last tiebreak is not padding:
  // two unnamed venues would otherwise compare equal and the browser's sort is
  // free to reorder them between renders, which reads as the list twitching.
  venueRows.sort(
    (x, y) =>
      (x.nextDate ?? '9999-99-99').localeCompare(y.nextDate ?? '9999-99-99') ||
      (x.venueName ?? '').localeCompare(y.venueName ?? '') ||
      x.repOccId.localeCompare(y.repOccId),
  );

  return {
    pins,
    visible,
    rows: venueRows,
    shownVenues: venueRows.length,
    totalVenues: groups.length,
  };
}
