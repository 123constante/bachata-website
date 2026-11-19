# Brief: auto-rebase watcher (GUARD-CI, invisible, no UI)

Owner decision 2026-11-19: a conflicted PR must not sit. Build a GitHub Actions cron in this repo.

## Build
- New workflow `.github/workflows/pr-auto-rebase.yml`, cron every 15 minutes plus workflow_dispatch.
- For each open PR whose mergeStateStatus is DIRTY (same signal as `scripts/check-pr-mergeable.mjs`; reuse it, read it first):
  1. Try a rebase onto main in a fresh checkout (git only, no force push to main; `--force-with-lease` to the PR branch only).
  2. Clean rebase: push it. Do not touch draft PRs or PRs whose head repo is a fork.
  3. Real conflict: abort, add label `needs-rebase` once (create the label if missing), post ONE comment listing the conflicted files. Never comment twice for the same head SHA.
  4. When a PR is no longer DIRTY, remove `needs-rebase`.
- Cap 5 PRs per run. Skip PRs touched in the last 10 minutes (a window may be pushing).
- Token: the repo's existing bot/PAT secret that other workflows use, so pushes retrigger `pull_request` checks (GITHUB_TOKEN pushes do not). Read how other workflows authenticate; add no new secret.
- Obey `scripts/check-script-conventions.mjs` six rules for any new script. Put the logic in `scripts/pr-auto-rebase.mjs` with a `--self-test` (clean, conflict, draft, fork, idempotent comment) and wire it into the existing test list.
- Zero migrations. No UI change. One branch, one PR.

## Done
`npm run pre-ship` green; self-test passes; PR body shows a dry-run (workflow_dispatch with dry-run input) result on the real open PR list.
