# Handover: festival on every calendar day (dt_330ecd070014)

Branch `claude/festival-calendar-all-days`. Brief: `briefs/festival-calendar-all-days.md`
on `brief/festival-calendar-all-days`.

## Done

Two separate bugs, both fixed in this branch:

1. **Feed drops festival days 2+.** `src/modules/home-map/cards/AllEventsList.tsx`
   built the local feed as `groupByDate(collapseFestivals(local))`.
   `collapseFestivals` (`src/modules/home-map/mapListDerivations.ts`) folds a
   festival into its first day on purpose, so Pulse (30 Oct - 1 Nov) showed on
   Friday only. The DB and the RPC were correct: `get_map_events_v1` returns
   one row per day, all with occurrence id `f142acd9-...`. Fix: the new
   `localFeedGroups` = `groupByDate(stampFestivalRanges(...))` keeps every day
   and stamps the range badge on each one. The remote section ("Festivals
   further afield") keeps `collapseFestivals`.
2. **Phone day sheet "No events found" on Sat 31 Oct.** `CalendarPanel.tsx`
   sent a browser-local month end (`new Date(y, m+1, 0, 23, 59, 59)`), and
   `get_calendar_events_v2` treats `range_end` as a half-open DATE cut-off, so the
   last day of every month was missing: 41 rows instead of 45 for London in
   October. Fix: the new `londonMonthRangeUtc` in `src/lib/londonDate.ts`,
   padded by one day because the RPC cuts at a date in the CITY's timezone.
   EventCalendar already used London bounds and is unchanged (it is on the
   density-exclusion list).
3. Class sweep: `listImpressions.track(id)` kept ONE ref per id, so N day-rows
   of one festival left only the last row observed. It now takes a `slot`
   argument, and the feed passes the day key.

Tests: `festivalEveryDay.test.ts` covers 6 shapes x 4 surfaces (it failed on
the old pipeline first). `tests/londonDate.test.ts` has the month-range
cases (they failed against the old CalendarPanel bounds first).
`listImpressions.test.ts` has the shared-id case (it failed first).

## Left / next steps

- Selecting a festival row highlights all of its day-rows, because they share
  one occurrence_id and so does the map pin. No row is lost, so this was left
  as is.
- The range badge is built from the days still in the feed, which starts
  today. On the last day of a running festival the badge disappears. This
  predates the branch.
- EventCalendar.tsx has its own copy of the London month window. Switching it
  to `londonMonthRangeUtc` needs Ricky's OK (density-exclusion file).
- `/parties` (EventCalendar) was not walked in a browser: there was no stored
  city in the headless session. Its range was already London-correct.
