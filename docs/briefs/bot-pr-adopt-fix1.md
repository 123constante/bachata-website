# bot-pr-adopt fix 1 (PR #2522, branch claude/bot-pr-adopt)

Work ON the existing branch `claude/bot-pr-adopt` (head ba63aee). Do NOT open a new PR; #2522 (bot-authored) is the PR. Push commits to the branch.

## 1. Red CI (must fix)
`tests/entryPointCoverage.test.ts` fails on CI:
"scripts/lib/bot-pr-adopt.mjs -- add it to TARGETS in scripts/prove-entry-point-dispatch.mjs".
Add `{ rel: 'scripts/lib/bot-pr-adopt.mjs' }` to TARGETS (around line 166-252), matching neighbours' shape. Run `npx vitest run tests/entryPointCoverage.test.ts tests/botPrAdopt.test.ts` and `node scripts/prove-entry-point-dispatch.mjs` green.

## 2. Review findings (docs/review/2522-r1.md on branch claude/review-2522-r1)
Compare with admin reference `bachata-admin-11april/scripts/lib/bot-pr-adopt.mjs`.
- F1 (scripts/lib/bot-pr-adopt.mjs ~59): only the first open PR is checked. Port admin's behaviour: more than one open PR for the branch -> warn and do nothing.
- F2 (~90-91): if label copy or the comment fails after the bot PR exists, do not fail the step silently losing labels: put the old PR's label names in the error/warning text.
- F3 (~60): owner-login compare case-insensitive (lowercase both), like admin.
- F7 (.github/workflows/bot-pr.yml ~59): guard `[ -f adopt.out ]` so a missing file is an explicit error, not a silent exit 0.
Add a test case for F1 and F3 in tests/botPrAdopt.test.ts.

## Out of scope
`src/pages/__tests__/classesTwoDoors.test.tsx` is red on main too (date-bound); do not touch. `open-pr` job red on this branch is expected (script read from main until merge).

Size: 4 files, 120 lines. Max 4 files. Design: none (non-UI CI script). Commit message ends with [skip preview]. Last commit carries `[worker-done <ticket>]`.
