# Handover: p3-wt-dates (DATES-100 F-27 + CACHE F-33)

Branch `claude/p3-wt-dates`. No DB change was needed.

## Data source (proved read-only on prod, 1 Nov 2026)
- "All dates" reads `admin_event_workspace_p5(p_series_id uuid, p_before date = NULL, p_limit int = NULL)`.
  Rows newest first; `p_before` = strictly before; `p_limit` 1..200, NULL = 100 (the old cap).
  `meta.has_more`, `meta.next_before` (oldest date of the page), `meta.total`, `meta.counts`.
  `UNIQUE (series_id, occurrence_date)` exists, so a date-only cursor cannot split a day.
- Public keys: event page `['event-page-snapshot', seriesId, occurrenceId|null]`
  (`useEventPageQuery`, `event_view_p5` called with `series_id`); calendar
  `['calendar-events', start, end, city]` (`useCalendarEventsRpc`, `seoLandingEvents`).

## Shape survey (counts only)
Dates per series: 0 -> 300, 1 -> 367, 2..99 -> 90, exactly 100 -> 0, 101..200 -> 1 (132 dates: 52 coming, 7 cancelled), >200 -> 0.
Largest future count 57. 16 series have breaks (max 10).

## Done
- F-27: `useAllDatesWorkspace` (p3/data/dates.ts) reads every older page (200 each, capped at 10 pages; a page that does not
  move back in time stops). Counts are the whole series. While the older pages load, or after one fails, the counts say "N+",
  with a note (and Try again on a failure). The older pages stay on screen across a write (`keepPreviousData`).
- F-33: `shared/publicViewKeys.ts` `invalidatePublicViews` is called from `runCommands.useReload` (useSendOnce /
  useRunCommands, so also useEverySend), `dates.useSendPlan`, `sessions.useDateSend`, `useOwnerCommand`. Stale times are unchanged.
- Tests: `allDates.paging.matrix.test.tsx` (0/1/99/100/101/132/250/450 x Coming/Past/All, loading, failure + retry,
  window shift, cap, loop guard). Red on main for 101+ and the loading/failure rows. `publicViews.invalidate.test.tsx`
  (7 save paths, a refused save, key pins). Red on main for every path.

## Left / next
- Legacy organiser paths that still do not refresh the public views (outside this brief's scope): `events/LifecycleActions.tsx`,
  `home/onboarding/golive/GoLiveFlow.tsx`, `flows/event/useEventSend.ts`, `flows/change/Pick.tsx`, `events/DatesTakenOff.tsx`,
  `flows/fix/CoverFlow.tsx`, `flows/new/useNewSend.ts`. Each is one `invalidatePublicViews(qc, seriesId)` call.
- The P3 event page's own "newest 100 of N" line (`partialOf` on `EventPage.tsx`) was not changed (another worker owns that file).
- The `/city/:slug` first load grew by 153 B (the `useOwnerCommand` chunk now carries the helper). `/app` is byte-identical.
- The orchestrator browser walk at 390x844 and the A-public-7 same-tab walk are not done.
