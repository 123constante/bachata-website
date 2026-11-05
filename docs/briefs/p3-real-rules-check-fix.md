# Brief: fix review findings on PR #1389 (p3-real-rules-check)

Lane: careful (scripts/** guard). Model: Opus. Branch: claude/p3-real-rules-check (PR #1389 exists; check it out from origin, do not recreate). Small slice, 4 deliverables.

Independent review 2026-11-05 of head 5200bd65: PASS WITH FIXES.

## Left
1. RED CI job `integrity`, step "Entry-point dispatch proof": scripts/prove-entry-point-dispatch.mjs exits 2 because scripts/check-p3-refusal-reasons.mjs uses isEntryPoint (around line 213) but is not in its TARGETS. Add the script to TARGETS, run `npm run prove:entry-point`, and run the other integrity-job steps that apply (read .github/workflows for the `integrity` job; run every step that does not need a live deploy) before pushing.
2. Hardening in scripts/check-p3-refusal-reasons.mjs readLive catch: never log `e.message` (a psql failure puts the connection string on the first line). Log a fixed line such as `psql failed (exit N)` using the exit status only. Add a self-test case that proves a failing psql with a fake URL containing a fake password prints no part of the URL. Also make the --live step message say clearly if psql is missing on the runner while the secret is set (it must still exit 2 in that case: a configured secret with no psql is a real fault; only an ABSENT secret skips).
3. PR body nits: it says "33 rows" but the matrix has 35 (8 command, 2 onboarding, 1 discard, 18 ticket, 4 team, 2 join); fix the number. Keep the Phone QA section honest ("not walked, tests only") or remove it per the tests-only rule; run both check-pr scripts (exit 0).
4. Record in the PR body under Not verified: `--live step: needs P3_RULES_DB_URL secret; lead raises it with the owner`, and `F-10 and F-46 rows are source-text regexes, brittle to refactors; F-15 is a copy check, not a behaviour check`.

Limits: no other changes; do not weaken any assertion; do not merge or approve. Push once as the final push (no [skip preview]); end the subject with the worker-done marker from your ticket. Report head SHA and the per-job CI table (integrity must be green).
