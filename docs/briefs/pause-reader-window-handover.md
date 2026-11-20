# Handover: pause reader window (dt_bb1ee80caa0e)

PR #1869, branch `claude/pause-reader-window`. Guard path: needs owner Approve at head. Not merged.

## Done
- `scripts/lib/automation-pause.mjs`: `findPauseIssue` uses `GET /search/issues`
  (`repo:R is:issue in:title "AUTOMATION PAUSE SWITCH" author:<owner>`), fail closed on
  incomplete_results / shape / >10 pages / read error. Header + `docs/automation-pause.md` updated.
- Tests: 2000-newer-PRs case (mutation-checked red against the old 5-page listing), shape rows;
  fakes in automationPauseGuard / automationGuardPaths / owner-summary moved to the search shape.
- Live read (unauthenticated, sandbox has no API token): `paused=false reason= issue=1360`.

## Not done / next
- Admin repo copy (`bachata-admin-11april`): same change, separate brief/PR.
- `scripts/write-drill-record.mjs` and `scripts/check-drill-records.mjs` still list open issues
  5x100 to find the DRILL RECORDS issue (open-only, so less exposed); same class of limit.
- `npm run pre-ship` red locally on files this branch does not touch: live Supabase contract
  tests (no DB network here), integrityCouldNotRun, ticketFestivalPage.matrix, no-social-word
  (ticket tests), typecheck 141 vs baseline 106 (main is also 141).
