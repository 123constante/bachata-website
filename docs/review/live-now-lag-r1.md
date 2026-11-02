# Review: live-now-lag r1 (PR #1260) &mdash; verdict BLOCK (two doc edits, then PASS)

Reviewer: fresh-eyes cloud worker, read-only. Reviewed `claude/live-now-lag-r1`
at `17514e1` (`docs/design/live-now-lag/INVENTORY.md`, `PLAN.md`,
`docs/handover/live-now-lag-r1.md`) against `main` at `ff20808` and read-only
prod (`stsdtacfauprzrdebmzg`, SELECT only, counts and timings only).

## Verdict

**BLOCK** &mdash; the measurement and most of the inventory are sound and
honestly labelled, but two parts of the RECOMMENDED design would send the next
builder the wrong way, and the PR already carries `automerge-ok`:

1. The organiser "Live now" check reads a `version` field from the public
   `.data` payload that **does not exist** (confirmed in prod, F1).
2. Option C's hard delete is scoped to ALL the tags the webhook sends, which
   includes `city-<slug>` and `seo-landing`, so every cancel would cold-render
   the busiest page on the site plus nine SEO pages, not "one cold SSR" (F2).

Both are fixable in PLAN.md in a few lines. With F1 and F2 edited and the
inventory omissions in F3 added, this is a PASS.

## Findings, ranked

### F1 (design, blocks) &mdash; "Live now" reads a field the public payload does not carry

PLAN.md "Organiser Live now check": poll `GET /event/<slug>.data` and read
"the loader's series `version`". Evidence that no such field exists:

- `app/routes/event.tsx` loader (lines 180-210) ships `dehydratedState`, `title`,
  `description`, `ogImage`, `slug` &mdash; no `version`, no `updated_at`
  (`grep -n "version\|updated_at" app/routes/event.tsx` returns nothing).
- Prod, read-only: `pg_proc.prosrc` of `public.event_view_p5` contains no
  `'version'` key and no `updated_at` (query on 2026-11-02, both false);
  `admin_event_workspace_p5` has both. So the public RPC the loader dehydrates
  cannot expose what the check compares.
- `src/modules/organiser/flows/doneState.ts:4-12`: `DoneState` carries `title`,
  `message`, `seriesId` (nullable), `next`, `back`. No slug, no saved version. The
  Done screen (`Done.tsx:57-62`) cannot build the `.data` URL or the comparison
  value without new plumbing from `useEventSend.ts:18` / `LifecycleActions.tsx:120`.

Failing scenario: builder implements the poll as written; the loader JSON has no
`version`; `undefined >= n` is false forever; every organiser sees "Saved &mdash;
the public page can take a few minutes" after 5 minutes, never "Live now".

Required edit: state that the check needs an admin migration adding a public
`version` (or `updated_at`) to `event_view_p5`'s payload and a loader change to
surface it, and count that in option C's cost. Do NOT fall back to comparing
content fields (`is_cancelled`, start time): a cancel-then-restore in one minute
makes the stale pre-cancel copy equal the current state, a false "Live now".

### F2 (design, blocks) &mdash; hard delete on the full tag list cold-renders the city home and nine SEO pages per state change

PLAN.md option C step 1: "use `dangerouslyDeleteByTag` ... when the webhook says
the write changed public STATE". The existing call site is
`app/routes/api.revalidate.tsx:142` and it passes `tags` &mdash; the whole list
from `purgeTagsFor` (`app/cacheTags.ts:174-181`): for a London event that is
`event-<id>`, `city-london-gb`, `seo-landing`. `seo-landing` is stamped by the
nine pages in `app/cloudflarePurge.ts:48-58`; `city-london-gb` by every
`/city/london-gb` response (`app/routes/home.tsx:294-304`).

`app/edgeCacheControl.ts` (comment block, "THE BUSY-ROUTE RE-WEIGH") records that
a forced miss on `/city/:slug` is the site's most-requested document and was
weighed deliberately. PLAN.md claims "Cost: one cold SSR per state change" and
"Risk: low". Both are wrong at the stated scope: it is up to 11 synchronous cold
renders per cancel, on a Hobby team already over its CDN cap
(`docs/ops/cloudflare-purge.md:24-26`).

Failing scenario: organiser cancels during a Friday-evening peak; the next
visitor to `/city/london-gb` blocks on a cold SSR instead of a HIT; the nine
SEO pages do the same for crawlers; repeat for every state change that evening.

Required edit: hard-delete ONLY `event-<id>` (the page whose stale copy is the
owner's complaint); keep `invalidateByTag` for `city-*` and `seo-landing`. The
test at `app/routes/api.revalidate.test.ts:136,144` pins the hidden-event path
to the full list, so the acceptance row must say which tags go to which call.

### F3 (inventory, must add) &mdash; "none silently omitted" is not true

Public surfaces that show event state and are absent from INVENTORY.md:

- `/tonight` and `/city/:slug/tonight` &mdash; `src/components/AnimatedRoutes.tsx:141-142`,
  `src/pages/Tonight.tsx:138-140`: client RPC through `get_calendar_events`,
  **5-min** `staleTime` (`Tonight.tsx:138`). The brief named "tonight" and the
  inventory folds it into #3 (`/city/:slug` home), a different route with a
  different cache (edge ISR vs client RPC). Not edge-cached, so no purge gap, but
  it is its own open-tab staleness (5 min, not 1 h) and belongs in the matrix.
- `/search`, `/city/:slug/search` (`src/pages/SearchResults.tsx`), `/parties`,
  `/classes` (prerendered shells, `react-router.config.ts:33-40`, with a
  client-only `EventCalendar`) &mdash; client RPC like #4.
- `/venues`, `/organisers` (list) &mdash; catch-all client pages.

None change the root cause; they change the coverage count (16 public is
really 21+) and the claim "none silently omitted". Required edit: add the rows,
restate the count.

### F4 (matrix) &mdash; `/event/:id` "ended (time passed)" cell contradicts the inventory

PLAN.md matrix: `/event/:id` x ended = "TTL bound (no emit, G5)". INVENTORY #1
says the event page passes **no bound** (`app/routes/event.tsx:209`,
`stampEvent(eventId)` with no third argument; `app/detailLoader.ts:130-139`
then emits the default 3600 + 86400). `occurrence.isPast` is server-computed and
used for the first paint (`src/modules/event-page/bento/BentoPage.tsx:211-222`),
and `meta()` ships the ended share description (`event.tsx:17,205`). So a
crawler or the pre-hydration paint can read "not ended" for up to 25 h. Either
the plan adds a bound for `/event/:id` (as `home.tsx:287-304` does) and the cell
says so, or the cell must say "NOT covered".

### F5 (design race) &mdash; the Live-now poll can itself re-cache the stale copy

The poll goes "through Cloudflare, same origin" every 5 s. The `.data` twin is
purged but never warmed (`app/cloudflarePurge.ts:285,412-416` warm only the
canonical page). A poll that lands after Cloudflare pass 1 and before Vercel's
background re-render finishes stores the stale `.data` in Cloudflare for 300 s
(the plan's own G3). With F2's narrowed hard delete this goes away for
`/event/<slug>.data` (Vercel renders fresh on the next request), so the plan
should say the poll is only safe AFTER the hard delete lands, and that it must
not poll a cache-busting variant (each variant is a new Cloudflare entry;
prefix purges are rate-limited, `cloudflare-purge.md:236`).

### F6 (nit) &mdash; measurement wording

- "typical ~10-20 s" for the warmed event page is an estimate from the 10 s
  settle (`CF_DEFAULT_SETTLE_MS`, `cloudflarePurge.ts:31`), not a measurement. It
  sits in a table headed "derived from code, not measured", which is honest, but
  the number should say "settle 10 s + render" rather than read as observed.
- `pg_net` retention: the plan says 48 responses, oldest 17:41 UTC; at review
  time 33 responses, oldest 18:45 UTC, newest 00:30 UTC. Consistent with ~6 h.
- Cloudflare 300 s and the cache rule name come from `docs/ops/cloudflare-purge.md:3-5`,
  not headers; the plan says so. OK.

### F7 (nit) &mdash; option A's RPC name and mapping

Option A proposes a new anon RPC `public_event_state_v1`. The cancel state the
page already renders comes from the loader snapshot (`occurrenceEffective`,
`BentoPage.tsx:205`), so the overlay must diff against that shape and reuse the
same status words (`src/modules/organiser/shared/eventState.ts:26-34` is the
organiser side; the public side's mapping should be named). Fine as a queued
option; the "one mapping" rule is already called out.

## The five questions

1. **Every surface in the inventory?** No &mdash; F3. The 16 public and 9 organiser
   rows that ARE there are correct (every file:line spot-checked: `event.tsx:209-213`,
   `organiser.tsx:165-171` TTL 0, `venue-entity.tsx:65`, `home.tsx:287-304,380-385`,
   `api.og.card.tsx:100`, `api.ics.calendar.tsx:194`, `api.embed.calendar.tsx:198`,
   `detailLoader.ts:130-139`, staleTimes `useEventPageQuery.ts:391`,
   `useCalendarEventsRpc.ts:31`, `useMapEvents.ts:52`, O1-O9 lines all match).
2. **Root cause supported by numbers?** The 33 ms is real: override and occurrence
   rows `updated_at` 19:19:39.002898, webhook response `created` 19:19:39.036232,
   tags `event-<uuid>`, `city-london-gb`, `seo-landing`, HTTP 200 (prod, counts
   only). Only ONE event pair exists in retention (the rest are person-tag
   purges), as the plan says. Everything downstream of the purge is inferred
   from code and is labelled so; nothing inferred is presented as measured.
   The "G3 race or open tab" root cause is plausible but unproven &mdash; stated.
3. **Option C and the Live-now check.** F1, F2, F5. Zero bytes to `/app` first
   load holds for C; the Done-screen poll lives in the lazy organiser chunk.
   Cancelled / moved / on-now: cancel and move are purge-driven and covered; the
   on-now and ended transitions are time-driven and the event page has no bound
   (F4) &mdash; the plan should say the Live-now check does not cover them.
4. **Calendar protected files.** No option touches `EventCalendar.tsx`,
   `calendar/*` or `useCalendarEvents.tsx`. G6 names the calendar's open-tab
   staleTime (`useCalendarEventsRpc.ts:31`, not a protected file) and no option
   changes it. PASS.
5. **Acceptance matrix complete?** No: missing surfaces (SEO landing pages,
   `/tonight`, ICS/embed, OG head tags, open-tab G6) and missing states (venue
   move, cancel then restore, slug change). F4 cell contradiction. The
   `purgeTagsFor x stateChange` test must also pin WHICH tags are hard-deleted (F2).

## Verified / Not verified

**Verified (read-only):** every file:line cited above against `main` `ff20808`;
the 33 ms save-to-purge pair and the ~6 h `pg_net` retention in prod; that
`event_view_p5` exposes no `version` / `updated_at` and
`admin_event_workspace_p5` does; that `/event/:id` passes no TTL bound; that
no option touches a protected calendar file; PR #1260 checks: 23 success,
8 skipped (preview-gated), 0 failed, `mergeable_state: clean`.

**Not verified:** live response headers (`age`, `cf-cache-status`,
`x-vercel-cache`) &mdash; this worker's proxy also refuses
`www.bachatacalendar.co.uk`; whether `/venue-entity/:id` SSR embeds its event
list (G2 severity, same gap as the builder); the exact `.data` URL shape React
Router 7 expects for a single-route fetch (`?_routes=`), which the Live-now
poll must match.
