# Brief: walk judge screens coverage, continuation 1 (review fixes)
Brief-version: 2

Branch: claude/walk-judge-screens-coverage-r2 (ALREADY has the build at head d1530d3b; continue on it, do not recreate). Normal lane, Sonnet, context cap 50%. One push. No workflow files. Hard tier (scripts/**): still needs independent re-check and the owner Approve.

## Decisions
Independent review returned SAFE AFTER FIXES: the gate fails closed but is opt-in, so it cannot go red anywhere yet.

## What main lacks
- a default coverage path in the judge CLI. -- grep: DEFAULT_COVERAGE_PATH

## What to build
1. scripts/lib/walk-judge.mjs main(): make coverage mandatory: default to `docs/design/walk-coverage.json` (check the real path of walk-coverage.json in the repo first, use that), and exit 2 with a usage message only if the file cannot be found and `--no-coverage` was not passed. Keep the two-argument `judgeVerdict` for library tests only. Tests: CLI without --coverage uses the default and goes red on a missing screen; `--no-coverage` is explicit and prints a line saying coverage was skipped.
2. docs/handover/walk-gate-judge-web.md lines ~31-48: the "Brief ... r2" section was pasted inside backticks of an existing bullet. Close the bullet and give the r2 section its own `##` heading.
3. If `--input` or `--report` is unreadable, keep the coverage reason in the output too (do not replace it).
4. Run `npx vitest run` on the walk-judge and walk-fixtures tests, the script-conventions check, `npm run check:mojibake`. Update the PR body Verified / Not verified block; if the wiring into CI/lead routine is still not done, say so plainly under Not verified.
5. Commit `fix(walk): judge coverage mandatory by default, handover heading fixed [worker-done <ticket>]` and push ONCE.

## Files
- scripts/lib/walk-judge.mjs
- scripts/lib/walk-fixtures.mjs
- docs/handover/walk-gate-judge-web.md
- the existing walk-judge tests

## Done when
CLI is red on a missing screen without any flag; one push.
