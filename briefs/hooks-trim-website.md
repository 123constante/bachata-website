# Brief: Website session-boot trim (owner decision 2026-10-15, a23)

Repo `123constante/bachata-website`, new branch `claude/hooks-trim` from `origin/main`. Read `briefs/dancer-rebuild-COMMON.md`
on `arc/briefs-dancer-rebuild` first. Plain git only, never `gh api`. Commands without variables, loops or `$(...)`
where a plain command works.

## Why
The owner asked which hooks waste his sessions. The SessionStart `session-boot.mjs` (path from `.claude/settings.json`)
prints a large block every session start, mostly unrelated to current work, costing the orchestrator context.

## Task
1. Trim its output to: branch + `git status -sb` (max 10 lines), last 3 commits, and ONE line pointing at the newest
   `~/.claude/plans/HANDOVER-*.md` if it exists. Drop every other section from the boot output (the scripts computing
   them stay; they are just not printed at boot). Keep all other hooks exactly as they are.
2. Update tests that pinned the removed sections; run every CI job step touched (per-job table: command, exit). Check a
   PRODUCTION build is unaffected (`npm run build`).
3. Push; the bot opens the PR. PR body: before/after boot output line counts, Phone QA = "no UI change", Verified / Not
   verified. Handover `docs/handover/hooks-trim.md`, done marker per COMMON. Never merge or approve. Stop after the push.
