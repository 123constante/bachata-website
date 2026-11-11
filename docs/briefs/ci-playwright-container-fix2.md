# Brief (follow-up): fix the red container jobs on PR #1544

Repo: 123constante/bachata-website. Branch: claude/ci-playwright-container (existing PR #1544, head 2ad5deddf). Lane: careful. Push to this branch only. Bot-authored. Read the first brief (brief-ci-playwright-container.md) for context.

## What failed (quoted from the job logs, run 43044167158 / 43044167505)
phone-qa (1-3), build-smoke, e2e-smoke all stop at Vite start:
`failed to load config from /__w/bachata-website/bachata-website/vite.config.ts` / `Error: Failed to load native binding` / `Cannot find module './swc.linux-x64-gnu.node'` /
`SWC native addon: validate cache root /github/home/.cache: cache root has a parent writable by another user without trusted sticky protection. ... check SWC_NATIVE_BINDING_CACHE and directory permissions`.
So the container HOME (/github/home) has unsafe permissions for SWC's native-binding cache. The image pull and browsers work.

## Task
1. Fix it inside the workflow only. Preferred: job-level `env: SWC_NATIVE_BINDING_CACHE: /tmp/swc-cache` (or set `HOME` to a fresh dir) on the three container jobs. Pick whichever works; no apt, no test or app changes.
2. Do NOT edit `scripts/data/automation-workflow-allowlist.json` with a worker guess: the owner approved adding exactly `.github/workflows/e2e-smoke.yml` and `.github/workflows/phone-qa.yml` (click 2026-11-11). Add those two names to that file in the same PR, nothing else, so masking-check (which failed: "changes workflow file(s) not on allow-list") passes. Read docs/ci-guard-notes.md#automation-workflow-allow-list first; if the guard needs anything else (a note, a test), do only that.
3. Push once. Get phone-qa 1-3, build-smoke, e2e-smoke and masking-check to actually RUN green. A pull failure or runner DNS red is not a pass: re-run once, report.
4. Update the PR body: per-job CI table (job, install step gone, result, run link), Verified / Not verified, rollback = revert this PR.

## Boundaries
Config-only. No secrets, no prod writes, no triggers/runs-on/permissions/pull_request_target changes. Never merge or approve. Report PR URL and final run ids.
