# CI offload stage 3 -- baseline (taken 2026-11-05, before any change)

Read-only snapshot of GitHub Actions timing and hosted billed minutes for
123constante/bachata-website. Nothing was triggered, rerun or cancelled.

## Method

- Data source: GitHub REST API, read-only GET only, using `curl` (30 s timeout per
  call) driven from a small node script in the session scratchpad. The GitHub MCP
  `actions_list` tool was tried first and works, but each run returns about 1 KB
  of JSON into the transcript, so the bulk pull used the same endpoints via curl.
  `gh` / `gh api` were NOT used.
- Endpoints:
  - `GET /actions/workflows/{file}/runs?event=pull_request&status=completed&per_page=N`
  - `GET /actions/workflows/{file}/runs?event=push&branch=main&status=completed&per_page=10`
    (unit-tests, e2e-smoke, workflow-lint only)
  - `GET /actions/runs/{id}/jobs?per_page=100&filter=latest` (job stats)
  - `GET /actions/runs?head_sha={sha}&per_page=100` then jobs with `filter=all`
    (per-PR totals, so every attempt is counted)
  - `GET /pulls?state=closed&sort=updated&direction=desc&per_page=100` (pages 1-10)
- Sample: last 30 completed `pull_request` runs of unit-tests.yml, e2e-smoke.yml,
  workflow-lint.yml; last 15 of phone-qa.yml, db-contract-check.yml,
  typecheck.yml, architecture-guard.yml, perf-budget.yml. 165 PR runs total,
  run ids 42067755093 .. 42126224956, run_started_at 2026-11-05T16:45Z ..
  2026-11-05T23:00Z (this repo runs enough PRs that 30 runs is about 6 hours).
  Plus 30 push-to-main runs (10 per workflow), from 2026-11-05T16:38Z.
- Quirk: for perf-budget.yml, `status=completed` returned stale runs from
  2026-10-11 (ids 381xxxxxxxx). Re-pulled without the status filter and kept the
  first 15 completed runs (ids 42082851395 .. 42126224956). The other seven
  workflows' filtered results were all from 2026-11-05 and are current.
- Wall seconds = job `completed_at - started_at`. Wall stats EXCLUDE jobs whose
  conclusion is skipped or cancelled; n counts them, and the number excluded is
  shown in brackets. Billed minutes = ceil(wall/60) per job, Linux multiplier 1;
  skipped jobs = 0; self-hosted jobs would be 0 but there are none (every job
  label seen is `ubuntu-latest`, runner names are `GitHub Actions N`).
- p90 is linear-interpolated. Medians of billed minutes can be x.5 when n is even.

## Per-job table (pull_request, latest attempt)

| job | workflow | n (excluded) | median s | p90 s | median billed min | runner |
|---|---|---|---|---|---|---|
| unit (Europe/London, full) | unit-tests.yml | 29 (5) | 561 | 652 | 10 | ubuntu-latest, hosted |
| unit (America/New_York, tz-sensitive) | unit-tests.yml | 29 (1) | 77 | 83 | 2 | ubuntu-latest, hosted |
| unit (Australia/Sydney, tz-sensitive) | unit-tests.yml | 29 (1) | 75 | 83 | 2 | ubuntu-latest, hosted |
| dancer-area-isolation | unit-tests.yml | 29 (1) | 18 | 28 | 1 | ubuntu-latest, hosted |
| e2e-smoke | e2e-smoke.yml | 28 (7) | 1012 | 1375 | 17 | ubuntu-latest, hosted |
| notification-check | workflow-lint.yml | 30 (2) | 74 | 79 | 2 | ubuntu-latest, hosted |
| bom-check | workflow-lint.yml | 30 (0) | 11 | 17 | 1 | ubuntu-latest, hosted |
| masking-check | workflow-lint.yml | 30 (0) | 14 | 22 | 1 | ubuntu-latest, hosted |
| phone-qa | phone-qa.yml | 14 (5) | 1163 | 1225 | 20 | ubuntu-latest, hosted |
| build-smoke | phone-qa.yml | 14 (4) | 342 | 446 | 6.5 | ubuntu-latest, hosted |
| contract-check | db-contract-check.yml | 15 (4) | 107 | 117 | 2 | ubuntu-latest, hosted |
| live-db-gate | db-contract-check.yml | 15 (0) | 14 | 20 | 1 | ubuntu-latest, hosted |
| wallclock-brand | typecheck.yml | 15 (0) | 114 | 123 | 2 | ubuntu-latest, hosted |
| integrity | architecture-guard.yml | 15 (0) | 102 | 113 | 2 | ubuntu-latest, hosted |
| bundle-budget | perf-budget.yml | 15 (1) | 102 | 120 | 2 | ubuntu-latest, hosted |
| no-preview-reason | perf-budget.yml | 15 (0) | 3 | 4 | 1 | ubuntu-latest, hosted |
| lighthouse | perf-budget.yml | 15 (15) | - | - | - | all skipped on PRs |
| doc-weight | perf-budget.yml | 15 (15) | - | - | - | all skipped on PRs |

Note: unit-tests and e2e-smoke n is 29/28 rather than 30 because some runs have
no such job (job never created, e.g. workflow-level skip); phone-qa 14 of 15
likewise.

### Push to main (latest attempt, n = 10 runs per workflow, none excluded)

| job | workflow | n | median s | p90 s | median billed min |
|---|---|---|---|---|---|
| unit (Europe/London, full) | unit-tests.yml | 10 | 509 | 657 | 9 |
| unit (America/New_York, tz-sensitive) | unit-tests.yml | 10 | 77 | 80 | 2 |
| unit (Australia/Sydney, tz-sensitive) | unit-tests.yml | 10 | 77 | 87 | 2 |
| dancer-area-isolation | unit-tests.yml | 10 | 21 | 35 | 1 |
| e2e-smoke | e2e-smoke.yml | 10 | 1037 | 1130 | 18 |
| notification-check | workflow-lint.yml | 10 | 67 | 79 | 2 |
| bom-check | workflow-lint.yml | 10 | 11 | 16 | 1 |
| masking-check | workflow-lint.yml | 10 | 14 | 19 | 1 |

## Hosted billed minutes per PR run set

For the 8 most recently merged PRs: every workflow run whose head_sha is the PR's
FINAL head sha (all workflows and events: pull_request, pull_request_target,
push), every job of every attempt, sum of ceil(wall/60). Skipped jobs = 0.

| PR | merged_at (UTC) | final head sha | runs | jobs (all attempts) | jobs skipped | runs with attempt > 1 | billed min | top workflows (min) |
|---|---|---|---|---|---|---|---|---|
| #1401 | 2026-11-05 22:53 | 007e6ae | 18 | 33 | 10 | 0 | 24 | Workflow Lint 4; Unit & Contract Tests 4; Bot auto-merge 2 |
| #1399 | 2026-11-05 22:45 | a6e1312 | 22 | 41 | 12 | 0 | 84 | Phone QA 23; E2E Smoke 18; Unit & Contract Tests 16 |
| #1400 | 2026-11-05 22:20 | 06d7339 | 18 | 33 | 9 | 0 | 60 | E2E Smoke 21; Unit & Contract Tests 15; Perf Budget 4 |
| #1398 | 2026-11-05 20:26 | d2986d7 | 18 | 37 | 10 | 1 | 71 | Unit & Contract Tests 32; E2E Smoke 16; Workflow Lint 4 |
| #1389 | 2026-11-05 20:07 | fa266ea | 19 | 35 | 9 | 0 | 76 | Phone QA 25; Unit & Contract Tests 14; E2E Smoke 13 |
| #1397 | 2026-11-05 19:11 | 90e2fd6 | 18 | 33 | 10 | 0 | 55 | E2E Smoke 17; Unit & Contract Tests 15; Perf Budget 4 |
| #1392 | 2026-11-05 18:00 | 73634ec | 29 | 59 | 19 | 0 | 111 | E2E Smoke 41; Unit & Contract Tests 31; Workflow Lint 8 |
| #1391 | 2026-11-05 18:00 | efb44f0 | 15 | 30 | 10 | 0 | 45 | E2E Smoke 14; Unit & Contract Tests 12; Workflow Lint 4 |

- **Median 65.5 billed min per PR** (mean 65.75, min 24, max 111, n = 8).
- #1401 (24 min) is a docs-only PR: e2e/unit London did not run in full.
- #1392 ran every workflow twice on the same sha (two run batches, 17:37Z and
  18:02Z), which is why it is the max; #1398's Unit & Contract Tests total (32)
  includes a second attempt.
- Runs per sha were 15-29; workflows seen include phone-qa-section,
  real-data-verified, Bot auto-merge (pull_request_target), Dependabot
  auto-merge, Synthetic SSR Monitor, OG Image Guard, SEO Guard and Bot PR for
  cloud branches (push), each typically 1-2 min.

## Merged PRs in the last 30 days

- **460 PRs merged** with merged_at in 2026-10-06 .. 2026-11-05 (459 into main).
  Count is complete: the closed-PR listing was paged back to updated_at
  2026-08-07. Busiest days: 2026-10-30 (79), 2026-11-04 (41), 2026-11-05 (34 so
  far), 2026-10-06 (32).
- Rough extrapolation, labelled as such: 460 x 65.5 = about 30,100 hosted
  minutes per 30 days for final-sha PR run sets alone. This undercounts: it
  ignores runs on earlier (non-final) pushes to each PR and push-to-main runs.

## Reruns / flake signal

- 2 of the 165 collected pull_request runs had run_attempt > 1, both
  unit-tests.yml (run ids 42099038890 and 42073066371, attempt 2).
- 0 of the 30 push-to-main runs had run_attempt > 1.
- In the per-PR sample, 1 of 8 PRs (#1398) had a run with attempt > 1.

## Not measured

- Billed minutes are computed (ceil(wall/60) per job), not read from GitHub's
  billing/usage API (`get_workflow_run_usage` / `/timing` not called). GitHub's
  own rounding should match per job but was not cross-checked.
- Queue time (created_at -> started_at) was not analysed; only job wall time.
- Runs on non-final shas of each PR (every earlier push) are not in the per-PR
  totals, so the per-PR figure is a lower bound on the true cost of a PR.
- Push-to-main runs were sampled only for unit-tests, e2e-smoke, workflow-lint
  (10 each); push-to-main cost per merge is not summed.
- Scheduled / workflow_dispatch / hourly guard runs (e.g. pr-mergeable-guard)
  are not measured.
- The sample window is about 6 hours on one day (2026-11-05); runner
  performance on other days is not represented.
- Step-level timings (which step inside unit London / e2e-smoke dominates) were
  not collected.
- Per-PR set is 8 PRs, all merged on 2026-11-05.
