# Handover: P3 W3b-1 History (read only), PR #1098

Branch `claude/p3-w3b1-history`. Flag `organiserP3` stays OFF.

## Built
- `src/modules/organiser/p3/data/history.ts`: RPC wrapper for `organiser_series_history_v1` (narrow typed caller, like `stats.ts`), parser (drops a row with no label / no real time / not an object, counts drops, dev warning; unknown `who` -> "Someone"; bad `date` -> none; non-string fields dropped), the one who mapping (`WHO_OF` + `L.historyWho`), refusal test (`42501` / `not_a_member` / `not_signed_in`), row words and London-day grouping (year added for days not in the current year).
- `screens/HistoryScreen.tsx` (lazy, own chunk): React Query `useInfiniteQuery`, paged with `p_before = next_before` (the cursor string goes back unchanged; real prod values carry microseconds). States: loading, error + Try again, empty (brief copy + Back to the event), refused (shared `NotYoursCard`), list, "Show older changes" button, older-page error note that keeps the rows.
- `EventPage.tsx`: `NotYoursCard` extracted (same copy, now shared) and a "History" row appended to the edit rows card.
- Appended: `labels.ts` (history* labels), `paths.ts` (`eventHistory`), `P3Routes.tsx` (lazy route), `wsFixtures.ts` (history payload builders), `p3Theme.contrast.test.ts` (History pairs).
- Tests: `screens/__tests__/history.matrix.test.tsx` (78 cases: 0/1/3/12/60/120 rows with 1-3 pages, error, refusal x2, malformed, entry link, who x date x fields matrix, grouping incl. BST edge, real prod payloads). Four mutants (who map, next-page error, paging cursor, refusal) each turn it red.
- Walk spec (not in the gate): `tests/e2e/walk-p3-w3b1.spec.ts`, 390x844 and 360x640, light/dark.
- Design record: `docs/design/1098.md`.

## Left
- Independent review (lane: reviewer Sonnet) and one fix round, then the orchestrator walk.
- Authenticated browser walk on prod data as the walk test user (this worker had no login): the RPC's real output for two seeded events was read with SQL and pinned in tests instead.

## Next steps
1. Run the review on PR #1098; apply findings as edits.
2. Orchestrator walk: open `/account/p3/events/<WALK weekly-cancelled-date id>/history` with flags on; expect one day "Tuesday 27 October" with 4 rows (Skipped a date / Cancelled a date / Changed how it repeats / Created the event).

## Status
DONE for the builder lane: code, tests, design record and PR body (#1098) in place; waits on the independent review and the orchestrator walk.
