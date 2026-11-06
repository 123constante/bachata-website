import type { EventWorkspace } from '../../events/eventModel';
import { L } from './labels';

/**
 * "Different on N dates" (FIXLIST #63): how many coming, not-cancelled dates own a value for
 * a field the organiser is about to edit for ALL dates. ONE mapping; every screen reads it.
 * Source: admin_event_workspace_p5 occurrences[].override_keys (parsed in shared/seriesModel).
 */
export type DifferentField = 'name' | 'about' | 'cover' | 'where' | 'ticket' | 'photos' | 'price' | 'music';

/** Which stored override keys make a date "different" for a field. Unknown keys count for nothing. */
export const OVERRIDE_KEYS_BY_FIELD: Record<DifferentField, readonly string[]> = {
  name: ['title'],
  about: ['description'],
  cover: ['cover_image_url'],
  where: ['venue_id', 'city_id'],
  ticket: ['ticket_url'],
  photos: ['gallery'],
  price: ['passes'],
  music: ['music_styles'],
};

export const DIFFERENT_FIELDS = Object.keys(OVERRIDE_KEYS_BY_FIELD) as DifferentField[];

/** Every key a date can own that is a "different details" key (a cancellation reason is not one). */
export const DETAIL_OVERRIDE_KEYS: readonly string[] = DIFFERENT_FIELDS.flatMap((f) => OVERRIDE_KEYS_BY_FIELD[f]);

export type DifferentCounts = Record<DifferentField, number>;

type Dated = Pick<EventWorkspace, 'dates'>;

export function differentDatesCount(ws: Dated, today: string): DifferentCounts {
  const counts = Object.fromEntries(DIFFERENT_FIELDS.map((f) => [f, 0])) as DifferentCounts;
  for (const d of ws.dates) {
    if (d.occurrence_date < today || d.lifecycle_status === 'cancelled') continue;
    for (const f of DIFFERENT_FIELDS) {
      if (OVERRIDE_KEYS_BY_FIELD[f].some((k) => d.override_keys.includes(k))) counts[f] += 1;
    }
  }
  return counts;
}

/** The read holds only the newest 100 dates: a count from it is not the whole series. */
export const datesAreCapped = (ws: Pick<EventWorkspace, 'hasMore' | 'total' | 'dates'>): boolean =>
  ws.hasMore || (ws.total !== null && ws.total > ws.dates.length);

/** The line's words, or null when no date is different. */
export function differentLine(n: number, capped: boolean): string | null {
  if (n <= 0) return null;
  return capped ? L.differentOnShown(n) : L.differentOn(n);
}

/** The line for one field of a workspace (null = show nothing). */
export function differentLineFor(ws: EventWorkspace, field: DifferentField, today: string): string | null {
  return differentLine(differentDatesCount(ws, today)[field], datesAreCapped(ws));
}
