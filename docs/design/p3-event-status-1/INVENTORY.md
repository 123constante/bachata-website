# p3-event-status-1 inventory and result (PARTIAL)

## Part 1, W-02 (removed event tagged Finished, Repeats tappable): NOT built, already settled on main
Server truth (read-only SELECT, prod `stsdtacfauprzrdebmzg`, `event_series_p5.lifecycle_status`, counts only):
archived 653, live 70, ended 21, draft 15, paused 2. Remove (`removeCommand`) sets `archived`. No field says
WHO archived a series (653 archived; the legacy import produced most of them), so a "Removed" tag would
mislabel imported archived events.
On main (5d20065) `screens/EventPage.tsx:342` already renders an archived event as the
`p3-event-archived` lock card tagged Finished (F-22, owner decision 2026-11-01, pinned by
`archivedEvent.test.tsx`: "never removed"). That card has no Repeats row, no Add date, no date rows; the
walk pictures predate it. The brief's "Removed" tag contradicts that owner decision, so no change was made.
NEEDS OWNER: confirm Finished stays for archived, or reverse F-22 (then a removed-by-this-person marker
needs a server field, not the client).

## Part 2, page-scope nits (built)
| State x screen | Was | Now |
|---|---|---|
| 0 pages x Events | "Events this page runs show up here" (EventsScreen) | `NoPageCard`: "Find your page or create one" + link to start |
| 0 pages x Stats | "0 views, this page's events" | same `NoPageCard` |
| 0 pages x Home | redirect to start | unchanged |
| open Switch list | aria-current only | + visible tick (`p3-page-current`), aria-current kept |
| loading x Home/Events/Stats | Home/Events keyed on home.isPending only; `rowsOf` read all pages for null | all three use `scope.loading`; `rowsOf(home, null)` returns no rows (undefined still reads all) |
Coverage: 3 screens x {0 pages, loading, open list} = 9 rows, 9 shown, none omitted (pageScope.matrix.test.tsx).
