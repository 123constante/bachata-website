# Live-now lag: root cause and plan (r1, 2026-11-01; review fixes 2026-11-02)

Docs only. No code, no migration, no prod write. Inventory first:
[`INVENTORY.md`](INVENTORY.md) (22 public + 9 organiser rows, gaps G1-G7).
Review: `docs/review/live-now-lag-r1.md` (BLOCK; F1-F7 applied below).

## What was measured, and how

**Network limit (honest):** this cloud worker's proxy refuses
`www.bachatacalendar.co.uk` and `api.vercel.com` (`CONNECT tunnel failed, 403`).
So the brief's step 1 (fetch the public page at 30 s steps, read `age`,
`x-vercel-cache`, `cf-cache-status`) **was not run**. TTLs below are read from
code and the Cloudflare doc, not from response headers.

**Save &rarr; purge (measured, Supabase read-only, counts and timings only):**

| Save | Save time (`event_occurrence_p5.updated_at` / override) | Webhook response (`net._http_response.created`) | Lag | Result |
|---|---|---|---|---|
| Bailando cancel (owner's example) | 19:19:39.003 UTC | 19:19:39.036 UTC, HTTP 200, tags `event-a37541a0&hellip;`, `city-london-gb`, `seo-landing` | **33 ms** | ok |

Only one event save falls inside `pg_net`'s response retention (about 6 h:
48 responses, all 200, oldest 17:41 UTC at r1 time; the reviewer saw 33
responses, oldest 18:45, newest 00:30 UTC &mdash; consistent with ~6 h). Last 7 days of writes: 253
occurrence rows, 15 series rows, 13 override rows &mdash; older saves cannot be
paired with their webhook any more. **The DB-to-purge leg is not the lag.**

**Purge &rarr; public page (derived from code, not measured):**

| Surface | Worst case after save | Why |
|---|---|---|
| `/event/:id` HTML (canonical, warmed) | best case = 10 s settle (`CF_DEFAULT_SETTLE_MS`, `cloudflarePurge.ts:31`) + one render (an estimate, NOT observed); **up to ~310 s** | Vercel `invalidateByTag` is SOFT: the next request gets the stale copy and starts a re-render. CF pass 1 &rarr; warm (gets stale) &rarr; wait 10 s &rarr; pass 2. If Vercel's re-render is not done when the next post-pass-2 request lands, Cloudflare caches the stale copy again for 300 s |
| `/event/<slug>.data` (client nav from city/calendar) | up to ~310 s | purged but never warmed (G3): first miss after pass 2 can store Vercel's stale copy for 300 s |
| `/city/london-gb` | as the event page (warmed) | same soft-purge race |
| SEO landing (9) | up to ~310 s | not warmed (G3) |
| `/organisers/:id` | up to 300 s | no emit (G1); Vercel TTL 0, CF 300 s |
| `/venue-entity/:id` | up to 3600 s + SWR | no venue tag purged on an event write (G2) |
| ICS / embed | 6 h / 5 min | no purge (G4) |
| `/event/:id` ended / on-now (time-driven) | up to ~25 h (3600 + SWR 86400) | no TTL bound on the event route, no emit (G5, G7) |
| Open SPA tab (calendar, map, event) | 1-2 h, or next focus | React Query `staleTime` (G6) |
| Open SPA tab (tonight, venues, organisers list, search) | 1-30 min, or next focus | React Query `staleTime` (G6) |

**Root cause of the owner's example:** the purge landed in 33 ms; the "few
minutes" matches the 300 s Cloudflare HTML TTL re-holding a stale copy that
Vercel's soft invalidate served once (G3 race), or an already-open tab (G6).
Which of the two it was cannot be told without the headers this worker could
not fetch &mdash; see Not verified.

## Options

### A. Client-side live overlay on the cached event page

After hydration, `/event/:id` calls a tiny anon RPC (new, admin repo:
`public_event_state_v1(p_id)` &rarr; `lifecycle_status`, occurrence
`cancelled`, effective start, `version`) and, if it differs from the SSR
snapshot, overlays "Cancelled" / "Moved to &hellip;" in a space reserved at SSR.
The SSR snapshot it diffs against is the loader's `occurrenceEffective`
(`src/modules/event-page/bento/BentoPage.tsx:205`), so the RPC must return that
shape and the overlay must reuse the status words the public page already
renders (the public-side mapping is to be named by the builder; the organiser
side is `src/modules/organiser/shared/eventState.ts:26-34`). One mapping, never
two copies (review F7).
- **Cost:** one small Supabase call per event page view; a new RPC + contract
  check (`scripts/check-*.mjs`).
- **Risk:** CLS if space is not reserved; hydration mismatch if rendered before
  hydration (render post-effect only); two sources of truth for status &mdash;
  must reuse ONE status mapping (CLAUDE.md DoD 2).
- **Bytes:** lazy chunk on `/event` only, est. 1-2 KB gz; **0 bytes to the
  `/app` first load**. Fixes G3 and G6 for the event page; not other surfaces.

### B. Shorter TTLs

Cloudflare HTML 300 s &rarr; 60 s for `/event/*` and `/city/*`.
- **Cost:** CF hit ratio falls; more Vercel CDN requests and SSR renders while
  the Hobby team is already over its 1M CDN requests/month cap
  (`docs/ops/cloudflare-purge.md`). **Risk: high (budget).**
- **Bytes:** 0. Caps the lag at ~70 s, does not remove it, does not fix G1/G2/G4/G6.

### C. Hard purge on a state change + close the missing surfaces

1. In `/api/revalidate`, when the webhook says the write changed public STATE
   (cancel, move, time, status &mdash; the body gains e.g. `stateChange: true`
   from the admin emit), hard-delete **ONLY the `event-<id>` tag** with
   `dangerouslyDeleteByTag([eventTag(id)])` and keep the soft
   `invalidateByTag` for the rest of `purgeTagsFor`'s list (`city-<slug>`,
   `seo-landing`, or `home-feed` when the city is unresolved). Next request to
   the event page renders fresh; no stale copy for Cloudflare to re-hold.
   **Why not the whole list (review F2):** the existing hidden-event call at
   `app/routes/api.revalidate.tsx:142` passes ALL of `tags`, which for a
   London event is `event-<id>`, `city-london-gb`, `seo-landing`
   (`app/cacheTags.ts:174-181`). `seo-landing` is stamped by nine pages
   (`app/cloudflarePurge.ts:48-58`) and `city-london-gb` by every
   `/city/london-gb` response (`app/routes/home.tsx:294-304`), the site's
   most-requested document (`app/edgeCacheControl.ts`, "THE BUSY-ROUTE
   RE-WEIGH"). Hard-deleting those would force up to 11 synchronous cold
   renders per cancel on a Hobby team already over its CDN cap
   (`docs/ops/cloudflare-purge.md:24-26`). The city home and SEO pages instead
   keep today's behaviour: soft purge (stale served once, background re-render)
   plus Cloudflare's 300 s TTL, and `/city/:slug`'s own next-rollover bound.
   Their residual lag (up to ~310 s, G3) is accepted and stated, not fixed by C.
   Whether the existing hidden-event path should also narrow is out of scope;
   it is left as is and pinned by `app/routes/api.revalidate.test.ts:136`.
2. Warm the `.data` twin of the event page in the CF sequence (G3).
3. Admin repo: emit `venue-<id>` with event writes (G2), an `organiser` emit
   (G1), and cover the non-emitting writes (G5).
4. Optional, separate decision: give `/event/:id` a TTL bound at its next
   ended / on-now boundary as `home.tsx:287-304` does (G7). Without it the
   time-driven states stay uncovered (see the matrix).
- **Cost:** one cold SSR of the ONE event page per state change (rare: 13
  overrides in 7 days); city and SEO pages unchanged. Admin migration for the
  emit payload (`stateChange`, venue/organiser emits). **Plus, for the
  Live-now check below:** a second admin migration so `event_view_p5`'s public
  payload carries a `version` (or `updated_at`), a loader change in
  `app/routes/event.tsx` to surface it in the `.data` JSON, and Done-screen
  plumbing (slug + saved version into `DoneState`). That is three repos/layers,
  not a Done-screen-only change.
- **Risk:** low for the event page &mdash; the hard-delete call exists and is
  tested (`app/routes/api.revalidate.test.ts:130-145`); the new call is
  narrower than the existing one. A cold render of one event page under load
  is the cost. Risk would be HIGH if the full tag list were hard-deleted (above).
- **Bytes:** 0 client bytes for steps 1-4. Does not fix open tabs (G6).

## Organiser "Live now" check (for any option)

**What exists today (review F1, confirmed):** nothing the check can compare.
- The public `/event/<slug>.data` payload carries no `version` and no
  `updated_at`: the loader (`app/routes/event.tsx:180-210`) ships
  `dehydratedState`, `title`, `description`, `ogImage`, `slug` only, and the
  public RPC it dehydrates, `event_view_p5`, has neither key (prod
  `pg_proc.prosrc`, read-only, per the review). Only the organiser-side
  `admin_event_workspace_p5` has them.
- The Done screen cannot build the URL or the comparison value:
  `DoneState` (`src/modules/organiser/flows/doneState.ts:4-12`) carries `title`,
  `message`, `seriesId` (nullable), `next`, `back` &mdash; no slug, no saved
  version. It is filled from `flows/event/useEventSend.ts:18` and
  `events/LifecycleActions.tsx:120`.

**So the check needs, in order:**
1. Admin migration: add a public `version` (or `updated_at`) to
   `event_view_p5`'s payload, with a contract check in this repo
   (`scripts/check-*.mjs`).
2. Loader: `app/routes/event.tsx` surfaces it in the `.data` JSON.
3. Plumbing: the send/lifecycle hooks put the event slug and the version the
   command returned into `DoneState`.
4. Done screen (O1, `src/modules/organiser/flows/Done.tsx`): poll the real
   public artifact, `GET /event/<slug>.data` on the canonical URL only (same
   origin, through Cloudflare), every 5 s for up to 5 min. "Live now" when
   public version &ge; saved version; after 5 min, "Saved &mdash; the public
   page can take a few minutes".

**Rejected fallback:** comparing content fields (`is_cancelled`, start time)
instead of a version. A cancel-then-restore within a minute makes the stale
pre-cancel copy equal the current state &mdash; a false "Live now".

**Ordering constraint (review F5):** the `.data` twin is purged but never
warmed (`app/cloudflarePurge.ts:285,412-416`). Before option C step 1 lands, a
poll that arrives after Cloudflare pass 1 and before Vercel's background
re-render finishes would itself store the stale `.data` in Cloudflare for
300 s (G3) &mdash; the check would cause the lag it reports. So the poll ships
only AFTER the narrowed hard delete of `event-<id>`. It must not add a
cache-busting query (each variant is a new Cloudflare entry; prefix purges are
rate-limited, `docs/ops/cloudflare-purge.md:236`). The exact single-route
`.data` URL shape React Router 7 expects (`?_routes=`) is to be confirmed by the
builder; if it requires a query, that query must be the fixed one the app
itself uses, so it shares the purged entry.

**Not covered by the check:** the time-driven ended / on-now transitions (no
save, no poll; G7).

Bytes: lives in the lazy Done route chunk; 0 to `/app` first load (verify
against `perf-budgets.json`).

## Recommendation

**C now (event tag hard-delete only), then the Live-now check once its
version plumbing exists; A only if C measures short.** C removes the
stale-once race for the event page at its source for 0 client bytes and closes
G1/G2 which no overlay would reach; the Live-now check gives the owner's point
(2) honestly but costs an admin migration + loader + Done-screen plumbing, and
must ship after C step 1 (F5).
A is the answer for open tabs (G6) and stays queued. B is rejected on budget.

## Acceptance tests (table-driven, vitest + one live probe)

"Hard" = `dangerouslyDeleteByTag`; "soft" = `invalidateByTag`.

| Surface \ state | cancelled | moved (date) | time changed | venue moved | cancel then restore | slug change | ended (time passed) | hidden (archived) | untouched save |
|---|---|---|---|---|---|---|---|---|---|
| `/event/:id` HTML | hard `event-<id>` only; fresh render shows Cancelled | hard `event-<id>` | hard `event-<id>` | hard `event-<id>` | two hard deletes; final render shows restored | hard `event-<id>`; what the OLD slug URL serves is unverified (only a UUID&rarr;slug 301 is known, `event.tsx:88`) | **NOT covered** (no bound, no emit; G7) unless C step 4 lands | hard, full list (exists, unchanged) | no webhook |
| `/event/<slug>.data` | CF purged AND warmed | same | same | same | same | new slug warmed | NOT covered | purged | &mdash; |
| OG / SEO head tags (`meta()`) | ride the event HTML row | same | same | same | same | same | NOT covered (ended description) | same | &mdash; |
| `/city/:slug` | soft `city-<slug>` + CF warm (NOT hard) | same | same | same | same | same | rollover bound | hard (existing path) | &mdash; |
| SEO landing (9, London) | soft `seo-landing` (NOT hard); residual &le; ~310 s accepted | same | same | same | same | same | own bound | hard (existing path) | &mdash; |
| `/tonight` | client RPC: fresh on load; open tab &le; 5 min | same | same | same | same | n/a | day-key rollover | same | &mdash; |
| `/venue-entity/:id` | `venue-<id>` in tags (soft) | same | same | old AND new `venue-<id>` | same | &mdash; | &mdash; | same | &mdash; |
| `/organisers/:id` | organiser purge emitted | same | same | same | same | &mdash; | &mdash; | same | &mdash; |
| ICS / embed | NOT covered (TTL 6 h / 5 min, G4) | same | same | same | same | same | same | same | &mdash; |
| Open SPA tab (G6) | NOT covered (staleTime / focus refetch) | same | same | same | same | same | same | same | &mdash; |
| Done screen | "Live now" once `.data` version &ge; saved | same | same | same | "Live now" only on the RESTORE's version (never content compare) | polls the new slug | n/a | "Taken down" copy | no poll, no command |

Plus:
- `purgeTagsFor` x `stateChange` matrix in `app/cacheTags.test.ts`, and in
  `app/routes/api.revalidate.test.ts` assert WHICH tags go to which call:
  `dangerouslyDeleteByTag([event-<id>])` and `invalidateByTag([city-<slug>,
  seo-landing])` for a London state change; the hidden-event case
  (`api.revalidate.test.ts:136,144`) keeps the full list.
- Done screen with a fake fetch returning old, then new version, then timeout;
  and a cancel-then-restore case proving no false "Live now".
- A post-deploy probe (from a network that reaches prod) recording
  `cf-cache-status` and `age` at 30 s steps after a TEST event save.

## Not verified

- Purge &rarr; public lag per surface: **not measured** (prod and Vercel API
  unreachable from this worker). Needs one run from an allowed network.
- Only 1 save-to-purge pair measurable (pg_net retention ~6 h); the brief asked 5-10.
- Whether `/venue-entity/:id` SSR embeds its event list (G2 severity).
- ~~Whether the public `event_view_p5` payload carries `version`~~: settled by
  the review (it does not; F1). This fix round did not re-query prod.
- The exact `.data` single-route URL shape (`?_routes=`) the poll must match.
- The search page's data hook staleTime (#18) was not traced.
