# Brief: vercel-build-budget (Website, one worker, ONE push)

## Why
Vercel Hobby allows ~100 deployments per rolling 24 h. On 2026-10-16 we made 93 and hit "Deployment rate limited -
retry in 24 hours": no PR previews, and a merge to main would not have deployed production either (no urgent fix possible).
Measured over the last 3 days (126 deploys): `arc/briefs-dancer-rebuild` 24 + `arc/briefs-organiser-r1` 21 (docs-only
brief branches, 36% of all builds), many `claude/*-review` doc branches, and many worker CHECKPOINT pushes on feature
branches. Only a worker's final push needs a preview.

## Decision already made (do not re-open)
Extend the EXISTING ignore step, `scripts/vercel-ignore-build.sh` (vercel.json `ignoreCommand`, PR #666). Read its whole
header comment first: it explains why every non-bot branch builds today (the PR preview jobs poll
`scripts/lib/previewProbe.mjs`, which throws after 600 s when the head sha has no ready deployment).

## Task
1. `scripts/vercel-ignore-build.sh`, NON-production only, checked BEFORE the existing branch/diff logic:
   - SKIP when the branch starts with `arc/briefs-`, `claude/done-` or `claude/review-` (doc/brief/done-signal branches).
   - SKIP when `VERCEL_GIT_COMMIT_MESSAGE` contains `[skip preview]` (a worker checkpoint commit).
   - Production (`VERCEL_ENV=production`, main) behaviour is UNCHANGED. Every unknown case still BUILDS (fail-safe).
   - Because a skipped build is CANCELED, a later final commit WITHOUT the tag builds normally (it is not skip-eligible).
2. One source of truth for the no-preview branch prefixes (`bot/`, `dependabot/`, `arc/briefs-`, `claude/done-`,
   `claude/review-`). Use it in the ignore script AND in the `if:` exclusions of the preview jobs in
   `.github/workflows/perf-budget.yml`, `synthetic-ssr-monitor.yml`, `seo-check.yml` and `og-image-check.yml` (they say
   "keep this list in sync with that ignoreCommand"; grep for every such job). Add a check script that fails when the
   script's list and any workflow's list differ, and wire it into an existing CI job that already runs repo checks.
   Prove it with a rolled-back mutant (drop one prefix from one workflow: it must fail; restore: it must pass).
3. `scripts/lib/previewProbe.mjs`: if the head commit message contains `[skip preview]`, fail FAST (well under 1 minute)
   with: "checkpoint commit: no preview by design; the final worker push builds one". It must stay RED, never green:
   a head that was never previewed must not look verified.
4. `docs/pr-batching-policy.md`: add a short "Vercel build budget" section: the rule above; workers end checkpoint
   commit subjects with `[skip preview]` and NEVER put it on the final `[worker-done]` push; the emergency path when
   rate-limited = Vercel Instant Rollback to the previous production deployment (needs no build), marked "not verified
   on Hobby".
5. Tests, red-first: a table-driven test that runs the real shell script with env vars set (branch x commit message x
   VERCEL_ENV x diff), covering at least: brief/review/done branches skip; `[skip preview]` skips; a normal claude/*
   branch builds; a final commit after skipped checkpoints builds; main/production unchanged; bot/* unchanged. Run it
   against the UNCHANGED script first and paste the red lines in the PR body, then green. Plus a unit test for the
   previewProbe fast-fail.

## Gates and boundaries
- Branch `claude/vercel-build-budget` from main. ONE push at the end (checkpoint commits locally only).
- Read and push with plain git; never `gh api`. Write shell commands without variables, loops or `$(...)` where a plain
  command works.
- GitHub Actions may be refused for billing ("payments have failed"): run EVERY step of every workflow job your change
  touches yourself (read `.github/workflows`), and put a per-job table (command, exit code) in the PR body.
- Open the PR as the bot (`gh pr create` with the bot token in the environment). Never merge or approve. Never `--no-verify`.
- Do not touch app code (`app/`, `src/`), vercel.json redirects/headers, or any other branch. Other sessions own the
  organiser and dancer work.
- Handover: `docs/handovers/vercel-build-budget.md` on your branch (done / left / next).
- PR body ends with a Verified / Not verified block (Not verified: real Vercel skip behaviour until merged; Instant Rollback).
