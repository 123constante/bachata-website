import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { flags } from '@/lib/featureFlags';

export interface SearchResultEvent {
  id: string;
  name: string;
  poster_url: string | null;
  city_slug: string | null;
  event_type: string | null;
  start_time: string | null;
  /** v6: the series has ended (start_time is then null). */
  is_ended?: boolean | null;
  // search_public_v6 only (flags.searchV6). derived_level is null until the
  // series has enough dancer ratings; absent on v4/v5 envelopes.
  derived_level?: string | null;
  level_vote_count?: number;
}

export interface SearchResultOrganiser {
  id: string;
  name: string | null;
  avatar_url: string | null;
}

export interface SearchResultPerson {
  id: string;
  first_name: string | null;
  surname: string | null;
  display_name: string | null;
  photo_url: string | null;
  avatar_url: string | null;
  slug: string | null;
}

export interface SearchResultVenue {
  id: string;
  name: string | null;
  photo_url: string[] | null;
  address: string | null;
}

export interface SearchResultVendor {
  id: string;
  name: string | null;
  photo_url: string | null;
  short_description: string | null;
}

export interface SearchResultCity {
  id: string;
  name: string | null;
  slug: string | null;
  country_name: string | null;
  image_url: string | null;
}

export interface SearchResultsPayload {
  query: string;
  events: SearchResultEvent[];
  organisers: SearchResultOrganiser[];
  teachers: SearchResultPerson[];
  djs: SearchResultPerson[];
  dancers: SearchResultPerson[];
  venues: SearchResultVenue[];
  vendors: SearchResultVendor[];
  cities: SearchResultCity[];
  total_count: number;
  did_you_mean: string | null;
  // v6 only: null when no level is selected, otherwise how many matching
  // events the level filter hid because they are not rated yet.
  unrated_event_count?: number | null;
}

export interface SearchFilterOpts {
  includePast?: boolean;
  eventTypes?: string[];      // legacy `type` tokens (v5 only) — kept for back-compat
  formats?: string[];         // SHAPE: one_off|recurring|course|festival (v5 only)
  categories?: string[];      // GENRE: party|class|workshop|masterclass (v5 only)
  styles?: string[];          // v5 only
  dateFrom?: string | null;   // YYYY-MM-DD (v5 only)
  dateTo?: string | null;     // v5 only
  citySlugOverride?: string | null;
  levels?: string[];          // dancer-rated level (v6 only, flags.searchV6)
}

type RpcResult = { data: Partial<SearchResultsPayload> | null; error: { message: string } | null };
type RpcCaller = (fn: string, args: Record<string, unknown>) => Promise<RpcResult>;

export function useSearchResults(
  query: string,
  citySlug: string | null,
  opts: SearchFilterOpts = {},
) {
  const term = query.trim();
  const includePast = opts.includePast ?? false;
  const city = opts.citySlugOverride ?? citySlug;
  const etype = opts.eventTypes && opts.eventTypes.length ? opts.eventTypes : null;
  const formats = opts.formats && opts.formats.length ? opts.formats : null;
  const categories = opts.categories && opts.categories.length ? opts.categories : null;
  const styles = opts.styles && opts.styles.length ? opts.styles : null;
  const from = opts.dateFrom || null;
  const to = opts.dateTo || null;
  const levels = opts.levels && opts.levels.length ? opts.levels : null;
  const v6 = flags.searchV6;

  return useQuery<SearchResultsPayload>({
    // searchV5 is a build-time constant but keep it in the key so a flag flip
    // between builds never serves a stale v4 envelope. The v6 tail is only
    // appended when that flag is on, so the flag-off key is unchanged.
    queryKey: ['search-results', term, city, includePast, etype, formats, categories, styles, from, to, flags.searchV5, ...(v6 ? ['v6', levels] : [])],
    enabled: term.length > 0,
    // Phase 3 (IO optimization arc, resumed): 60s -> 3min.
    staleTime: 3 * 60_000,
    queryFn: async () => {
      // v6 is a strict superset of v5 (same args + p_level), so it wins when on.
      const fn = v6 ? 'search_public_v6' : flags.searchV5 ? 'search_public_v5' : 'search_public_v4';
      const args: Record<string, unknown> = v6 || flags.searchV5
        ? {
            p_query: term,
            p_city_slug: city,
            // Phase 5 (IO optimization arc, resumed): 12 -> 8 per section.
            p_section_limit: 8,
            p_include_past: includePast,
            p_event_type: etype,
            p_styles: styles,
            p_date_from: from,
            p_date_to: to,
            p_format: formats,
            p_category: categories,
            ...(v6 ? { p_level: levels } : {}),
          }
        : { p_query: term, p_city_slug: city, p_section_limit: 8, p_include_past: includePast };

      const { data, error } = await (supabase.rpc as never as RpcCaller)(fn, args);
      if (error) throw new Error(error.message);
      const d = data ?? {};
      // Read v5-only keys defensively so a v4 DB (vendors/cities/did_you_mean
      // absent) still resolves to a complete, well-typed envelope.
      const base = {
        query: d.query ?? term,
        events: d.events ?? [],
        organisers: d.organisers ?? [],
        teachers: d.teachers ?? [],
        djs: d.djs ?? [],
        dancers: d.dancers ?? [],
        venues: d.venues ?? [],
        vendors: d.vendors ?? [],
        cities: d.cities ?? [],
        total_count: d.total_count ?? 0,
        did_you_mean: d.did_you_mean ?? null,
      };
      if (!v6) return base;
      return {
        ...base,
        events: base.events.map((e) => ({
          ...e,
          derived_level: e.derived_level ?? null,
          level_vote_count: e.level_vote_count ?? 0,
        })),
        unrated_event_count: d.unrated_event_count ?? null,
      };
    },
  });
}
