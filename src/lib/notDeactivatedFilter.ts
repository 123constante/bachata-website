/**
 * The "not explicitly deactivated" visibility filter, shared across every
 * public read of dancer_profiles / organiser_profiles that decides whether a
 * row is servable.
 *
 * `.not('is_active', 'is', false)`, never `.eq('is_active', true)`: is_active
 * is NULL on most rows in both tables (38 of 40 organisers, 68 of 150 dancers,
 * measured 2026-09-02), so an equality gate would empty the directory. Treat
 * those numbers as an illustration of the SHAPE, not a current fact -- the
 * organiser figure was written as "32 of 34" on 2026-09-01 and was already
 * wrong a day later. Re-measure before relying on it.
 *
 * Call sites -- ALL of them. A partial census is the exact failure this
 * constant exists to end, so keep this list complete or delete it outright;
 * a list that half-rots is worse than none, because it reads as authoritative.
 * (Its first version claimed "three call sites" while five existed.)
 *
 *   Using the constant:
 *     - src/modules/profile/organiserPublicProfile.ts  organiser entity fetch
 *     - app/routes/sitemap.tsx                         dancer query
 *     - app/routes/sitemap.tsx                         organiser query
 *     - app/routes/dancers.tsx                         SSR loader
 *     - src/pages/DancerProfile.tsx                    client query, same cache key
 *     - src/hooks/useDirectoryCounts.ts                organiser head-count
 *     - src/pages/Organisers.tsx                       organiser directory
 *
 *   NOT using it, deliberately:
 *     - src/pages/Dancers.tsx spells the SAME predicate a THIRD way, as
 *       `.or('is_active.is.null,is_active.eq.true')`. Semantically identical
 *       (NULL or true), but a different PostgREST expression -- so a grep for
 *       `.not('is_active'` cannot see it, which is precisely how the original
 *       census came to be wrong. Migrating it is behaviour-identical but
 *       touches the main dancers directory, so it is queued rather than folded
 *       into the soft-404 branch.
 *
 * Everything else matching /is_active/ under src/ is a DIFFERENT table (events,
 * videographers, organiser members) or the generated Supabase types -- not this
 * profile-visibility predicate. Check the table before adding a row above.
 */
export const NOT_DEACTIVATED = ["is_active", "is", false] as const;
