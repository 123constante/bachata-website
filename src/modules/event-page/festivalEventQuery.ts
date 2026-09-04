import { supabase } from '@/integrations/supabase/client';
import { wallClockExactDateKey } from '@/lib/time/wallClock';
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
  if (data) return data as Record<string, unknown>;
  // Legacy miss is NOT proof of absence any more -- see below.
  return fetchFestivalEventRowFromP5(eventId);
}

// M2 fallback. A PURE-P5 series (event_series_p5.legacy_event_id IS NULL) has no
// row in legacy `events` at all, so the read above misses and the festival hub
// dies: FestivalDetail renders "Festival not found", and /festival/:id throws a
// hard 404+noindex (app/routes/festival.tsx gates on this query). The public URL
// id resolvePublicEventRef hands us for such a series IS the series id, so ask
// event_view_p5 instead.
//
// Why that RPC and not a direct event_series_p5 read: it is anon-callable
// SECURITY DEFINER, its snapshot_compat branch resolves
// `legacy_event_id = <id> OR (id = <id> AND legacy_event_id IS NULL)` -- exactly
// the pure-P5 case -- and it filters lifecycle_status IN ('live','paused','ended'),
// returning NULL otherwise, so it IS the visibility gate. A direct table read
// would not be one: event_series_p5's anon RLS is still behind
// FF_DB_SELF_SERVE_RLS.
//
// That list said ('live','paused') until 2026-09-04. It was true when written and
// the series-termination arc's P4a migration widened it; measured against the
// live function body that day. The correction matters: read the old version and
// a pure-P5 festival that has ENDED looks like a hard 404, so the ended treatment
// on this page would read as unreachable code. It is reachable on both branches
// -- a bridged series arrives through the legacy read above, whose lifecycle
// filter is `events.lifecycle_status = 'published'`, which is what 'ended' mirrors
// to.
//
// The returned object carries the SAME ten keys as FESTIVAL_EVENT_SELECT so the
// `as FestivalEvent` cast in FestivalDetail and the dehydrated
// ['festival-event', id] entry stay identical whichever path produced them. The
// four legacy-only columns are null: `date`/`start_time` because the real dates
// come from get_public_festival_detail_v2 (and events.start_time may never be
// consumed -- see the FestivalEvent type's note on its unbrandable mix of
// instants and wall clocks), `faq`/`meta_data` because the compat payload has no
// equivalent.
async function fetchFestivalEventRowFromP5(
  eventId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.rpc('event_view_p5' as never, {
    p_target: { series_id: eventId },
    p_viewer: { role: 'anon', shape: 'snapshot_compat' },
  } as never);
  // Rethrow: a transient RPC error must surface as a retryable 500, not 404 a
  // live festival (the legacy branch above rethrows for the same reason).
  if (error) throw error;
  const snap = data as P5CompatSnapshot | null;
  const ev = snap?.event;
  // Mirrors the legacy `.eq('type','festival')` filter: a non-festival series
  // must still resolve to null so the caller 404s rather than rendering a party
  // in the festival hub. `format` is the P5 canonical field the compat payload
  // derives its legacy `type` from.
  if (!ev || ev.format !== 'festival') return null;
  return {
    id: eventId,
    name: ev.name ?? '',
    city: nonEmpty(snap?.location_default?.city?.name),
    date: null,
    start_time: null,
    poster_url: nonEmpty(ev.cover_image_url),
    description: nonEmpty(ev.description),
    ticket_url: nonEmpty(ev.actions?.ticket_url),
    faq: null,
    meta_data: null,
  };
}

// The compat RPC emits '' (not NULL) for an unset description, where the legacy
// column would be NULL. Normalise so both paths produce the same row.
function nonEmpty(v: string | null | undefined): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

// Only the handful of fields the festival basic-row shape needs; the compat
// payload is much wider (see _event_view_snapshot_compat_v1).
interface P5CompatSnapshot {
  event?: {
    name?: string | null;
    format?: string | null;
    description?: string | null;
    cover_image_url?: string | null;
    actions?: { ticket_url?: string | null } | null;
  } | null;
  location_default?: { city?: { name?: string | null } | null } | null;
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
  // wallClockExactDateKey is non-null only for a bare date-only value, exactly
  // reproducing the old anchored /^\d{4}-\d{2}-\d{2}$/ match (a time-suffixed
  // day is NOT counted). Pure + deterministic, so server + client agree.
  const distinctDays = new Set(
    festivalDetail.schedule.map((s) => wallClockExactDateKey(s.day)).filter((k): k is string => k !== null),
  );
  return distinctDays.size >= 2 || festivalDetail.passes.length > 0;
}
