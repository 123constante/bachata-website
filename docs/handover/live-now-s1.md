# Handover: Live now, slice 1 (website only)

Branch `claude/live-now-s1`. Brief: `brief/live-now-r1:docs/briefs/live-now-slice1.md`.
Plan: `docs/design/live-now-lag/PLAN.md` option C, steps 1 and 2. Slices 2
(admin emit + migration) and 3 (Done-screen check) are NOT started.

## What changed

1. `app/routes/api.revalidate.tsx`: a body with `stateChange: true` (or
   `state_change: true`; strictly boolean) on an event/festival write that is
   still public hard-deletes ONLY `event-<id>` (`dangerouslyDeleteByTag`) and
   soft-invalidates the rest of `purgeTagsFor`'s list. Never the whole list.
   Hidden events keep the existing full-list hard delete (checked first).
   Explicit `tags` and non-event entities ignore `stateChange`. If the hard
   delete succeeds and the soft invalidate throws, the route still schedules
   the Cloudflare purge for `event-<id>` only and returns 502.
   A body without `stateChange` behaves exactly as before.
2. `app/cloudflarePurge.ts`: `CF_URL_RULES[event-<id>]` gets `warmDataTwin`, so
   the warm sequence also fetches the canonical `/event/<slug>.data` (no query).
   `/festival/<slug>.data` stays unwarmed (accepted, documented).
3. Tests: `app/routes/api.revalidate.stateChange.test.ts` (new, 23 cases);
   4 warm rows updated in `app/cloudflarePurge.test.ts`.
   `app/routes/api.revalidate.test.ts` unchanged.
4. `docs/ops/cloudflare-purge.md` updated; `scripts/probe-live-now-headers.mjs`
   (post-deploy probe, 5 s steps, 2 min).

## Data source (proved, Supabase read-only)

`public._emit_cache_revalidation_v1(p_entity_type, p_entity_id, p_extra)` posts
`{entityType, entityId} || p_extra`. `apply_aggregate_write_p5`'s `p_extra` is
`{seriesId, occurrenceId, commandKind, auditId, citySlug}`. No prod function
mentions `stateChange` today, so this slice is dormant until slice 2's admin
emit sends it.

## Red first

Against the unfixed code the new file ran 13 failed / 7 passed: every
state-change row and the `.data` warm rows failed, and the "unchanged behaviour"
rows passed.

## Review

One independent review: nothing serious. Fixed: partial failure (hard ok and
soft fails), stale docs and comment, test gaps (call order, snake alias,
soft-fail), log text. Accepted, not changed: the hidden path also warms a
`.data` 404 (one uncached render); every event write now does one extra warm
render; the "slug change" hard-delete row differs only in `commandKind` (slug
coverage is the warm test with the sender's slug hint); the old slug URL stays
in Cloudflare for up to 300 s.

## Not verified

- Real response headers (`age`, `x-vercel-cache`, `cf-cache-status`): this
  worker's proxy cannot reach `www.bachatacalendar.co.uk` (curl 000). Run from
  a network that can, right after a TEST event cancel:
  `node scripts/probe-live-now-headers.mjs <slug> Cancelled`. The `.data` body
  may not contain the literal word, so read its headers and `age` column.
- Whether Vercel tags the `.data` response with `event-<id>` (the reviewer read
  `headers()` -> `cacheHeaders` as yes; not observed live).
- "Untouched save = no webhook" is a DB-side property (slice 2). On the website
  side, every body sent today has no `stateChange` and is tested to behave as before.
- Whole `test:unit` with contract suites needs the Supabase secret. Locally
  `tests/integrityCouldNotRun.test.ts` fails 5 tests on origin/main too (env).
- No browser walk: there is no UI change.
