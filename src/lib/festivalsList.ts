import { getSupabase } from '@/integrations/supabase/getSupabase';

/**
 * The single festivals-list fetch seam (M2: Website reads P5 natively).
 *
 * Four call sites used to run their own `.from('events').eq('type','festival')`
 * select -- FestivalHub, the /festivals SSR loader, useUpcomingFestivalsGlobal and
 * the search festival fallback. All four now share this one fetcher, backed by the
 * P5-native `get_public_festivals_list_v1` RPC (admin repo migrations
 * 20260717090000 + 20260717130000).
 *
 * The loader and FestivalHub MUST import the same fetcher and the same key: they
 * share one dehydrated cache entry, so a half-flip would leave the SSR document and
 * the client hook disagreeing about the payload shape (the PR #112 trap). Sharing
 * the module makes that structurally impossible rather than a review rule.
 *
 * The key is versioned (-v2) because the payload's source changed: a client holding
 * a cached `festival-events-live` entry from the legacy shape must not reuse it.
 */
export const FESTIVALS_LIST_QUERY_KEY = ['festival-events-live-v2'] as const;

/**
 * Field names are deliberately the legacy ones (`date`, `start_time`, `poster_url`)
 * so consumers render unchanged. Mapping from the RPC payload:
 *   id         <- event_id   (the legacy event id; /festival/:id links are unchanged)
 *   date       <- start_date (P5: COALESCE(series default_start_date, first occurrence))
 *   start_time <- starts_at  (a true UTC instant, resolved in the series' own timezone)
 */
export type FestivalListItem = {
  id: string;
  name: string | null;
  city: string | null;
  date: string | null;
  start_time: string | null;
  poster_url: string | null;
};

type FestivalsListRow = {
  event_id: string;
  name: string | null;
  city: string | null;
  start_date: string | null;
  starts_at: string | null;
  poster_url: string | null;
};

// Short-lived module cache. The search overlay calls this fetcher on every
// debounced keystroke and outside react-query, so without it each new term
// rebuilt the entire festivals projection server-side. 60s is well under the
// list's real change cadence; a rejected fetch is evicted immediately so an
// error never gets cached. (On the SSR server this memoizes across requests
// within the window, which is strictly less caching than the route's own ISR.)
const CACHE_TTL_MS = 60_000;
let cached: { at: number; promise: Promise<FestivalListItem[]> } | null = null;

async function fetchFestivalsListUncached(): Promise<FestivalListItem[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('get_public_festivals_list_v1' as never);
  if (error) throw error;
  return ((data ?? []) as FestivalsListRow[]).map((row) => ({
    id: row.event_id,
    name: row.name,
    city: row.city,
    date: row.start_date,
    start_time: row.starts_at,
    poster_url: row.poster_url,
  }));
}

export function fetchPublicFestivalsList(): Promise<FestivalListItem[]> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.promise;
  const entry = {
    at: now,
    promise: fetchFestivalsListUncached().catch((err: unknown) => {
      if (cached === entry) cached = null;
      throw err;
    }),
  };
  cached = entry;
  return entry.promise;
}

/**
 * The ONE "upcoming" boundary for festival lists. `date` is a London calendar
 * date key, so it is compared against the London today key, never the
 * browser/UTC date. Keep every surface (home rail, search fallback) on this
 * helper -- two hand-copied predicates diverging was a review finding.
 */
export function filterUpcomingFestivals(
  rows: FestivalListItem[],
  londonTodayKey: string,
): FestivalListItem[] {
  return rows.filter((f) => (f.date ?? '') >= londonTodayKey);
}
