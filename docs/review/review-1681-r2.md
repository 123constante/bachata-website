# Review: PR #1681 (Website) -- install merge-tier workflows, flag off (round 2)

Repo 123constante/bachata-website. PR #1681, branch `claude/install-merge-tier-workflows`,
head d8fbc35ecf656c5aab809c6411d1cb8379a03204.
Independent review, second round. No product code edited. Brief: `docs/briefs/review-1681-r2.md`.
Scope: the seven checks in the brief. The slice-4 follow-ups (guard-paths.json, money-set
widening, pull_request_target hardening, revert-on-red GITHUB_TOKEN perms) are out of scope and
are only named where a finding touches them.

## Verdict: PASS WITH NITS

## Hard-tier: PASS

Nothing in the PR can arm, push, open a PR, comment or revert while `MERGE_TIERS_ENABLED` is unset
or not `'true'`; the pause switch fails closed in both workflows; no PR text reaches a shell; no
secret is reachable from a fork; the proposals are byte-identical to the installed copies; the two
guard edits add dated grandfather entries and re-derive a measurement, nothing looser. Tests green.

## Findings

### 1. Flag off: no write path (PASS)

- `auto-merge-on-open.yml` has ONE job, `arm`. Its `if` (lines 35-39) requires
  `vars.MERGE_TIERS_ENABLED == 'true'` AND author `kiki-claude-bot` AND same-repo head AND not a
  `claude/revert-*` branch. Flag unset or any other value: the job is skipped, so no step runs, so
  neither `gh pr merge --auto` (line 93) nor `--disable-auto` (line 103) can execute.
- `revert-on-red.yml` has ONE job, `revert`. Its `if` (lines 56-62) requires the same flag for
  BOTH trigger kinds (`workflow_run` and `workflow_dispatch`); without it, no checkout, no
  `git push`, no `gh pr create`, no `gh pr comment`, no `gh issue create` (lines 142-160).
- There is no job-level or step-level `permissions:` widening and no second job in either file.
- With the flag ON (not this PR's state) the arming step is also guarded by tier B/C, the
  tier-B self-review, and the pause switch; the revert step by `decide`, dry-run, pause and tier.

### 2. Pause switch (PASS)

- Reader step in both files: `run: node scripts/automation-pause.mjs` with
  `GH_TOKEN: ${{ github.token }}`, `continue-on-error: true` (auto-merge lines 80-86, revert
  lines 115-121). Both run from a trusted checkout (base sha / main), never PR code.
- Fail closed, three ways checked in `scripts/automation-pause.mjs` + `scripts/lib/automation-pause.mjs`:
  (a) paused (label, missing issue, ambiguous issue, closed issue, read error) -> emits
  `paused=true` to `$GITHUB_OUTPUT` then exits 3; (b) crash before `emit` -> no output at all;
  (c) step missing/erroring -> empty output. In every case `steps.pause.outputs.paused == 'false'`
  is false, and ONLY that positive string lets the arm step (line 88) or the open-revert step
  (line 136) run.
- Reader placement: auto-merge -> after classify/self-review, before the only two write steps.
  Revert -> after the read-only `decide`, before `tier`, dry-run and the write step. No write
  precedes a reader in either job.
- Disable step when paused (auto-merge line 95): `always() && !(<the arm condition>)`, where the
  arm condition includes the pause clause, so PAUSED routes to the disable step, which calls
  `gh pr merge --disable-auto` only when the PR is already armed. That is the protective
  direction (same as `automation-pause-guard.yml`), so it is safe while paused. It cannot arm.
- Dry run on revert (line 131) is unaffected by pause and performs no write: correct.

### 3. Untrusted input (PASS)

- `auto-merge-on-open.yml`: PR body goes through `env: BODY` (line 70), PR number and tip sha
  through `env: PR`/`HEAD` (lines 91-92, 98), then `"$PR"`/`"$HEAD"` quoted in bash. The branch
  name appears only in an `if:` expression (`startsWith`, line 39), never in `run:`. PR file
  patches land in `pr-files.json` as data read by `classifyTier`; nothing is `eval`ed.
- Checkout is `ref: ${{ github.event.pull_request.base.sha }}` with `persist-credentials: false`
  (lines 43-46): the classifier and the pause reader run from the BASE commit. The PR's own
  `scripts/lib/merge-tier.mjs` is never executed.
- `revert-on-red.yml`: `SHA` is validated `^[0-9a-f]{40}$` (line 86) before use. Commit message
  and `pr.head.ref` are only regex-tested inside github-script (lines 88, 92). `BRANCH` is derived
  from the sha. `FAILED_WORKFLOW` is a workflow NAME from main's own definitions. No PR title,
  body or branch name reaches `run:`. Checkout is `ref: main` (line 73) so only main code runs.
- NOTE (not a block, named in the register): `auto-merge-on-open.yml` is `pull_request`-triggered,
  so a same-repo branch can edit the workflow DEFINITION itself (including the flag `if`) and that
  copy runs with repo secrets. The flag therefore protects the committed definition, not a
  branch's rewrite of it. This is the identical, already-accepted exposure of `bot-pr.yml`, and
  the PR records it as a dated `untrusted_trigger_grandfathered` entry. The slice-4
  `pull_request_target` hardening closes it. See nit N1.

### 4. Token permissions and fork exposure (PASS, one known follow-up)

- `auto-merge-on-open.yml` workflow permissions: `contents: read, pull-requests: read,
  issues: read` (lines 24-27). `issues: read` is needed by the pause reader. Writes use
  `secrets.BOT_PR_TOKEN`, which GitHub withholds from fork `pull_request` runs, and the job `if`
  additionally requires `head.repo.full_name == github.repository`.
- `revert-on-red.yml`: `workflow_run` and `workflow_dispatch` are not fork-reachable, and the
  job `if` also pins `head_repository.full_name == github.repository`. Workflow-level
  `contents/pull-requests/issues: write` on GITHUB_TOKEN is wider than the job uses (it writes
  with BOT_PR_TOKEN; github.token only reads the pause issue and the PR/commit APIs). Known,
  tracked as slice 4 ("revert-on-red token perms"); not re-raised as a finding.
- Checkout on revert passes `token: ${{ secrets.BOT_PR_TOKEN }}` (line 75) with default
  `persist-credentials`, which is what the later `git push` needs; every step in that job runs
  main's code, so no untrusted code can read it.

### 5. Proposals byte-identical (PASS)

`diff` of `docs/proposals/<x>.yml` against `.github/workflows/<x>.yml` at the reviewed commit:
no output for both. md5 `008ba552a674881287013c4de068fbb8` (auto-merge-on-open, both copies)
and `5e2340383bb3610201ad0e6e3d0d8e41` (revert-on-red, both copies).

### 6. Register and policy-script edits (PASS, one wording nit)

- `.github/automation/secrets-register.json`: BOT_PR_TOKEN `readers_allowed` gains the two
  workflow names; `grandfathered` gains two entries dated `2026-11-16` with reasons;
  `untrusted_trigger_grandfathered` gains `auto-merge-on-open.yml` dated `2026-11-16`. No entry
  removed, no reason shortened, `bot-pr.yml` text unchanged. `revert-on-red.yml` correctly gets no
  untrusted-trigger entry (workflow_run / dispatch are trusted triggers in
  `check-secrets-register.mjs`). `node scripts/check-secrets-register.mjs` at the reviewed commit:
  `OK -- 48 workflows, 73 jobs, 24 secret(s) read, 29 register entries`.
- `scripts/check-workflow-artifact-policy.mjs`: only two numbers change, `MEASURED.workflowFiles`
  38 -> 48 (re-derivation; the guard itself reports 48) and `FLOORS.workflowFiles` 20 -> 30, with
  the band arithmetic written beside it ([24, 46], 30 inside, off both ends). No allowlist entry,
  no exception, no detector change. `node scripts/check-workflow-artifact-policy.mjs` at the
  reviewed commit: passed, detector alive, 73 of 73 jobs and 467 of 467 steps walked.
- `tests/automationRegister.test.ts`: date regex widened to `1[36]` (adds 2026-11-16) and the
  expected grandfathered key list gains exactly the two new names. Fine.

### 7. Tests (PASS)

`npx vitest run tests/automationPauseWorkflows.test.ts tests/automationRegister.test.ts` in a
worktree of the reviewed commit: 2 files, 104 tests passed (23 + 81), 0 failed.

## Nits (none blocking while the flag is off)

- N1. Register wording: the `untrusted_trigger_grandfathered["auto-merge-on-open.yml"]` reason
  says "checks out the base sha only and runs the classifier from there (as bot-automerge.yml)".
  `bot-automerge.yml` is `pull_request_target` with `ref: main`, so it does NOT share this
  exposure; the correct analogue is `bot-pr.yml`, which the same sentence also names. Reword when
  slice 4 moves this workflow to `pull_request_target`, which would also let the entry be deleted.
- N2. `tests/automationPauseWorkflows.test.ts` CONSUMERS does not list the two new workflows, so
  only the completeness test ("a reader exists somewhere") covers them. The structural
  assertions (reader before every write step, `github.token`, `continue-on-error`, the write
  `if` depends on the nearest reader, checkout before reader) were verified by hand above, not by
  the test. The spec's `checkout ref must be main` would need a `base.sha` variant for
  `auto-merge-on-open.yml`. Suggest adding both entries in slice 4.
- N3. `MEASURED.jobs` 60 / `steps` 389 stay as before while the guard now measures 73 / 467; the
  guard says they are inside the drift band, so this is allowed, and the comment says so. Noted
  only so the next re-derivation is not surprised.

## How this was checked

Plain git fetch of the PR branch; `git diff` of merge-base `288edd2` to the reviewed commit
(7 files, +299/-8). Both workflow files read in full with line numbers. `scripts/automation-pause.mjs`
and `scripts/lib/automation-pause.mjs` read for the fail-closed paths. The `workflow_run.workflows`
list was cross-checked against the `name:` of every workflow on main (all 8 names exist).
Commands run in a worktree at the reviewed commit: the two vitest files, `check-secrets-register.mjs`,
`check-workflow-artifact-policy.mjs`.

Not verified: no live run of either workflow (flag is off; a dry-run `workflow_dispatch` needs
the flag on, which is the owner's call). Earlier commits of this PR (fbdd018, 6a1bc9e and the
others in the branch log) were not re-reviewed individually; only the final tree was.
