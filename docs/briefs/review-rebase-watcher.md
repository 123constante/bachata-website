# Brief: independent delta review, PR #1834 auto-rebase watcher. Lane: careful (workflow with push rights), docs only, read-only. Model: Fable.
Review, do NOT build. Stopping rule: ONE round; judge only the list below.
Inputs: `git fetch origin claude/rebase-watcher` (head 43ca09a24). Files: `.github/workflows/pr-auto-rebase.yml`, `scripts/pr-auto-rebase.mjs`, `.github/automation/secrets-register.json`, `tests/automationRegister.test.ts`, `docs/ci-guard-notes.md`.
Judge:
1. Token: which token the workflow uses; no new secret introduced (compare the secrets-register diff); permissions block minimal.
2. Push safety: `--force-with-lease` only, only on the PR's own head branch, never `main`, never a branch not tied to an open PR; fork PRs skipped.
3. Cap: at most 5 PRs per run; cron every 15 min; `workflow_dispatch` with `dry_run` really pushes nothing when true.
4. Robustness: the 6 earlier findings (conflict that cannot auto-resolve aborts cleanly and leaves the branch untouched; no loop on a PR that stays conflicted; draft and bot-owned branches; rate limit; concurrency group; failure reports once not every run). Quote the code line for each.
5. Does a rebase push re-trigger CI and invalidate the owner's approval at the old head in a way that breaks merge flow? State the effect as a NOTE.
Output: `docs/review/rebase-watcher-r1.md` on your branch with the heading line `## Verdict: PASS` or `PASS WITH NITS` or `BLOCK`, naming "PR #1834" and head `43ca09a24`, each item marked BLOCKING or NOTE (BLOCKING only if it can lose work, push to the wrong branch, or leak a token), plus Verified / Not verified. Push to your branch only.
