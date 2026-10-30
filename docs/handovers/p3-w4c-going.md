# Handover -- P3 W4c organiser "Who's going": BLOCKED on the id bridge (nothing built)

2026-10-30. Branch `claude/p3-w4c-going`, from `main` @ 21364be. No source edits.

## Why nothing was mounted
`get_my_event_going_v1` takes the PUBLIC event id. Every P3 row carries only the SERIES id
(`P3Row.id`, `WorkspaceSeries.id`). Prod (scoping doc section 6): 120 of 758 series have
`public_event_id <> id`, and 47 of 68 series with a date today or later differ. Passing the series id
answers `not_found` for most live events, so a mount would show the "can't find this event" state
for them -- a wrong build, not a quiet one.

The brief says "no database change" and "touch nothing else", so the two ways out are closed:
- No organiser read returns `public_event_id` (home_v1, workspace, series_stats: none mention it).
- Reading `event_series_p5` directly does not work: checked on prod 2026-10-30 (SELECT only),
  RLS is ON, the table has ZERO policies, so `authenticated` gets no rows despite the table grant.

## Needs owner / admin repo
One of (scoping doc section 5): (a) add `public_event_id` to `organiser_home_v1` /
`admin_event_workspace_p5` / `organiser_series_stats_v1` rows; (b) a `get_my_series_going_v1(p_series_id)`
twin; (c) a batch read (also fixes Stats' one-call-per-row). Migration lives in `bachata-admin-11april`.

## Next steps once the bridge lands
1. Parser: carry `publicEventId` into `P3Row` / `WorkspaceSeries` (matrix test over the 47/21 split).
2. Mount `GoingNightSummary` / `GoingPeopleSheet` / `GoingLoadState` (mount code: `docs/handovers/going-p3-organiser.md`)
   in HomeScreen hero, DateSheet row (match `night.occurrence_id` to `WorkspaceDate.id`), StatsScreen By-event row,
   only when `organiserP3 && GOING_CHECKIN_ENABLED`. Contributor (`not_organiser`) renders nothing.
3. Table-driven tests (no going, 1, many, >200, cancelled, contributor, switch off, P3 off); `check:bundle-budget` before/after.

## Verified / Not verified
Verified: the RLS/grant facts above (read-only SQL). Not verified: everything else; no code, tests, CI, or browser walk ran.
