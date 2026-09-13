// Phase 4: Cached query fetchers
// Wraps expensive RPCs with Vercel KV caching (50-80% hit rate expected)
//
// These are used by React Query hooks to transparently cache data.
// Cache hits return instantly from KV (~2-3ms), misses fetch from Supabase
// and update the cache for next time.

import { withKvCache, buildCacheKey } from '@/lib/queryCache';
import { getLatestEvents } from '@/integrations/supabase/eventRpcs';
import { rpcLoose as callRpc } from '@/integrations/supabase/rpcLoose';

// ─── Latest Events Cache ───────────────────────────────────────────────────

/**
 * Cached wrapper around getLatestEvents.
 * Cache key: latest-events:city=<slug>:limit=<limit>
 * TTL: 15 minutes (these events don't change frequently, but are important to stay somewhat fresh)
 */
export async function getCachedLatestEvents(
  params: { p_city_slug: string | null; p_limit: number },
) {
  const cacheKey = buildCacheKey('latest-events', {
    city: params.p_city_slug || 'global',
    limit: params.p_limit,
  });

  return withKvCache(
    cacheKey,
    () => getLatestEvents(params),
    { ttl: 15 * 60 }, // 15 minutes
  );
}

// ─── Calendar Events Cache ────────────────────────────────────────────────

/**
 * Cached wrapper around calendar events (home page calendar).
 * Cache key: calendar-events:city=<slug>:from=<date>:to=<date>
 * TTL: 1 hour (stable data, changes happen at event creation/edit)
 */
export async function getCachedCalendarEvents(params: {
  p_city_slug: string | null;
  p_from: string;
  p_to: string;
}) {
  const cacheKey = buildCacheKey('calendar-events', {
    city: params.p_city_slug || 'global',
    from: params.p_from,
    to: params.p_to,
  });

  return withKvCache(
    cacheKey,
    () =>
      callRpc('get_public_events_list_v2', params).then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return data;
      }),
    { ttl: 60 * 60 }, // 1 hour
  );
}

// ─── Map Events Cache ────────────────────────────────────────────────────

/**
 * Cached wrapper around map events (home map data).
 * Cache key: map-events:city=<slug>:limit=<limit>
 * TTL: 2 hours (map data is less time-critical, mostly static)
 */
export async function getCachedMapEvents(params: {
  p_city_slug: string | null;
  p_limit?: number;
}) {
  const cacheKey = buildCacheKey('map-events', {
    city: params.p_city_slug || 'global',
    limit: params.p_limit || 50,
  });

  return withKvCache(
    cacheKey,
    () =>
      callRpc('get_map_events_v1', params).then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return data;
      }),
    { ttl: 2 * 60 * 60 }, // 2 hours
  );
}

// ─── Raffle Community Stats Cache ────────────────────────────────────────

/**
 * Cached wrapper around raffle stats.
 * Cache key: raffle-stats
 * TTL: 30 minutes (community stats update slowly)
 */
export async function getCachedRaffleStats() {
  const cacheKey = 'raffle-stats:global';

  return withKvCache(
    cacheKey,
    () =>
      callRpc('get_raffle_community_stats_v1').then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return data;
      }),
    { ttl: 30 * 60 }, // 30 minutes
  );
}

// ─── Open Raffles Cache ──────────────────────────────────────────────────

/**
 * Cached wrapper around open raffles list.
 * Cache key: open-raffles
 * TTL: 5 minutes (combined with Phase 3 visibility-based refresh)
 */
export async function getCachedOpenRaffles() {
  const cacheKey = 'open-raffles:global';

  return withKvCache(
    cacheKey,
    () =>
      callRpc('list_open_raffles_v1').then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return data;
      }),
    { ttl: 5 * 60 }, // 5 minutes
  );
}

// ─── Profile Program Appearances Cache ───────────────────────────────────

/**
 * Cached wrapper around a profile's program appearances (schedule page).
 * Cache key: profile-program:profile_id=<id>:type=<type>
 * TTL: 30 minutes (profile schedule doesn't change during a session)
 */
export async function getCachedProfileProgramAppearances(params: {
  p_person_id: string;
  p_profile_type: string;
}) {
  const cacheKey = buildCacheKey('profile-program', {
    person_id: params.p_person_id.slice(0, 8), // Truncate UUID for brevity
    type: params.p_profile_type,
  });

  return withKvCache(
    cacheKey,
    () =>
      callRpc('get_profile_program_appearances_v1', params).then(
        ({ data, error }) => {
          if (error) throw new Error(error.message);
          return data;
        },
      ),
    { ttl: 30 * 60 }, // 30 minutes
  );
}

// ─── Directory Counts Cache ──────────────────────────────────────────────

/**
 * Cached wrapper around directory counts (how many dancers, teachers, etc.).
 * Cache key: directory-counts:city=<slug>
 * TTL: 1 hour (counts update slowly)
 */
export async function getCachedDirectoryCounts(params: {
  p_city_slug: string | null;
}) {
  const cacheKey = buildCacheKey('directory-counts', {
    city: params.p_city_slug || 'global',
  });

  return withKvCache(
    cacheKey,
    () =>
      callRpc('get_directory_counts_v1', params).then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return data;
      }),
    { ttl: 60 * 60 }, // 1 hour
  );
}
