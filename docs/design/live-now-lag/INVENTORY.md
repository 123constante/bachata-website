# Live-now lag: inventory (r1, 2026-11-01; review fixes 2026-11-02)

Every public surface that shows an event's state, the cache in front of it, and
whether a content write purges it. Then every organiser surface that shows a
"saved / live" state. Read-only survey of `main` at `ecfe506`.

## The cache stack (applies to every SSR HTML route)

| Layer | What it holds | TTL | Purged on content write? | Source |
|---|---|---|---|---|
| Browser | nothing for SSR HTML | `Cache-Control: no-store` (BROWSER_NO_STORE) | n/a | `app/detailLoader.ts:133-167` |
| Cloudflare (in front of Vercel) | HTML + `.data` twins, tag `html` | **300 s** (cache rule "HTML for humans (5 min, bots bypass)") | by URL, 2 passes, in `waitUntil` | `docs/ops/cloudflare-purge.md:5`, `app/cloudflarePurge.ts` |
| Vercel edge (ISR) | SSR response, tagged | default `s-maxage=3600, stale-while-revalidate=86400`; bounded per route | **soft** `invalidateByTag` (serves stale ONCE, re-renders in background); hidden events get `dangerouslyDeleteByTag` | `app/edgeCacheControl.ts` (EDGE_S_MAXAGE/EDGE_SWR), `app/routes/api.revalidate.tsx:134-138` |
| React Query in an open SPA tab | dehydrated loader data | `staleTime` 1 h (event), 1 h (calendar), 2 h (map); window-focus refetch | never | `src/modules/event-page/useEventPageQuery.ts:391`, `src/hooks/useCalendarEventsRpc.ts:31`, `src/hooks/useMapEvents.ts:52` |

Purge trigger: DB webhook (`_emit_cache_revalidation_v1`, admin repo) POSTs
`/api/revalidate` with entity + resolved city. Tags derived by `purgeTagsFor`
(`app/cacheTags.ts:155-183`). For an `event` write with `citySlug=london-gb`:
`event-<id>`, `city-london-gb`, `seo-landing`.

## Public surfaces

| # | Surface | Route / file | Edge TTL | Tag stamped | Purged by an event write? |
|---|---|---|---|---|---|
| 1 | Event page | `/event/:id` &mdash; `app/routes/event.tsx:213` (`stampEvent`), render `src/modules/event-page/BentoPage.tsx` | default 3600 + SWR 86400 (no bound passed) | `event-<id>`, `events` | YES (Vercel soft + CF 2-pass by URL, prefix purge for `?occurrenceId=`) |
| 2 | Event page `.data` twin (client-side nav from city/calendar) | `/event/<slug>.data` | same | same | CF purged by URL, **not warmed** (gap G3) |
| 3 | City home / tonight feed / map | `/city/:slug` &mdash; `app/routes/home.tsx:287-306` (bound to next day rollover), degraded path `home.tsx:385` (`s-maxage=30`) | bounded &le; 3600 | `home-feed`, `city-<slug>` | YES |
| 4 | Calendar (EventCalendar, protected; read only) | client RPC via `src/hooks/useCalendarEventsRpc.ts` &rarr; `src/integrations/supabase/eventRpcs` | none at edge (browser &rarr; Supabase) | none | n/a: fresh on page load; stale up to 1 h in an open tab (focus refetch) |
| 5 | Map events | client RPC `src/hooks/useMapEvents.ts` | none at edge | none | n/a: stale up to 2 h in an open tab |
| 6 | Festival detail | `/festival/:id` &mdash; `app/routes/festival.tsx:195` | default | `festival-<id>` | YES for `festival` writes |
| 7 | Festivals list | `/festivals` &mdash; `app/routes/festivals.tsx:34` | default | `festivals-list` | festival writes only (an event write does not; correct while list = festivals) |
| 8 | SEO landing pages (9) | `app/routes/london-bachata-guide.tsx:41`, `learn-bachata-london.tsx:42`, `bachata-weekday.tsx:47` | bounded | `seo-landing` | YES (London only); CF not warmed (G3) |
| 9 | Organiser public page | `/organisers/:id` &mdash; `app/routes/organiser.tsx:165-173` | **0** at Vercel (`edgeTtlBoundSeconds: 0`) | `organiser-<id>` | **NO emit exists**; CF still holds 300 s (G1) |
| 10 | Venue page (lists upcoming events) | `/venue-entity/:id` &mdash; `app/routes/venue-entity.tsx:65` | default | `venue-<id>` | **NO** &mdash; an event write purges no venue tag (G2, to confirm the SSR payload includes the event list) |
| 11 | Teacher / DJ / dancer pages (programme appearances) | `app/routes/teachers.tsx:80`, `djs.tsx:67`, `dancers.tsx:100`, `people.tsx:64`; timeline is a client RPC (`src/hooks/useProfileProgramAppearances.ts:60`) | default / `app/personPageTtl.ts` | person tags | NO for event writes; the event list itself is client-side, so only SSR text is stale (G2b) |
| 12 | OG / share card | `app/routes/api.og.card.tsx:103` (`s-maxage=31536000`) | 1 year | none (etag = pure function of query params) | n/a: the card URL changes with its params; the og:image URL lives in the cached HTML of #1 |
| 13 | OG/SEO head tags (title, description, `ended`) | `meta()` of `app/routes/event.tsx` | rides #1 | #1 | as #1 |
| 14 | ICS feed | `app/routes/api.ics.calendar.tsx:194` (`max-age=3600, s-maxage=21600`) | 6 h | none | **NO** (G4) |
| 15 | Embed calendar | `app/routes/api.embed.calendar.tsx:198` (`s-maxage=300`) | 5 min | none | **NO** (G4, bounded 5 min) |
| 16 | Sitemap | `app/routes/sitemap.tsx:305` | default | none | NO (TTL only; not state-bearing for a cancel) |
| 17 | Tonight feed | `/tonight`, `/city/:slug/tonight` &mdash; `src/components/AnimatedRoutes.tsx:141-142`, `src/pages/Tonight.tsx:134-140` (client RPC via `get_calendar_events`, key includes London day) | none at edge (catch-all SPA shell, browser &rarr; Supabase) | none | n/a: fresh on load; open-tab stale up to **5 min** (`staleTime`, `Tonight.tsx:138`). Distinct from #3 (different route, different cache) |
| 18 | Search results | `/search`, `/city/:slug/search` &mdash; `AnimatedRoutes.tsx:302-303`, `src/pages/SearchResults.tsx` | none at edge | none | n/a: client RPC; open-tab stale per React Query (global default 60 s, `src/App.tsx:15`, unless the page's hook overrides; not traced) |
| 19 | Parties | `/parties`, `/city/:slug/parties` &mdash; prerendered static shell (`react-router.config.ts:33-38`), `src/pages/Parties.tsx:54` mounts the client-only `EventCalendar` | static shell (no event data in HTML) | none | n/a: same data path and open-tab staleness as #4 |
| 20 | Classes | `/classes`, `/city/:slug/classes` &mdash; as #19, `src/pages/Classes.tsx:55` | static shell | none | n/a: as #4 |
| 21 | Venues list | `/venues`, `/city/:slug/venues` &mdash; `AnimatedRoutes.tsx:182-183`, `src/pages/Venues.tsx:496` | none at edge | none | n/a: client RPC, open-tab stale up to 5 min |
| 22 | Organisers list (flag `organisersDirectory`) | `/organisers` &mdash; `AnimatedRoutes.tsx:184-192`, `src/pages/Organisers.tsx:268-324` (next/last event dates) | none at edge | none | n/a: client RPC, open-tab stale 5-30 min per query |

## Organiser surfaces showing a saved / live state

| # | Surface | File:line | What it says | What it reads |
|---|---|---|---|---|
| O1 | Done screen after a save | `src/modules/organiser/flows/Done.tsx:57-75`, state via `flows/doneState.ts:61` | "Saved" / "Live - &lt;name&gt;" | nothing: message is passed in navigation state |
| O2 | Event step send | `src/modules/organiser/flows/event/EventStep.tsx:24,43,87,131`, `flows/event/useEventSend.ts:18` | "Live" / "Saved" | command result only |
| O3 | Lifecycle actions (cancel, pause, end) | `src/modules/organiser/events/LifecycleActions.tsx:120` | Done title | command result only |
| O4 | Details save | `src/modules/organiser/events/Details.tsx:52` | "Saved" | command result only |
| O5 | Page (organiser profile) save | `src/modules/organiser/page/useOwnPage.tsx:117` | "Saved" | command result only |
| O6 | New event | `src/modules/organiser/flows/new/NewFlow.tsx:325`, `model.ts:93,112` | "Saved as a draft&hellip;" / "Live - Friday&hellip;" | command result only |
| O7 | Edit-in-place "Saved at HH:MM" | `src/modules/organiser/edit-in-place/draftModel.ts:370` | timestamp | local clock |
| O8 | Save button label | `src/modules/organiser/shared/editorGuards.ts:43` | "Saved" when clean | dirty flag |
| O9 | Status tag | `src/modules/organiser/shared/eventState.ts:29`, `selfServeApi.ts:468` | "Live" | `admin_event_workspace_p5` (`selfServeApi.ts:247`) |

**GAP O-all:** none of O1-O9 reads the public page or the public RPC. "Live"
today means "the DB accepted the command", not "the public page matches".

## Gaps

- **G1** `/organisers/:id`: no DB emit; Cloudflare holds it 300 s.
- **G2** `/venue-entity/:id`: event writes purge no `venue-<id>` tag. G2b person pages: SSR text only.
- **G3** Non-warmed URLs (`.data` twins, query variants, SEO pages) can re-cache Vercel's stale copy in Cloudflare for 300 s after pass 2, because the Vercel purge is soft.
- **G4** ICS (6 h) and embed (5 min) have no purge.
- **G5** Writes that never call the webhook (`admin_delete_series_p5_v1`, collapse, duplicate, merge venues, raffle/guest config, `organiser_profile_update_p5_v1`) and time-based endings purge nothing (`docs/ops/cloudflare-purge.md:240-257`).
- **G6** Open SPA tabs: React Query staleTime 1-2 h (calendar, map, event), 5 min (tonight, venues), 5-30 min (organisers list); nothing pushes a change.
- **G7** `/event/:id` has no TTL bound, so the time-driven ended / on-now state can be up to ~25 h old at the edge (review F4).

**Time-driven state on #1 (review F4).** `/event/:id` passes **no TTL bound**
(`app/routes/event.tsx:209`, `stampEvent(eventId)` with no third argument, so
`app/detailLoader.ts:130-139` emits the default 3600 + SWR 86400). The
server-computed `occurrence.isPast` drives the first paint
(`src/modules/event-page/bento/BentoPage.tsx:211-222`) and `meta()` ships the
ended share description (`event.tsx:17,205`). So "ended" and "on now" are NOT
covered on #1/#13: a crawler or the pre-hydration paint can read "not ended"
for up to ~25 h. `/city/:slug` does bound itself (`home.tsx:287-304`).

## Coverage count

r1 said "16 public, none silently omitted". That was wrong (review F3): rows
#17-#22 were missing. Restated: **22 public surfaces** (counting each route
pair such as `/tonight` + `/city/:slug/tonight` as one row; 28 if each route
path is counted separately) + **9 organiser** = **31 rows**.

Public, by how an event write reaches them:
- Purged on an event write (7): #1, #2, #3, #6, #8, #13, and #12 by URL change.
  #1/#13 are purge-covered for cancel/move/time changes only, not for the
  time-driven ended / on-now transitions (see above).
- Not edge-cached, client RPC, fresh on load and stale only in an open tab
  (9): #4, #5, #11 timeline, #17, #18, #19, #20, #21, #22.
- With a purge gap (6): #9, #10, #11 SSR text, #14, #15, #16.

(#11 is counted in two buckets because its SSR text and its client timeline
behave differently.) Organiser: 9 listed, 0 confirm the public page.
Not surveyed: admin-repo surfaces (out of scope for this repo); other
catch-all SPA pages were scanned only for event-state content
(`AnimatedRoutes.tsx`), and these six were the ones found.
