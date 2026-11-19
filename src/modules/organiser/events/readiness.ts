import type { ListedSeries } from './eventsApi';

/**
 * Editor v2 S1: what the My events row can say is ready, from what organiser_home_v1 already loads.
 * Tickets and Classes/programme are NOT in that payload, so they have no dot (never faked).
 * "Poster" is the cover image only; the poster text is not loaded either.
 */
export type ReadyDot = { key: 'when' | 'venue' | 'poster'; label: string; filled: boolean };

export function readinessOf(s: Pick<ListedSeries, 'name' | 'upcoming_count' | 'next_dates' | 'default_venue_name' | 'default_cover_image_url'>): ReadyDot[] {
  const hasName = (s.name ?? '').trim().length > 0;
  const hasDate = (s.upcoming_count ?? 0) > 0 || (s.next_dates ?? []).length > 0;
  return [
    { key: 'when', label: 'Name and date', filled: hasName && hasDate },
    { key: 'venue', label: 'Venue', filled: !!s.default_venue_name?.trim() },
    { key: 'poster', label: 'Poster', filled: !!s.default_cover_image_url?.trim() },
  ];
}

export function readinessSummary(dots: ReadyDot[]): { ready: number; total: number; missing: string[]; text: string } {
  const missing = dots.filter((d) => !d.filled).map((d) => d.label);
  const ready = dots.length - missing.length;
  const text = `${ready} of ${dots.length} ready` + (missing.length ? ` \u2014 ${missing.map((m) => `${m} missing`).join(', ')}` : '');
  return { ready, total: dots.length, missing, text };
}
