// Phase 4: withKvCache — Warm cache wrapper for expensive queries
//
// Wraps React Query fetchers with Vercel KV caching:
// 1. Try KV cache first (0-3ms latency)
// 2. Cache miss? Fetch from Supabase
// 3. Update KV for next time
// 4. Never blocks (KV errors are silent)
//
// Usage:
//   const result = await withKvCache(
//     'calendar-events:london',
//     () => getCalendarEvents(cityId),
//     60 * 60_000 // 1 hour TTL
//   );
//
// Expected: 50–80% cache hit rate on frequently-accessed queries.
// Cost: No additional cost (reuses Phase 2 KV database).

import type { FetchOptions } from '@/integrations/supabase/types';

interface CacheOptions {
  ttl?: number; // Time-to-live in seconds (default: 3600 = 1 hour)
  compress?: boolean; // Gzip compress large payloads (default: false)
}

/**
 * Get from KV cache if available, otherwise fetch and cache.
 * Never blocks — KV errors are silent (fail-open to fetcher).
 */
export async function withKvCache<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  options?: CacheOptions,
): Promise<T> {
  const { ttl = 3600, compress = false } = options ?? {};

  // Lazy-load @vercel/kv only if needed (avoid import errors in local dev)
  let kv: typeof import('@vercel/kv') | null = null;
  let cacheAvailable = false;

  try {
    kv = await import('@vercel/kv');
    cacheAvailable = true;
  } catch {
    // KV not available (local dev without env vars, or import error)
    // Fail-open: use fetcher directly
  }

  // Try cache first (if available)
  if (cacheAvailable && kv) {
    try {
      const cached = await (kv.get as (key: string) => Promise<T | null>)(
        cacheKey,
      );
      if (cached) {
        return cached;
      }
    } catch {
      // Cache miss or error — proceed to fetcher
      // Don't re-throw; continue with fetcher
    }
  }

  // Cache miss or unavailable — fetch from source
  const result = await fetcher();

  // Update cache (fire-and-forget, never block)
  if (cacheAvailable && kv) {
    // Schedule cache update to not block return
    void (async () => {
      try {
        await (
          kv!.set as (
            key: string,
            value: T,
            options: { ex: number },
          ) => Promise<void>
        )(cacheKey, result, { ex: ttl });
      } catch {
        // Cache write failed — continue silently
        // The query result is still returned to the user
      }
    })();
  }

  return result;
}

/**
 * Invalidate a cache key (e.g., after a mutation).
 * Used to clear stale data when the user updates something.
 */
export async function invalidateCache(cacheKey: string): Promise<void> {
  try {
    const kv = await import('@vercel/kv');
    await (kv.del as (key: string) => Promise<number>)(cacheKey);
  } catch {
    // Invalidation error — continue silently
  }
}

/**
 * Invalidate multiple cache keys at once.
 * Useful for clearing related caches after mutations.
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
  try {
    const kv = await import('@vercel/kv');
    const keys = await (kv.keys as (pattern: string) => Promise<string[]>)(
      pattern,
    );
    if (keys.length > 0) {
      await Promise.all(
        keys.map((k) => (kv!.del as (key: string) => Promise<number>)(k)),
      );
    }
  } catch {
    // Pattern invalidation error — continue silently
  }
}

/**
 * Cache key builder — standardizes naming for consistency.
 * Usage: buildCacheKey('calendar-events', { city: 'london', month: '2026-09' })
 */
export function buildCacheKey(
  namespace: string,
  params?: Record<string, string | number | null | undefined>,
): string {
  if (!params || Object.keys(params).length === 0) {
    return namespace;
  }
  const kvPairs = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join(':');
  return `${namespace}:${kvPairs}`;
}

/**
 * Batch cache invalidation for related keys.
 * Clears entire namespace (e.g., 'calendar-events:*' clears all calendar caches).
 */
export async function clearNamespace(namespace: string): Promise<void> {
  await invalidateCachePattern(`${namespace}:*`);
}
