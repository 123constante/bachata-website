# Live-now lag: root cause and plan (r1, 2026-11-01)

Docs only. No code, no migration, no prod write. Inventory first:
[`INVENTORY.md`](INVENTORY.md) (25 surfaces, gaps G1-G6, O1-O9).

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
48 responses, all 200, oldest 17:41 UTC). Last 7 days of writes: 253
occurrence rows, 15 series rows, 13 override rows &mdash; older saves cannot be
paired with their webhook any more. **The DB-to-purge leg is not the lag.**

**Purge &rarr; public page (derived from code, not measured):**

| Surface | Worst case after save | Why |
|---|---|---|
| `/event/:id` HTML (canonical, warmed) | ~10-20 s typical; **up to ~310 s** | Vercel `invalidateByTag` is SOFT: the next request gets the stale copy and starts a re-render. CF pass 1 &rarr; warm (gets stale) &rarr; wait 10 s &rarr; pass 2. If Vercel's re-render is not done when the next post-pass-2 request lands, Cloudflare caches the stale copy again for 300 s |
| `/event/<slug>.data` (client nav from city/calendar) | up to ~310 s | purged but never warmed (G3): first miss after pass 2 can store Vercel's stale copy for 300 s |
| `/city/london-gb` | as the event page (warmed) | same soft-purge race |
| SEO landing (9) | up to ~310 s | not warmed (G3) |
| `/organisers/:id` | up to 300 s | no emit (G1); Vercel TTL 0, CF 300 s |
| `/venue-entity/:id` | up to 3600 s + SWR | no venue tag purged on an event write (G2) |
| ICS / embed | 6 h / 5 min | no purge (G4) |
| Open SPA tab (calendar, map, event) | 1-2 h, or next focus | React Query `staleTime` (G6) |

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

1. In `/api/revalidate`, use `dangerouslyDeleteByTag` (already used for hidden
   events, `api.revalidate.tsx:134-138`) when the webhook says the write changed
   public STATE (cancel, move, time, status) &mdash; the body gains e.g.
   `stateChange: true` from the admin emit. Next request renders fresh; no stale
   copy for Cloudflare to re-hold.
2. Warm the `.data` twin of the event page in the CF sequence (G3).
3. Admin repo: emit `venue-<id>` with event writes (G2), an `organiser` emit
   (G1), and cover the non-emitting writes (G5).
- **Cost:** one cold SSR per state change (rare: 13 overrides in 7 days); admin
  migration for the emit payload.
- **Risk:** low &mdash; the hard-delete path exists and is tested
  (`app/routes/api.revalidate.test.ts`). A cold render under load is the only cost.
- **Bytes:** 0 client bytes. Does not fix open tabs (G6).

## Organiser "Live now" check (for any option)

On the Done screen (O1, `src/modules/organiser/flows/Done.tsx`), after a save
that changed a public field: poll the **real public artifact**,
`GET /event/<slug>.data` (through Cloudflare, same origin), every 5 s for up to
5 min, and read the loader's series `version` (the same `version` the command
was sent with: `ws.series.version`, `admin_event_workspace_p5`,
`selfServeApi.ts:247`). Show "Live now" when the public version &ge; the saved
version; after 5 min show "Saved &mdash; the public page can take a few minutes".
Reading the public `.data` (not an RPC) is the only check that proves what a
visitor sees. **To confirm:** that `event_view_p5`'s public payload carries
`version` (or `updated_at`); if not, the admin RPC must expose it.
Bytes: lives in the lazy Done route chunk; 0 to `/app` first load (verify
against `perf-budgets.json`).

## Recommendation

**C now, plus the Live-now check; A only if C measures short.** C removes the
stale-once race at its source for 0 client bytes and closes G1/G2 which no
overlay would reach; the Live-now check gives the owner's point (2) honestly.
A is the answer for open tabs (G6) and stays queued. B is rejected on budget.

## Acceptance tests (table-driven, vitest + one live probe)

| Surface \ state | cancelled | moved (date) | time changed | ended (time passed) | hidden (archived) | untouched save |
|---|---|---|---|---|---|---|
| `/event/:id` HTML | hard-delete called; fresh render shows Cancelled | hard-delete | hard-delete | TTL bound (no emit, G5) | hard-delete (exists) | no webhook |
| `/event/<slug>.data` | CF purged AND warmed | same | same | &mdash; | purged | &mdash; |
| `/city/:slug` | soft purge + warm | same | same | rollover bound | same | &mdash; |
| `/venue-entity/:id` | `venue-<id>` in tags | same | same | &mdash; | same | &mdash; |
| `/organisers/:id` | organiser purge emitted | same | same | &mdash; | same | &mdash; |
| Done screen | "Live now" once `.data` version &ge; saved | same | same | n/a | "Taken down" copy | no poll, no command |

Plus: `purgeTagsFor` x `stateChange` matrix in `app/cacheTags.test.ts`; Done
screen with a fake fetch returning old, then new version, then timeout; a
post-deploy probe (from a network that reaches prod) recording `cf-cache-status`
and `age` at 30 s steps after a TEST event save.

## Not verified

- Purge &rarr; public lag per surface: **not measured** (prod and Vercel API
  unreachable from this worker). Needs one run from an allowed network.
- Only 1 save-to-purge pair measurable (pg_net retention ~6 h); the brief asked 5-10.
- Whether `/venue-entity/:id` SSR embeds its event list (G2 severity).
- Whether the public `event_view_p5` payload carries `version`.
