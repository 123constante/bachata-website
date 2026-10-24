# REBASE -- organiser events rebuild (ER) stack tip #914

Lane: normal. Your ticket branch is `claude/rebase-er-stack`: use it ONLY for your handover doc and the done marker. This brief EXPLICITLY AUTHORISES one exception to "push only your ticket branch": you may force-push the branch `claude/er-c8-eventpage` (PR #914) ONCE, with `git push --force-with-lease=claude/er-c8-eventpage:<expected-old-sha> origin claude/er-c8-eventpage` (plain git, no `gh api`, no shell variables). Nothing else.

## Owner's words
Owner 2026-10-24: "ONE REBASE WORKER PER ARC ... nothing closed". Owner 2026-10-25: #911 #912 #916 are REBUILD LATER: do not touch them. Never close a PR. Never merge.

## Why
#914 is CONFLICTING with main, so GitHub never queues its gates and the PR Mergeable Guard is red. Goal: #914 becomes MERGEABLE against current main with its meaning unchanged.

## Scope
Only #914 `claude/er-c8-eventpage` (47 commits, 112 files, about 7 conflicted files vs main). It is the tip of the stack #903 -> #904/#905 -> #917 -> #919 -> #914 and carries all of them (audit: docs/audit/conflicting-prs/REPORT.md on `claude/audit-conflicting-prs`, ER section). Do NOT rebase or touch #903 #904 #905 #917 #919 #911 #912 #916; they are listed so you do not re-do them.

## Procedure
1. Find the conflicts: `git merge-tree --write-tree --name-only origin/main origin/claude/er-c8-eventpage`.
2. Backup: `git tag backup/er-c8-eventpage-pre-rebase-2026-10-25 origin/claude/er-c8-eventpage` and `git push origin backup/er-c8-eventpage-pre-rebase-2026-10-25`. Record the old head sha.
3. Rebase onto origin/main, or merge origin/main if the same file conflicts in many commits (say which). Keep BOTH sides' intent: main's newer behaviour wins on shared code, the ER feature stays. Never delete or weaken a test to pass.
4. If a conflict needs a PRODUCT decision, or main already replaced what the PR builds (e.g. #809 retired NewEventPage, organiser R1 landed via #809), STOP: abort, push nothing, report under "LEFT UNTOUCHED" with the exact files.
5. Verify: `npx vitest run` on the ER paths (organiser/events, EventPage, sessions, venue, organisers, dates) plus `npm run lint`, `npx tsc --noEmit`, `npm run check:script-conventions` if scripts changed. Compare red tests with main; a test already red on main is not yours. Run the snapshot test `editorOrder.matrix.test.tsx` and say if the snapshot changed.
6. ONE force-with-lease push. Last commit subject stays the PR's own. Vercel cap: ONE push, no retries. `git ls-remote origin claude/er-c8-eventpage` must show the new sha.

## Hard rules
- No `supabase/**`, no migration, no `.github/workflows` edits (report a conflict there), no `--no-verify`.
- After the rebase, `git diff origin/main...claude/er-c8-eventpage --stat` file list must equal the old one minus files main already has. Report every file that appeared or vanished.
- Context under 50%. PARTIAL is a normal outcome.
- Handover `docs/rebase/er-stack-HANDOVER.md` on `claude/rebase-er-stack`: old sha, new sha, REBASED / LEFT UNTOUCHED, conflicting files, how resolved, tests (counts), Verified / Not verified. Push the ticket branch; end the final commit subject with the done marker from your prompt.
- Do not claim ready to merge; the orchestrator walks and reviews.
