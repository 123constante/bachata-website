# Handover: finish organiser Team PR 1583 [dt_c9b1e14113be]

Branch `claude/profile-dash-organiser-team-build`. Website only; no migration, no prod read or write.

## Done
1. Matrix test mounts the seat-unknown state: new shape `seat unknown, no managers` asserts `team-dash-add-manager-disabled` is disabled, `aria-describedby=tdg-add-manager-why`, the reason copy is on screen, clicking opens nothing. A solo-owner case documents that solo draws no manager group, so only the main Add shows.
2. `if (s.addVia)` removed. `addVia` is now REQUIRED on every shape; null rows assert what is absent or disabled (view-only: no Add; seat unknown/failed: Add disabled with its exact reason and Try again only when failed; loading: disabled Add "Wakes up when your team loads."; nopage/error: no Add).
3. Failed seat read: `useSeatState` now returns `failed` and `retry`; model takes `seatFailed` and gives Add the final copy `SEAT_FAILED_REASON` ("We could not check your seat on this page, so adding is off. Nothing was changed. Check your signal, then try again.") plus a Try again button (`team-dash-add-retry`) wired to the seat refetch. Pending keeps `SEAT_UNKNOWN_REASON` (no "if it stays off, reload" ambiguity, no retry button).
4. 390x844 shots in `docs/briefs/organiser-team-finish-shots/`: solo, full, person, add, interim, nopage, contributor, seatfailed. FIXTURES, rendered in a throwaway Vite harness (removed), not prod data.

## Verified / Not verified
- Verified: `vitest run src/modules/organiser/p3/dash/team` 68 passed; focusReturn test passed; `npm run check:mojibake` clean; tsc (`-p tsconfig.app.json`, 130 repo-wide errors, all pre-existing files) 0 errors in the files this branch touches.
- Not verified: `npm run pre-ship` and the full CI job table (not run here; read the PR checks); shots are fixtures not prod shapes; group-level Add a manager has no Try again button (the main Add carries it); `scripts/prepush-check.mjs` does not exist here.
