# Live-now lag: inventory (r1, 2026-11-01)

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
- **G6** Open SPA tabs: React Query staleTime 1-2 h; nothing pushes a change.

## Coverage count

16 public surfaces + 9 organiser surfaces = **25 surfaces**. Public: 16 listed,
7 purged on an event write (#1, #2, #3, #6, #8, #13, and #12 by URL change),
3 not edge-cached (#4, #5, #11 timeline), 6 with a gap (#9, #10, #11 SSR, #14,
#15, #16). Organiser: 9 listed, 0 confirm the public page. None silently
omitted. Not surveyed: admin-repo surfaces (out of scope for this repo).
