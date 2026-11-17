# Brief: CI speed (profile first, then trim)

Class: BUILD-non-visual + GUARD-CI. Lane: normal. One branch `claude/ci-speed`, one PR.

## Why
Website PR CI waits are long. Measured on ~300 recent PR runs (owner asked for an audit 2026-11-17):
- Phone QA avg 562s (bimodal: ~65s when heavy steps skip, ~720s full). Shard 1 = 606s, shard 3 = 347s on run 44096622262.
- E2E Smoke avg 420s, max 1168s. Not yet broken down.
- Unit & Contract avg 369s; the `unit (Europe/London, full)` job's "Run unit + contract suite" step is 514s against `timeout-minutes: 10` (600s) in `.github/workflows/unit-tests.yml:39`. One slow runner flakes it red.
- `cancel-in-progress` already exists on all three workflows. Do NOT add it.
- `ci-budget-guard.yml` already exists (account spend/artifacts). Extend it; do not add a second guard workflow.

## Owner decisions (click answers, 2026-11-17)
1. Profile per-spec timings first (Phone QA, E2E Smoke, unit suite). Put the numbers in the PR body.
2. Fix or split the dominant specs, then rebalance Phone QA shards by those timings.
3. Raise unit `timeout-minutes` to 15 now. Split the unit suite ONLY if contract tests are over ~200s in the profile; else leave it.
4. Add a wall-clock budget to `ci-budget-guard.yml` (not a new workflow). Read `scripts/check-script-conventions.mjs` six rules before writing any guard.
5. CI-only PRs (workflow/scripts changes) skip heavy steps but still run one phone spec and one build, so a broken workflow is caught in its own PR. Build on what #1746/#1751 did (`phone-qa.yml` skip conditions, the guard in `phone-qa.yml`); do not undo the #1751 guard.
6. No install caching (measured saving 20-30s, 10 GB cap risk).

## Rules
- CI/workflow files only plus test-config; no product code, no migrations.
- Source files over 2 KB: use `scripts/safe-edit.py` / `scripts/safe-write.py`.
- `npm run pre-ship`. Never pin check counts in prose.
- PR body: before/after timings per workflow, the profile table, "Verified on real data" block (not applicable: say so).
- Stopping rule: ONE `/code-review` round only if workflow-guard logic changed.
