import { supabase } from '@/integrations/supabase/client';
import { wallClockDateKey } from '@/lib/time/wallClock';
import type { EventPageSnapshot, FestivalDetail } from '@/modules/event-page/types';

// ---------------------------------------------------------------------------
// Shared ["festival-event", id] query -- single source for the basic events row
// mounted by FestivalDetail and prefetched by the /festival/:id AND /event/:id
// loaders. The key + select MUST stay identical across call sites: the
// dehydrated server cache entry has to match the client hook's byte-for-byte
// or the client refetches (and the /event/<slug> festival SSR skeleton bug
// this module fixes comes back).
// ---------------------------------------------------------------------------

export const FESTIVAL_EVENT_SELECT =
  'id, name, city, date, start_time, poster_url, description, ticket_url, faq, meta_data';

export const festivalEventQueryKey = (eventId: string) => ['festival-event', eventId] as const;

export async function fetchFestivalEventRow(
  eventId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('events')
    .select(FESTIVAL_EVENT_SELECT)
    .eq('id', eventId)
    .eq('type', 'festival')
    .maybeSingle();
  if (error) throw error;
  return (data as Record<string, unknown> | null) ?? null;
}

// isFestival sniff shared by useEventPage (client) and the /event/:id loader
// (server) so the server prefetches exactly what the client will render.
// Gate on:
// - format === 'festival' (P5 canonical field, Phase 8 primary signal), OR
// - content-sniff fallback: MULTI-DAY schedule (>=2 distinct YYYY-MM-DD day
//   keys), OR festival passes (standard events never have passes).
// The content-sniff is kept as a COALESCE because legacy-only / null-format
// events must not misroute to "Festival not found" (plan Phase 8, critique
// P0-5). NB: a single dated day is NOT a festival signal -- P5 standard events
// mirror their program into legacy event_program_items with a concrete day,
// so "any YYYY-MM-DD day" mis-classified them. >=2 distinct days keeps real
// multi-day festivals while letting single-day standard events resolve
// correctly. NB: this is INTENTIONALLY not src/lib/eventFormat.ts's
// isFestivalByFormat -- the event page layers a richer content-sniff
// (multi-day schedule / passes) on top of `format === 'festival'` rather than
// a raw `type` fallback, so a null-format legacy festival still routes to the
// festival hub instead of "Festival not found".
export function sniffIsFestival(
  snapshot: Pick<EventPageSnapshot, 'event'> | null | undefined,
  festivalDetail: Pick<FestivalDetail, 'schedule' | 'passes'> | null | undefined,
): boolean {
  if (snapshot?.event.format === 'festival') return true;
  if (!festivalDetail) return false;
  // wallClockDateKey(day) is non-null exactly when day carries a YYYY-MM-DD
  // key (day values are date-only), matching the old anchored regex. Pure and
  // deterministic, so server + client still agree (see comment above).
  const distinctDays = new Set(
    festivalDetail.schedule.map((s) => wallClockDateKey(s.day)).filter((k): k is string => k !== null),
  );
  return distinctDays.size >= 2 || festivalDetail.passes.length > 0;
}
