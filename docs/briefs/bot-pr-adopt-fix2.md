# bot-pr-adopt fix 2 (PR #2522, branch claude/bot-pr-adopt): split out the workflow switch

Work ON the existing branch `claude/bot-pr-adopt` (head d50a485). Do NOT open a new PR for this branch; #2522 is it.

## Why
The `open-pr` job in .github/workflows/bot-pr.yml checks out the DEFAULT branch's scripts (security: the
step holds BOT_PR_TOKEN). The new yml calls `scripts/lib/bot-pr-adopt.mjs`, which is not on main until
#2522 merges, so open-pr is red on #2522 ("Cannot find module .../scripts/lib/bot-pr-adopt.mjs") and the
merge gate refuses a red check. Fix: land the script first, the switch second.

## Do
1. On `claude/bot-pr-adopt`: restore `.github/workflows/bot-pr.yml` to exactly origin/main's version
   (`git checkout origin/main -- .github/workflows/bot-pr.yml`). Keep everything else (scripts/lib/bot-pr-adopt.mjs,
   tests/botPrAdopt.test.ts, scripts/prove-entry-point-dispatch.mjs TARGETS entry). Merge origin/main into the
   branch first if it is behind (no rebase, no force push).
2. Make sure nothing in tests/botPrAdopt.test.ts (or any other test) asserts the yml contains the adopt call. If a
   test does, move that assertion into the follow-up below, not delete it.
3. Push. Commit message: `ci(bot-pr): keep the workflow switch out of #2522 (lands in a follow-up after the script is on main) [skip preview] [worker-done <ticket>]`.
4. Write the follow-up yml change (d50a485's version of .github/workflows/bot-pr.yml, i.e. `git show d50a485:.github/workflows/bot-pr.yml`) plus any moved yml assertion to the brief branch as a ready patch:
   file `docs/briefs/bot-pr-adopt-switch.patch` on branch `brief/bot-pr-adopt` (contents API or push to that branch; NOT to claude/bot-pr-adopt).

## Prove it
`npx vitest run tests/botPrAdopt.test.ts tests/entryPointCoverage.test.ts` green; `node scripts/prove-entry-point-dispatch.mjs` PASS;
`git diff origin/main -- .github/workflows/bot-pr.yml` empty. Handover lists the patch location.

## Out of scope
src/pages/__tests__/classesTwoDoors.test.tsx (fixed separately, P143). Any behaviour change to the script.

Size: 1-2 files on the branch + 1 patch file on the brief branch. Max 3 files. Design: none (CI).
