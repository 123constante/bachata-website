# Review: Website PR #1805 (R4 door Undo, merge-of-main delta)

PR #1805 supersedes #1804. Prior review (docs/review/review-pr-1804.md, PASS WITH NITS, Hard-tier PASS) was at f336b66f34971ec20536b8bb7421f41f40a37c1d.

head e4b0576700a3a355bc646993d82709073e97f818 (f336b66 + one merge commit of main, parents f336b66 and eef6a73)

## Verdict: PASS

## Hard-tier: PASS

## Evidence

1. **Door files unchanged by the merge.** `git diff f336b66..e4b0576 --stat -- src/modules/organiser/p3/door scripts/onboarding-write-doors.json tests/e2e/walk-r4-door-undo.spec.ts` prints nothing: zero door file differs. The merge only brought in main's #1802/#1803 work (src/modules/organiser/p3/r4/*, two walk specs, two handover docs) plus the spec-coverage list. No door file imports from p3/r4 (grep empty), so no indirect effect.
2. **Only conflict resolution is scripts/check-e2e-spec-coverage.mjs.** The merge adds two lines versus the first parent; walk-r4-door-undo, walk-r4-team-invited and walk-r4-money entries are all present. `node scripts/check-e2e-spec-coverage.mjs` on the head: "e2e spec coverage OK -- 100 specs: 47 in a CI list, 53 allow-listed manual", exit 0.
3. **Undo logic unchanged and correct.** data.ts `undoCheckIn` calls `ticket_undo_check_in_v1(p_ticket_id, p_event_series_id, p_occurrence_id=null)`, matching the signature documented from prod pg_proc; 42501 maps to SignedOutError; result mapped via `undoKindOf(result, undone)`. The double-tap guard (`busyRef` / `undoRef` in DoorScreen.tsx) is present. `npx vitest run src/modules/organiser/p3/door` on the head: 10 files, 516 tests passed.

## Not verified
- tsc and the browser walk were not re-run (read-only delta review; door files are byte-identical to the reviewed commit).
- The live DB function signature was not re-queried; I relied on the signature recorded in data.ts.
