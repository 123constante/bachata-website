import { asWallClockOrNull, formatWallClockDateTime } from '@/lib/time/wallClock';

// The second line of an event search result ("Fri 30 Oct, 8 PM, London" with a middle dot), one
// mapping for the /search page and the search overlay. Owner walk 2026-10-08: a
// row read only "london-gb". search_public_v4/v5/v6 return per event: start_time
// (the next scheduled date, a London wall clock stamped +00, shown as stored),
// is_ended (v6) and city_slug. They return NO venue, so none is shown here.

export interface EventSubtitleInput {
  start_time: string | null;
  city_slug: string | null;
  is_ended?: boolean | null;
}

/** 'london-gb' -> 'London', 'san-sebastian-es' -> 'San Sebastian'. */
export function cityFromSlug(slug: string | null | undefined): string | null {
  const s = (slug ?? '').trim().toLowerCase().replace(/-[a-z]{2}$/, '');
  if (!s) return null;
  return s.split('-').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function eventResultSubtitle(e: EventSubtitleInput): string | null {
  const when = e.is_ended ? 'No longer running' : formatWallClockDateTime(asWallClockOrNull(e.start_time));
  const parts = [when, cityFromSlug(e.city_slug)].filter((p): p is string => !!p);
  return parts.length ? parts.join(' \u00b7 ') : null;
}
