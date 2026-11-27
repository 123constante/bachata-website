# Brief: bot-pr-adopt (Website) — replace an owner-authored claude/** PR with a bot-authored one

Problems: P125, P138 (open-problems list, 2026-11-27).

## Why
Website PRs #2516 and #2519 were opened by 123constante (owner account) instead of kiki-claude-bot.
The merge gate needs a bot-authored PR so the owner login can Approve it, so each one had to be
closed and reopened by hand as the bot (#2516 -> #2518, #2519 -> #2520).
bachata-admin solved this in #1361: its bot-pr.yml replaces an owner-authored open PR on a
claude/** branch with a bot-authored copy. Website's bot-pr.yml never got that part.

## What to build (max 3 files)
1. `scripts/lib/bot-pr-adopt.mjs`: port from bachata-admin `origin/main:scripts/lib/bot-pr-adopt.mjs`
   (148 lines). Website already has `scripts/lib/entry-point.mjs`; reuse it.
2. `tests/botPrAdopt.test.ts`: port from bachata-admin `origin/main:tests/botPrAdopt.test.ts` (vitest).
3. `.github/workflows/bot-pr.yml`: replace the "existing open PR / already merged" shell decision with
   `ADOPT_OUT=adopt.out node scripts/lib/bot-pr-adopt.mjs` and `[ "$(cat adopt.out)" = "open" ] || exit 0`,
   as admin does.

## Keep exactly as Website has them (do NOT copy admin's versions)
- The `if:` that skips `claude/review-*` and `claude/done-*` branches (owner click 2026-11-04).
- `runs-on: ubuntu-latest`, `actions/checkout@v7` with `ref: default_branch`, `persist-credentials: false`.
  The token step must only run code from the default branch, never from the pushed branch.
- The PR body from `scripts/pr-body-stub.mjs` for a NEW PR. When an owner-authored PR is replaced,
  carry its existing title, body and labels over (admin behaviour); do not regenerate the body.
- The "already merged: open nothing" rule (#547, #553, #554).

## Situations the test must cover
- No open PR -> open as bot. Open PR by the bot -> nothing. Open PR by 123constante -> close it,
  open the same title/head/base/body as the bot, copy labels, comment "Replaced by #<new>".
- Branch already has a merged PR -> nothing. API error -> fail loudly, never close without reopening.
- Draft owner PR or fork head -> nothing + warning (admin behaviour).

## Done when
`npx vitest run tests/botPrAdopt.test.ts` is green, `npm run typecheck` is green, workflow YAML parses.
Max 3 files, about 350 lines. No other files.
