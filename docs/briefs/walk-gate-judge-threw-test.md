# Brief: walk-gate-judge-threw-test (WEBSITE, tests + one tiny guard in scripts/lib, Opus, Careful lane). Branch claude/walk-judge-screens-coverage-r2 (EXISTING, PR #1453, head d1530d3; continue on it).

Brief-version: 2

Context line: stay under 40% of your context; push + handover by 50%. Never merge/approve/--no-verify. Plain git only. Supabase READ-ONLY. Hard-tier path `scripts/**`: the lead gives the owner Approve at the final head; the worker never merges or approves. ONE push, the last action (no early pushes except a stranded-work checkpoint). Start: `git fetch origin claude/walk-judge-screens-coverage-r2` then `git checkout -B claude/walk-judge-screens-coverage-r2 origin/claude/walk-judge-screens-coverage-r2` in a clean worktree (never recreate the branch from main).

## What main lacks
The PR #1453 body admits 9 of 10 red-reason kinds are tested; the exception-from-coverage-check path is not. Facts below were checked on the PR head with `git show origin/claude/walk-judge-screens-coverage-r2:<path>`.
- No test makes the coverage check throw -- grep: "coverage check threw|threw" in tests/walkJudge.test.ts finds only the report-getter test (~line 218, `/threw/`)
- The text `coverage check threw` does not exist in the code today. The only catch is `judgeSafe` in `scripts/lib/walk-judge.mjs` (~line 258), which returns ONLY `judge threw: <msg>`, so a throw inside the coverage thunk drops every other red reason -- scripts/lib/walk-judge.mjs (judgeVerdict / judgeSafe, ~lines 252-263)
- `screensMissingFromCoverage` is documented "never throws", so the only ways to throw are a hostile input (throwing getter on `coverage` or `input.screens`) -- scripts/lib/walk-fixtures.mjs (line 152)
- No test named for the duplicate-input-ids finding, though the handover says it is fixed -- grep: "duplicate" in tests/walkJudge.test.ts and tests/walkFixtures.test.ts finds nothing; handover docs/handover/walk-gate-judge-web.md (~line 61, "duplicate input ids")
- Handover test list lacks both tests -- docs/handover/walk-gate-judge-web.md (~lines 19-22, 60)

## Files
- scripts/lib/walk-judge.mjs (only the coverage-thunk catch, if needed)
- tests/walkJudge.test.ts
- tests/walkFixtures.test.ts (duplicate ids test, if it belongs there)
- docs/handover/walk-gate-judge-web.md

## Deliverables
1. Coverage-throw behaviour + table-driven test. In `judgeVerdict`, catch an exception thrown by the coverage check separately from `judgeSafe`'s outer catch, turning it into ONE red reason that starts with `coverage check threw: <message>`; the rest of `judge(...)` still runs, all its red reasons are kept, the coverage reason comes first (like other `coverage:` reasons). The pass path and the two-argument verdict stay byte-for-byte unchanged. Table rows: throwing getter on `coverage` object; throwing getter on `input.screens`; non-Error thrown value (string, null); each combined with an input that has another red reason (assert both reasons, coverage first) and with a clean input (assert red, single reason, never pass). RED-FIRST: write the test, run it against the unmodified code (show red, since today only `judge threw:` comes back), then add the catch (green). Then a mutant: temporarily delete the new catch, show the table goes red, restore (record both in the PR body).
2. Duplicate-input-ids test. Find the existing duplicate-id handling in `screensMissingFromCoverage`; add (or point to, if one exists under another name) a test whose name contains `duplicate input ids`, asserting the problem is reported once per duplicated id and that `judgeVerdict` goes red with a `coverage:` reason. Prove it red against a mutant that removes the duplicate check, then restore. Update the handover's test list (counts and names for both tests, the `coverage check threw` reason, rubric now 10 of 10).

## Limits
- Tests plus the one catch above. No workflow, package.json, other guard or docs/automation edit (if `docs/automation/judge-worker.md` has a drift test naming the reason text, report it; do not widen scope).
- PR body: keep the existing labels; tests-only so NO Phone QA section; update "Verified on real data" (no shapes: pure function) and replace the "NOT verified: coverage check threw has no test" line; add the red-first and mutant evidence. `node scripts/check-pr-real-data-verified.mjs` and `node scripts/check-pr-phone-qa.mjs` must both exit 0 against the final body.
- Commit subject ends [worker-done <ticket>].

## Verify
Run the 7 walk test files (426 tests today, plus yours), `node scripts/prove-entry-point-dispatch.mjs`, `node scripts/check-script-conventions.mjs`, `npm run check:mojibake`, `npm run lint`, eslint on touched files, tsc on the two root configs; put the per-job table in the PR body. Handover with Verified / Not verified.
