# Handover: browser CI jobs in the Playwright container (dt_9939e9c9e153)

Brief: `brief/ci-playwright-container:docs/briefs/ci-playwright-container.md`.
Branch `claude/ci-playwright-container`, PR #1544 (bot-opened, body filled by the worker).

## Done
- `phone-qa` (shards 1-3) and `build-smoke` in `.github/workflows/phone-qa.yml`, and
  `e2e-smoke` in `.github/workflows/e2e-smoke.yml`, now run in
  `container: image: mcr.microsoft.com/playwright:v1.63.0-noble` (tag = `@playwright/test`
  1.63.0 in package-lock.json, pinned).
- The `npx playwright install --with-deps chromium` step (the apt call that failed on
  runner DNS) is gone from all three jobs.
- Added `git config --global --add safe.directory "$GITHUB_WORKSPACE"` after checkout
  (root in the container vs runner-owned workspace: "dubious ownership" otherwise).
  The image ships git (Dockerfile.noble installs git + openssh-client), so no apt.
- Job-level `XDG_CACHE_HOME: /root/.cache`: the first run (head 2ad5ded) failed in all
  five jobs because @swc/core 1.16 refuses its native-addon cache under the container's
  HOME (/github/home, parent writable by another user). Reproduced locally; the env fixes it.
- Job names, matrix, check names, setup-node 22 + npm 11, test steps, env, uploads unchanged.

## Left / for the owner
- `check-automation-workflow-allowlist` is RED on this PR by design: a `claude/` branch
  edits two workflows not on `scripts/data/automation-workflow-allowlist.json`. Only the
  owner may add names (or approve/merge past it). The worker did not touch the list.
- Not converted: `live-qa.yml`, `prod-smoke.yml`, `synthetic-ssr-monitor.yml` (both jobs).
  They never run on a `claude/` PR, so this PR could not prove them. Same change applies
  if wanted; prove each with a `workflow_dispatch` run after merge.
- Version drift: a Dependabot bump of `@playwright/test` must bump the image tag in the
  same PR, else the browser executable is missing and the jobs go red. A small guard
  (lockfile version == image tag) would make that a named failure; not built here
  (brief: workflow-only).
- Hard tier: independent review at head before merge; the lead merges.

## CI result
See the per-job table in the PR #1544 body (run ids there).
