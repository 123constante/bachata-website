# REBASE -- two small singles: #742 and #884

Lane: normal. Your ticket branch is `claude/rebase-small-singles`: use it ONLY for your handover doc and the done marker. This brief EXPLICITLY AUTHORISES one exception to "push only your ticket branch": you may force-push `hide-videographers-page` (#742) and `s13-site-background` (#884), each ONCE, with `git push --force-with-lease=<branch>:<expected-old-sha> origin <branch>` (plain git, no `gh api`, no shell variables). Nothing else.

## Owner's words
Owner 2026-10-24: "ONE REBASE WORKER PER ARC ... nothing closed". Never close a PR. Never merge. A PR you cannot rebase safely is LEFT UNTOUCHED and reported.

## Why
Both PRs are CONFLICTING with main, so their gates never queue and the PR Mergeable Guard is red. Goal: each becomes MERGEABLE against current main, meaning unchanged.

## The PRs (order: #742 first)
| PR | branch | base | commits | notes (audit REPORT.md on `claude/audit-conflicting-prs`) |
|---|---|---|---|---|
| #742 | hide-videographers-page | main | 2 | hides /videographers behind VIDEOGRAPHERS_PUBLIC_ENABLED; about 2 conflicted files; /videographers still routed and in the sitemap on main |
| #884 | s13-site-background | s12-mockups (stack #883>#882>#877>#875>#871, none on main) | 7 | S13 background mockups: 41 docs + s13Background.tsx, GlobalLayout 8 lines; about 1 conflicted file |

For #884 the base is a stacked mockup chain that is NOT on main. Rebase only #884's own 7 commits onto origin/main (`git rebase --onto origin/main <old-base-tip> <branch>`); if its docs or code depend on files only the other mockup PRs add, STOP and report LEFT UNTOUCHED with the dependency list. Do not touch #883 #882 #877 #875 #871.

## Procedure, per PR
1. Backup: `git tag backup/<branch>-pre-rebase-2026-10-25 origin/<branch>` and push the tag. Record the old head sha.
2. `git merge-tree --write-tree --name-only origin/main origin/<branch>` to list conflicts, then rebase. Main's newer behaviour wins on shared code; the PR's feature stays. Never weaken a test.
3. Product decision needed, or main already replaced what the PR builds: abort, push nothing, report under LEFT UNTOUCHED.
4. Verify: `npx vitest run` on the touched paths (for #742 include sitemap and routing tests, and `npm run check:sitemap` if it exists), `npm run lint`, `npx tsc --noEmit`. Tests red on main are not yours.
5. ONE force-with-lease push per branch. Vercel cap: no retries. `git ls-remote origin <branch>` must show the new sha.

## Hard rules
- No `supabase/**`, no migration, no `.github/workflows` edits, no `--no-verify`.
- After the rebase, `git diff origin/main...<branch> --stat` file list must equal the old one minus files main has. Report every file that appeared or vanished.
- Context under 50%. PARTIAL is normal.
- Handover `docs/rebase/small-singles-HANDOVER.md` on `claude/rebase-small-singles`: per PR old sha, new sha, REBASED / LEFT UNTOUCHED, conflicting files, how resolved, tests (counts), Verified / Not verified. Push the ticket branch; end the final commit subject with the done marker from your prompt.
- Do not claim ready to merge; the orchestrator reviews.
