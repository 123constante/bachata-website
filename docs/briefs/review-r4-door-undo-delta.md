# Review: Website PR #1805 (R4 door Undo, merge-of-main delta), hard tier

PR #1805 (branch claude/door-undo-rebase) supersedes #1804. Prior review: docs/review/review-pr-1804.md on origin/claude/review-r4-door-undo = PASS WITH NITS, Hard-tier PASS at f336b66f34971ec20536b8bb7421f41f40a37c1d. #1805 head is f336b66 plus ONE merge commit of main (e4b057670).

Read-only: change nothing, push only your review doc. Check with evidence:
1. `git diff f336b66..<head> --stat` for the Door Undo files (src/modules/organiser/p3/door/*, scripts/onboarding-write-doors.json, tests/e2e/walk-r4-door-undo.spec.ts) shows NO change from the merge other than what main brought in; list any door file that differs and why.
2. The only conflict resolution is scripts/check-e2e-spec-coverage.mjs (both walk-r4-door-undo and walk-r4-team-invited lines kept); `node scripts/check-e2e-spec-coverage.mjs` passes.
3. The reviewed Undo logic (ticket_undo_check_in_v1 call, result mapping, double-tap guard) is unchanged and still correct against current main.

Write docs/review/review-pr-1805.md on your branch with these EXACT headings on their own lines: `## Verdict: PASS` (or PASS WITH NITS / BLOCK), `## Hard-tier: PASS` (or FAIL with reason), and a line `head e4b0576700a3a355bc646993d82709073e97f818` plus the words `PR #1805`.
