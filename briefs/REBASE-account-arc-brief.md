# REBASE -- account + journey-grid arc (5 conflicting PRs)

Lane: normal. This worker's ticket branch is `claude/rebase-account-arc`: use it ONLY for your handover doc and the done marker. This brief EXPLICITLY AUTHORISES the one exception to "push only your ticket branch": you may force-push the five PR branches below, each ONCE, with `git push --force-with-lease=<branch>:<expected-old-sha> origin <branch>` (plain git, no `gh api`, no shell variables). Nothing else.

## Owner's words
Owner 2026-10-24: "ONE REBASE WORKER PER ARC (2 at a time, nothing closed)". Never close a PR. Never merge. A PR you cannot rebase safely is LEFT UNTOUCHED and reported.

## Why
The PR Mergeable Guard fails on main because these PRs are CONFLICTING with main, so GitHub never queues their gates (the board goes quiet, not red). Goal: each PR becomes MERGEABLE against current main with its own meaning unchanged, gates queue again.

## The five PRs (all base=main; order = smallest conflict first)
| PR | branch | commits | files | rough conflicts vs main |
|---|---|---|---|---|
| #772 | claude/account-grid-1a | 1 | 16 | 5 |
| #773 | claude/account-grid-1b | 1 | 12 | 3 |
| #777 | claude/account-grid-3c | 7 | 52 | 25 |
| #776 | claude/account-grid-3ad | 7 | 66 | 36 |
| #780 | claude/account-grid-3b | 13 | 98 | 54 |
Main moved ~88 commits since they were cut. They may overlap each other (the account feature files, the journey grid). Find out first: `git merge-tree --write-tree --name-only origin/main origin/<branch>` per branch, and `git diff --stat origin/main...origin/<branch>` for overlap between them.

## Procedure, per PR, in the table order
1. Backup first: `git tag backup/<branch>-pre-rebase-2026-10-24 origin/<branch>` and `git push origin backup/<branch>-pre-rebase-2026-10-24` (a tag, reversible). Record the old head sha.
2. `git rebase origin/main` (or merge origin/main if the rebase conflicts on the same file in many commits; say which you chose). Resolve each conflict keeping BOTH sides' intent: main's newer behaviour wins where the two disagree about shared code, the PR's feature stays. Do not delete or weaken a test to make it pass.
3. If a conflict needs a PRODUCT decision, or main has already replaced what the PR builds (the code the PR changes no longer exists in that shape), STOP that PR: abort, push nothing for it, write it under "LEFT UNTOUCHED" with the reason and the exact conflicting files.
4. Run the tests that touch the PR's files (`npx vitest run <paths>`) plus `npm run lint`, `npx tsc --noEmit`, `npm run check:script-conventions` if scripts changed; compare against main (a test that was already red on main is not yours: say so). Journey-grid PRs: run `npm run check:journey-grid` if it exists.
5. Push the PR branch once with force-with-lease. Subject of the LAST commit stays the PR's own. Intermediate PRs: add `[skip preview]` only if you must add a commit; do not rewrite subjects just for that. Vercel is at ~75/100 deploys per 24 h: ONE push per branch, no retries.
6. After each push, `git ls-remote origin <branch>` must show your new sha; record it.

## Hard rules
- No `supabase/**`, no migration, no workflow file (`.github/workflows`: leave any conflict there for the owner and report it), no `--no-verify`.
- A rebase must not change what a PR does: after it, `git diff origin/main...<branch> --stat` file list should equal the old one minus files main already contains. Report any file that appeared or disappeared.
- Context: stay under 50%. Smallest PRs first; PARTIAL (some PRs done, the rest named) is a normal outcome.
- Handover doc `docs/rebase/account-arc-HANDOVER.md` on `claude/rebase-account-arc`: per PR: old sha, new sha, REBASED / LEFT UNTOUCHED, conflicting files, how resolved, tests run (counts), NOT verified. Then push the ticket branch and end the final commit subject with the done marker from your prompt.
- Report format: Verified / Not verified. Do not claim a PR is ready to merge: the orchestrator walks it and reviews.
