# Brief: CI offload stage 3 (Website): one Acer runner for no-secret jobs, and a split of unit and e2e into hosted pieces

Brief-version: 1 (2026-11-05, website-18, for the lead). Branch: `claude/ci-offload-stage3` (Website). Lane: careful, HARD TIER (workflow files, runner credential): the lead sends the Approve, the owner does the one credential step. Model: Opus. Docs/brief only until the lead dispatches. One Website branch at a time (Vercel cap): every push in this arc carries `[skip preview]` and touches no `src/`.
Context, read first: `plans/PLAN-offload-chain-acer-dell-pc-2026-11-05.md` (owner decisions: cost FIRST, then speed; no new machine; pilot = ONE tiny job on the Acer for a week behind a load gate; no secret jobs), `plans/REPORT-offload-stage1-2026-11-05.md`, `plans/REPORT-offload-stage2-2026-11-05.md`.

## Goal (four lines)
1. Who: the owner and every PR author waiting on Website CI; the owner's GitHub bill.
2. After: low-risk Website jobs run on the Acer instead of GitHub hosted minutes, and the two long jobs (unit about 510 s, e2e about 954 s median) finish in a fraction of the time because they run as 3-4 parallel pieces.
3. Worked if: measured over a 7-day window against a 30-run baseline, median wall time of unit and e2e drops, hosted minutes billed per merged PR do NOT rise by more than the agreed ceiling (section "Decision rule"), no required check changes name, no new red that main did not have.
4. Limits: no secret ever reaches a self-hosted runner; no forks; no edits outside `.github/workflows/**`, `docs/**`, and the repo variable named below; Website pushes follow the Vercel cap; the admin repo is untouched.

## Facts measured so far (do not re-measure, only extend)
- Hosted medians (30 days, stage 1): unit London full 510 s (p90 655), e2e-smoke 954 s (p90 1490), phone-qa 1030, build-smoke 361, contract-check 111, bundle-budget 98, integrity 98, unit tz-sensitive x2 78. Queue wait about 2 s, so queueing is NOT the problem; minutes and wall time are. On #1400 the London unit leg took 10m33s hosted.
- By hand on the side laptops (stage 2, origin/main 0707a591, offline set, suite only, node_modules warm): Acer 302 s, Dell 318 s; cgroup memory.peak 2.64 GiB and 2.45 GiB (the 3 GB `remote-test` cap is tight; a runner needs 4 GB+). n=1 each, so re-run 3 times before relying on it.
- Admin already runs self-hosted (Acer 4 runners `laptop-ci-runner-1..4`, Dell 3 kept), healthy. The Website repo has NO runners.
- GitHub picks any idle runner carrying the label; "Acer first, Dell second" is not native. This brief uses ONE runner on the Acer only.

## Part A: register ONE Website runner on the Acer (pilot: bom-check only)
1. OWNER STEP (cannot be Claude's): create a registration token for repo `123constante/bachata-website` (Settings, Actions, Runners, New self-hosted runner) and hand it over through the usual private route. Claude never writes it into a brief, PR or chat. The Acer user `ci` has sudo, `offload` has none: the install runs as `ci`.
2. Runner: its own directory and its own systemd service, separate from the four admin runners, label EXACTLY `acer-web` (plus the default `self-hosted`), no other labels, runner group default, NOT ephemeral for the pilot. Memory cap 4 GB, CPU nice, one job at a time (`--disableupdate` is not needed). It runs under a dedicated unprivileged user (not `ci`, not `offload`), with no access to `~/.ssh`, `~/.claude` or the admin runners' directories. Record the exact unit file and the user in the handover.
3. Load gate: the Acer already refuses walks and tests when load or memory is high; the runner start script must apply the same gate (`SAFE_LOAD_MAX`, `SAFE_MEM_MIN`) and the shared lock `/tmp/laptop-walk.lock`, so a CI job and a walk never run together. State how in the handover and prove it by running both at once on purpose.
4. Routing without a commit per switch: jobs on the pilot read `runs-on: ${{ vars.WEB_RUNNER_LABEL || 'ubuntu-latest' }}`. The repo variable `WEB_RUNNER_LABEL` is unset today (all hosted). Setting it to `acer-web` routes the pilot jobs to the Acer; DELETING it sends them straight back to hosted with no push, no Vercel deploy and no review. This variable is the revert switch.
5. Eligibility table (worker produces it, reviewer re-derives it): for EVERY job in every workflow, columns: job, workflow, uses `secrets.*`? uses `GITHUB_TOKEN` with write permissions? runs on `pull_request_target`/`workflow_run`? runs fork PR code? checks out untrusted code? Eligible = no secrets, read-only token, not `pull_request_target`, and the condition `github.event.pull_request.head.repo.full_name == github.repository` holds (a FORK PR must never reach a self-hosted runner). Pilot = `bom-check` only (11 s, no secrets). The London unit leg is NOT eligible while its step uses `secrets.VITE_SUPABASE_*` (it falls back to a stub only when the live-DB gate says false); do not move it in this brief. List the next eligible jobs in the handover, in order of minutes saved, as the proposal for stage 4.
6. A job queued for a runner that is offline waits up to 24 h and blocks merges: before the first routed run, add `timeout-minutes` where missing and write the rule in the handover that Claude checks `gh api repos/123constante/bachata-website/actions/runners` (online/offline) before and after every day of the pilot, and deletes `WEB_RUNNER_LABEL` the moment the runner reads offline.

## Part B: split unit and e2e into 3-4 hosted pieces
Honest trade-off, stated first: every piece repeats checkout, `npm ci` (about 75 s) and, for e2e, the Playwright browser install, so N pieces bill about (N-1) extra overhead each run. The owner's priority is cost first, then speed, so Part B ships only if it passes the decision rule below. Measure before building the full change: run the split on a scratch branch (workflow dispatch, no merge) and compare.
1. Unit (London full leg only; the two tz legs stay as they are): `vitest run --shard=i/3` for i in 1..3 (vitest is 1.6.1, `--shard` is supported) for `npm run test:unit` / `test:unit:offline`, and the serial `test:unit:timing` pass runs in its own small piece or in shard 1 (it is 6 files, about 5 s). The live-DB gate decision stays ONE job whose output feeds all shards.
2. e2e: `playwright test --shard=i/4` over the explicit spec list in `package.json` (`test:e2e` is an explicit list, not a glob: keep it that way, the shard flag does not change which specs run), and the P3 walk specs (`test:e2e:p3`) as their own piece, so 4 pieces in total, balanced by the measured per-spec durations from the last green run (use `--shard` first; if the pieces differ by more than 25%, a hand-balanced list is the follow-up).
3. REQUIRED CHECK NAMES MUST NOT CHANGE. Today the required checks are a fixed set (no branch protection; the lead's audit lists them). Keep the existing job names (`unit (Europe/London, full)`, `e2e-smoke`) as a final aggregator job with `needs:` on the pieces and `if: always()` that fails if any piece failed or was cancelled, and passes only when all pieces passed. Prove by listing the check names on a branch before and after: identical.
4. Docs-only PRs: the existing `docs-only.mjs` skip must apply in every piece, and the aggregator still reports success.
5. Concurrency group, `timeout-minutes` and artifact upload keep working per piece (name artifacts per shard so they do not collide).

## Measurement (before, after, spend)
- Baseline (taken BEFORE any change, saved as `docs/handover/ci-offload-stage3-baseline.md`): for the last 30 completed runs per job (unit London full, e2e-smoke, bom-check, and the others in the eligibility table), median and p90 wall seconds and billed seconds, from `gh api repos/123constante/bachata-website/actions/runs/<id>/jobs` (started_at, completed_at, runner_name; billed = sum over hosted jobs of ceil(minutes) per job, Linux multiplier 1).
- After: the same table over the first 7 days of the change (at least 15 runs per job), same method, written to `docs/handover/ci-offload-stage3-result.md`.
- Monthly spend: Claude reads GitHub billing usage itself first (`gh api` on the account's Actions usage if the token scope allows) and states the figure and the date; if the API refuses, ONE owner read of Settings, Billing, Actions usage (a number, not a task). Compute: minutes saved per month = (baseline hosted minutes per merged PR minus after) x merged PRs per month (count from `gh pr list --state merged`). Report hosted minutes and the dollar figure at the plan's rate, before and after. Note the Vercel Pro upgrade is a separate bill and is NOT in this measurement.
- Flake rate: reruns and red-then-green on the same sha, before and after. A rise of more than 2 points is a fail.

## Decision rule (written before the numbers, so nobody argues after)
- Part A passes when bom-check on the Acer is green on at least 20 routed runs, runner offline time is zero while `WEB_RUNNER_LABEL` was set, and no routed job waited more than 60 s for a runner.
- Part B ships only if: median wall time of unit drops by at least 35% AND of e2e by at least 40%, AND hosted minutes per merged PR rise by no more than 25%. If the minutes rise more than 25% (cost comes first), do not ship the split; report the numbers and propose moving the eligible jobs to the Acer instead.
- Any required check name changing, any new red vs main, or any flake-rate rise over 2 points: revert.

## Revert rule (all three are one step each)
1. Runner switch: delete the repo variable `WEB_RUNNER_LABEL` (Claude may do this the moment the runner is offline or a routed job misbehaves, no approval needed, log it). Jobs return to `ubuntu-latest`.
2. Workflow change: ONE `git revert` of the squash-merge commit of the PR, `[skip preview]`, lead approves. The runner service is then `systemctl disable --now` on the Acer and the runner removed in GitHub settings (owner click, or `config.sh remove` with a removal token).
3. Automatic trigger: at the end of the 7-day window the worker's result file ends with PASS or REVERT against the decision rule; REVERT means steps 1 and 2 the same day.

## Do not touch
`src/**`, `supabase/**`, `vite.config.ts`, `perf-budgets.json`, any workflow outside the ones named in the eligibility table and the two split ones, admin repo workflows, the admin runners, Vercel settings. The workflow allow-list guard (PR #1394, hard tier) must be merged first, or the worker names every workflow file it touches in the PR body so the guard can be told.

## Verification (all required before DONE)
- Eligibility table complete and re-derived by an independent reviewer (grep every `secrets.` and `pull_request_target` in `.github/workflows`).
- Dry run proof of the revert: set then delete `WEB_RUNNER_LABEL` on a scratch branch run and show the job moving to the Acer and back to hosted.
- Per-job CI table in the PR body; the PR's own checks green; `workflow-lint` jobs (no-preview-reason, workflow-masking, workflow-notification) green.
- Required-check names before and after, identical, listed.
- Baseline and after files committed; the verdict line PASS or REVERT.
- A "Verified / Not verified" block, honest about n (the pilot window is 7 days).

## Stop and handover
Push once per step (A, then baseline, then B), `[skip preview]`, `[worker-done <ticket>]` on the last commit, handover `docs/handover/ci-offload-stage3.md` with the exact runner unit, the user, the label, the variable, and what is left. At 40% context stop with PARTIAL and a "what is left" list. The owner does the registration token step and, if billing needs a read, one number.
