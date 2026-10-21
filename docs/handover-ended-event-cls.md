# Handover: ended-event-cls

Branch `claude/ended-event-cls`. Brief: `briefs/ended-event-cls.md` on `brief/ended-event-cls`.

## Done

**Element and cause.** On an ended series, `BentoPage` renders the organiser
"door" (`MoreEventsSection` with `blocks=['organiser']`, `DOOR_BLOCKS`) ABOVE the
bento grid. Its two queries (`get_organiser_next_occurrences_v1` + `event_views`
for "More from {organiser}", and `get_organiser_event_counts` +
`organiser_profiles` for the "Other organisers you might like" fallback) ran on
the client only. The server HTML had no door; when the data landed (~4.5 s at
4x CPU) the door appeared and pushed the grid (first tile, date tile, venue
tile...) down 120-177 px. PerformanceObserver `layout-shift` sources at 390x844
on `the-camden-tuesdays`: `DIV "GalleryTUESDAY6OCTOBEREnded..." y 370 -> 546`,
value 0.1212.

**Fix.** `app/routes/event.tsx` prefetches the door's two queries
(`prefetchEndedDoor`, exported from `MoreEventsSection.tsx`) when
`snap.event.lifecycleStatus === 'ended'` and the page is not a festival
(FestivalDetail renders no door). It runs in parallel with the existing
og-image resolve and festival prefetch, inside the same loader timeout. The
hooks and the prefetch share `queryOptions` factories, so keys and fetchers are
the same. The door is now in the server HTML and dehydrated cache: first paint.
No design change; nothing hidden. Live and festival pages are untouched (gate).

**Red-first numbers** (production build served by `scripts/_serve-build.mjs`,
built against the prod Supabase anon key, CDP CPU 4x, 7 s settle):

| page | viewport | CLS before | CLS after |
|---|---|---|---|
| ended `the-camden-tuesdays` | 390x844 | 0.1213 (grid moved 177 px) | 0.0001 |
| ended `the-camden-tuesdays` | 360x640 | 0.1234 (176 px) | 0.0002 |
| ended `bachata-pasos-libres` | 390x844 | 0.0826 (120 px) | 0.0001 |
| ended `bachata-pasos-libres` | 360x640 | 0.0837 (119 px) | 0.0002 |
| live, all dates past `sensual-saturdays-3` | 390x844 / 360x640 | 0.0001 / 0.0002 | 0.0001 / 0.0002 |
| live `ronald-alba-halloween-edition-sensual-vibes` | 390x844 / 360x640 | 0.0268 / 0.0267 | 0.0268 / 0.0267 |
| festival `budapest-bachata-festival` | 390x844 / 360x640 | 0.0314 / 0.0486 | 0.0314 / 0.0486 |

**E2E.** `tests/e2e/event-ended-cls.spec.ts` (added to `test:e2e`): 2 ended
slugs x 390x844 + 360x640; fails when CLS >= 0.1 or the bento grid's top moves
> 4 px. On unfixed main: 4/4 FAIL (numbers above). With the fix: 4/4 pass.
`event-hydration-421.spec.ts` also passes with the fix (door SSR-rendered, no
hydration errors). Like that spec it SKIPS in CI: CI keys are placeholders, so
SSR event pages 404.

**How to reproduce locally.** The sandbox's `VITE_SUPABASE_URL` points at a
non-prod project, so every event SSRs as 404. Build with the prod URL + public
anon key (`get_publishable_keys` on `stsdtacfauprzrdebmzg`) and run node with
`NODE_USE_ENV_PROXY=1` behind the agent proxy.

## Left

- The live site / Vercel preview was not measured (www.bachatacalendar.com is
  blocked by the sandbox proxy; no Vercel token).
- Live events still shift slightly (0.027, the date/venue tiles at ~2.7 s) and
  festivals 0.03-0.05; both under 0.1 and out of scope.
- Door prefetch has its own 1.5 s budget (`ENDED_DOOR_BUDGET_MS`): on a miss
  the page renders as before (door late, shift back) rather than timing out.
- Known residual (review finding): edge-cached HTML older than the door's
  5-min `staleTime` refetches the door on mount. If the organiser's live events
  changed since the render (fallback cards <-> event cards, or empty <-> some),
  the door can change height after load. The fallback's random organiser pick
  is frozen in cached HTML and swaps after such a refetch (same size, no shift).
  Not fixed: it needs a cache-purge or refetch policy decision.
- The bottom strip ('thisWeek') is still client-fetched; it is below the grid
  and moves nothing above it.

## Next

- After merge, re-run the brief's live check on an ended event at 390x844 with
  4x CPU and confirm CLS < 0.1.
