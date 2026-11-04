# p3-dates-fix-1 (fix: older dates unreachable; save conflict dead end)

Branch `claude/p3-dates-fix-1` from main. Lane normal, Opus (list read + save error path). Website repo only, no database change. Avoids: `screens/EditTray.tsx`, `DetailsScreen.tsx`, `PricesScreen.tsx`, `keptDraft.ts` (another worker, `claude/p3-gate-guard-1`), `EventPage.tsx`, `StatusSheet.tsx`, `PageScope.tsx`, `HomeScreen.tsx`, `EventsScreen.tsx`, `StatsScreen.tsx` (worker `claude/p3-event-status-1`), `join/**`, ticketing/door, calendar protected files.

## The failures (P3 walklist walk, branch `claude/walk-p3-walklist-1`, docs/walk/p3-walklist-1/RESULTS.md, pictures in pics/)
1. **W-31 (medium).** On a long series the dates screen says "This page lists the newest 100 of 132 dates." but has no way to load the rest; tabs read Coming 96 / Past 4 / Cancelled 3, so 32 older dates cannot be reached or edited. Picture `w31-0-dates.png`. Files: `screens/AllDatesScreen.tsx:68`, `data/eventPage.ts:121`. First PROVE the real read: `admin_event_workspace_p5` (read the live function body read-only on prod `stsdtacfauprzrdebmzg`, SELECT only) and say whether it can page (has_more / total / an offset or before-date argument). If the server cannot page, the honest fix is a plain line that names what is hidden and the way to reach older dates (e.g. ask the team), plus a note for the admin repo; do NOT invent a client-side Load more that cannot work.
2. **W-35 (low-medium).** After a save is refused as `version_conflict`, the date sheet shows "Someone changed this first. Check it." and keeps the typed value, but still offers an enabled "Save for this date" and no way to pick up the other change. Picture `w35-2-conflict.png`. Files: `screens/DateFieldSheets.tsx`, `shared/selfServeErrors.ts`. Wanted: a "Start again" control that re-reads the date, drops the stale version, and shows the new value with the person's typing offered back or discarded in plain words; Save stays disabled while the conflict is unresolved and says why.
The check that would have caught both: a table-driven test of every date-list size (0, 1, 99, 100, 101, 132, 500) x tab and every save outcome (ok, conflict, refused, offline) asserting no dead end (a reachable next action in each cell).

## Step 0: INVENTORY (`docs/design/p3-dates-fix-1/INVENTORY.md`, before any edit)
Every state of the dates screen and each date field sheet (list sizes, tabs, loading/error/empty, each save outcome): what is shown today, file:line, and what it must offer. Coverage count at the end: N rows, N shown, none omitted.

## Tests (red first, output kept)
Table-driven as above; new rows fail on main. Mutants (each must be killed by a test): hidden dates with no explanation; conflict leaves Save enabled; Start again does not refetch.

## Walk (390x844, mocked; reuse the harness in tests/e2e/walk-p3-walklist.spec.ts from `claude/walk-p3-walklist-1`)
W-31 with 132 dates and with 100 and 99; W-35 conflict then Start again then save. OPEN EVERY PICTURE; error card or blank = FAIL; one line per picture in RESULTS.md.

## Gates and rules
`npm run lint`; unit tests for p3; `check:bundle-budget` main vs branch (0 bytes to /app first load; never edit perf-budgets.json or vite.config.ts); check:integrity. PR body: `- Shapes surveyed:`, `- Checks run:`, `- NOT verified:` each with text on the SAME line, and `## Phone QA` with `- Sizes checked: 390x844`, `- Walked: ...`, `- Not verified: ...`. Push once when coherent; never add run-ci. Last commit ends `[worker-done <ticket>]`, final push without [skip preview].
