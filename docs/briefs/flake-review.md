## Aim
Independent review of two test-only flake-fix PRs in 123constante/bachata-website. Read-only on the PR branches. Output: one review doc per PR.

## PRs and heads (review exactly these heads; if a head moved, review the new head and say so)
- #1852 `claude/flake-routerunner-hooks-bot`, head 83477ad7025c7040ba5fca89ae7005e7a3700d83. Fix: `tests/routeRunner.test.ts` test-gate-hooks shell test uses a stall watchdog plus a ceiling instead of a flat 60 s spawnSync cap.
- #1854 `claude/flake-otp-disabled-bot`, head d2e6f6f5e0796e58549e59dfb088b3bb2ba0d301. Fix: `tests/regression/today/auth.today.test.tsx` otp_disabled test waits for the settled sign-up heading, not a fixed 40 ms tick.

## What to check (per PR)
1. Diff touches tests only (no app code, no CI config, no migrations).
2. No retry, skip, `.only`, deleted assertion, or timeout bump that hides the failure. The assertion still proves the original behaviour.
3. The root cause in the PR body matches the diff. The fix removes the race, not the symptom.
4. #1852 only: the watchdog kills the child process group on stall and on ceiling, cannot leave orphans, and cannot pass when the script hangs.
5. Run the touched test file once locally (`npx vitest run <file>`) and report pass or fail.

## Output
For each PR, on its own branch cut from origin/main:
- #1852: branch `claude/review-1852-r1`, file `docs/review/1852-r1.md`
- #1854: branch `claude/review-1854-r1`, file `docs/review/1854-r1.md`

Each doc has: a line `## Verdict: PASS` or `## Verdict: PASS WITH NITS` or `## Verdict: BLOCK` (exactly one Verdict line), the text `head <full sha>` of the reviewed head, `PR #<n>` in the title, findings one per line with file:line, and what you did not verify. Push both branches. Do not merge, approve, or edit the PR branches.
