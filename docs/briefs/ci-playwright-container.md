# Brief: run Website browser CI jobs in the Playwright container image

Repo: 123constante/bachata-website. Branch: claude/ci-playwright-container (off fresh origin/main). Lane: careful (touches .github/workflows). One PR, bot-authored.

## Why
GitHub runner apt DNS fails ("Temporary failure resolving 'azure.archive.ubuntu.com'") at the step "Install Playwright browsers" (`playwright install --with-deps` runs apt). It reds phone-qa (1-3), build-smoke and e2e-smoke on PR #1542 across 3 re-runs (runs 43033616894, 43033616823). Main is green, so it is infra, not code. Owner click 2026-11-11: fix long term with the Playwright container image; start now, in parallel with #1542.

## Task
1. Read `.github/workflows/*` and find every job that runs `playwright install` (phone-qa matrix, build-smoke, e2e-smoke, any other).
2. Run those jobs with `container: image: mcr.microsoft.com/playwright:v<X>-noble`, X = the exact `@playwright/test` version in package-lock.json (image tag must match, pinned, never `latest`). Remove the apt/`--with-deps` browser install step from them. Keep job names, matrix shape and required-check names IDENTICAL so branch protection still matches.
3. Check what the jobs assume from the host runner (node setup, caches, `HOME`, webServer ports/localhost, env files, artifact upload, services) and keep each working inside the container. Node must come from the image or setup-node; do not add apt calls.
4. Do not change tests, app code, secrets, or any non-browser job.

## Gates (every job step run, nothing skipped)
- Push once; get phone-qa 1-3, build-smoke, e2e-smoke to actually RUN green on the PR (a failed pull of the image or a runner DNS red on docker pull is not a pass: re-run once, report).
- Per-job CI table in the PR body: job, install step gone (yes/no), result, run link.
- Verified / Not verified block in the PR. Note rollback = revert this one PR.

## Boundaries
Workflow-only change (hard tier: independent review at the head before merge; the lead merges). No secrets in the brief or PR. No prod writes. Never merge or approve. Report the PR URL and the final run ids.
