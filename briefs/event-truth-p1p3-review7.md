# Brief: REVIEW-7 worker (read-only code review of the FIX-7 delta, xhigh)

Branch `arc/event-truth-p1p3-review7`, created FROM `origin/arc/event-truth-p1p3-fix7` (30ba975b). Push ONLY that branch. Open NO PR. Change NO source.
**Keep session context under 35%: read the diff in parts (per file), never dump whole files, commit your report early.**
You are the independent reviewer: you did NOT write this code. Do not trust the author's handover; read the diff.

## Scope
`git diff origin/arc/event-truth-p1p3-fix6..origin/arc/event-truth-p1p3-fix7` (14 files, FIX-7: Search "Class" chip widened to masterclass+workshop; chipHint/Type row copy;
`created` flag removed; one listed-upcoming derivation; guard hint keyed to the P0 payload shape; stale comments; typecheck 96). The delta is unreviewed code
(fixes to the first review's findings): look for regressions the fixes introduced, not for the old findings.

## Look for (correctness first)
1. Search: does widening "Class" to `masterclass`+`workshop` double-count, change the "Workshop" chip, break facet counts, or hit `genreSynonyms`?
2. `chipHint` x phase x busy x blocked: any state where copy still names a disabled/absent control; any state now unreachable or untested.
3. `typeSublabel`/review card: same fact, same words on every screen; empty states say what the person CAN do.
4. Removed `created` flag: any path where the Open button or navigation now behaves differently.
5. The memoised upcoming set in the editor: stale-deps bugs when dates change after save/cancel.
6. Guard (`scripts/check-event-truth-v1.mjs`): after #780 is applied a real drift must NOT mention #780; before it, a missing payload must. Mutation-check the claim by reading the self-test.
7. Tests that cannot fail (assert what the code sets).

## Deliver
`docs/handover/event-truth-p1p3-review7.md` with a JSON array of findings (file, line, summary, failure_scenario, severity high|medium|low) ranked most severe first,
or the single line "No findings" plus what you checked and what you could NOT check. Read-only: run no CI, no build. Commit, push, report the head SHA.
