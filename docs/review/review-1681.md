# Review: PR #1681 (Website) -- install merge-tier workflows, flag off

- PR: 123constante/bachata-website #1681, branch `claude/install-merge-tier-workflows`
- Reviewed at head d8fbc35ecf656c5aab809c6411d1cb8379a03204 (merge-base with main: 288edd2)
- Reviewer: independent cloud worker, review only, no product code edited
- Ticket: dispatch-ticket dt_aeabdb00db7e; brief `docs/briefs/review-1681.md` (sha 91def56)
- Round 1 (head 8fcc12be) was PASS WITH NITS. This is round 2: the pause-switch reader was added to both workflows.
- Out of scope (slice 4, per brief): guard-paths.json additions, money-set widening, pull_request_target hardening, revert-on-red token perms.

## Verdict: PASS WITH NITS

## Hard-tier: PASS

Hard-tier reasoning: the PR touches no product code, no `supabase/migrations`, no SQL, no money
path and no RPC/ACL. It adds two workflow files (a guard path, so tier A = owner Approve, which
is exactly the gate this review feeds), a register entry, a floor/measurement bump in one guard
script and one widened test regex. With `MERGE_TIERS_ENABLED` unset both jobs are skipped at the
job `if`, so merging the PR changes nothing that runs.

## Files in the PR (7)

```
.github/automation/secrets-register.json   |   7 +-
.github/workflows/auto-merge-on-open.yml   | 103 +
.github/workflows/revert-on-red.yml        | 160 +
docs/proposals/auto-merge-on-open.yml      |  14 +-
docs/proposals/revert-on-red.yml           |  11 +-
scripts/check-workflow-artifact-policy.mjs |   8 +-
tests/automationRegister.test.ts           |   4 +-
```

## Findings, by brief item

### 1. Flag off: can either workflow act? -- NO

- `auto-merge-on-open.yml:35-39`: the only job `arm` has a job-level `if` whose first clause is
  `vars.MERGE_TIERS_ENABLED == 'true'`. Unset or any value other than the exact string `true`
  evaluates false; the whole job (every step, including both `gh pr merge` calls at lines 93 and
  103) is skipped. No step outside the job exists.
- `revert-on-red.yml:56-62`: the only job `revert` has the same first clause. The checkout with
  `BOT_PR_TOKEN` (line 71-75), the `git push` (156), `gh pr create` (158), `gh pr comment` (159)
  and both `gh issue create` (146, 160) are all inside that job.
- Both files also gate the write steps a second time: arm needs tier B/C + self-review + pause
  positively `false` (line 88); revert needs decide=true + not dry-run + pause `false` + tier B/C
  (line 136).
- `scripts/lib/merge-tier.mjs:76-78` `mergeTiersEnabled` matches the workflow semantics (exact
  string `true`), so the library and YAML agree.

### 2. Pause switch: fail closed? -- YES

- Reader: `scripts/automation-pause.mjs` (on main; the workflows run it from a trusted checkout,
  base sha / main, never PR code). `main()` returns 3 on paused and on every error path
  (lines 68-71, 74-78); `readPause` in `scripts/lib/automation-pause.mjs:125-136` returns
  `paused: true` for missing issue, ambiguous issue, closed issue, label present, and any thrown
  error. It writes `paused=true|false` to `$GITHUB_OUTPUT` (line 26).
- Consumers only act on `steps.pause.outputs.paused == 'false'` (auto-merge:88, revert:136). If
  the reader step fails outright or the script is missing, the output is empty, the comparison is
  false, and the write step is skipped. `continue-on-error: true` (auto-merge:83, revert:118)
  keeps a pause from being a red run while still never producing a positive `false`.
- Disable step when paused (`auto-merge-on-open.yml:94-103`): its `if` is
  `always() && !(arm condition)`, so a pause (or a failed reader) routes to the disable path, which
  only runs `gh pr merge --disable-auto` when the event payload says auto-merge is already armed
  (`ARMED`, line 100). That removes an earlier arming rather than adding one: conservative and
  safe. `always()` also means a failed checkout/classifier still disarms (round-1 follow-up
  "disable step if: always()" is therefore already done in this round).
- `tests/automationPauseWorkflows.test.ts` completeness check: both new workflows are consumers
  with a reader (not on EXEMPT) and the structure test requires the write step to depend on the
  nearest reader's `paused == 'false'`. Passes (see item 7).

### 3. Untrusted input -- clean

- PR body is passed via `env: BODY` (auto-merge:69-70) and read with `process.env.BODY` (75);
  never interpolated into `run:`. PR number and head sha are env too (91-92, 98).
- No `github.event.pull_request.title` or `head.ref` appears in any `run:` in either file;
  `head.ref` is used only in the job `if` (auto-merge:39) and the API `pr.head.ref` only inside
  github-script (revert:92), both as data.
- revert-on-red: `SHA` (env, line 66) is validated as a 40-hex sha before any use
  (`decide` script line 86); `BRANCH` is derived from it (104-105); `TIER` comes from the
  classifier; `FAILED_WORKFLOW`/`FAILED_RUN` come from the `workflow_run` payload of a push to
  main (workflow names from main's own files) and are only expanded inside double-quoted bash
  env vars (147-148, 157-160). `workflow_dispatch` `inputs.sha` goes through the same regex.
- Code executed: auto-merge checks out `base.sha` with `persist-credentials: false` (43-46), so
  PR head code is never run and the read-only `GITHUB_TOKEN` is not left in `.git`. revert-on-red
  checks out `main` (73) with `BOT_PR_TOKEN` (75) so it can push the revert branch; it never
  checks out the merged PR's head. The classifier and the pause reader are therefore always the
  trusted copies.
- Acknowledged, not fixed here: a same-repo bot PR runs the `pull_request` workflow DEFINITION from
  its merge ref, so a branch pushed with a workflow-scoped credential could edit
  `auto-merge-on-open.yml` itself. The register records this as the same accepted exposure as
  `bot-pr.yml` (`secrets-register.json` `untrusted_trigger_grandfathered`), and
  `pull_request_target` hardening is slice 4.

### 4. Token permissions / fork exposure

- auto-merge-on-open: `GITHUB_TOKEN` is `contents: read`, `pull-requests: read`, `issues: read`
  (24-27; `issues: read` is new, for the pause reader). All writes use `secrets.BOT_PR_TOKEN`.
  Trigger is `pull_request` (not `_target`), so a fork PR gets no secrets at all, and the job `if`
  additionally requires `head.repo.full_name == github.repository` (38) and author
  `kiki-claude-bot` (37). No fork exposure.
- revert-on-red: `GITHUB_TOKEN` is `contents: write`, `pull-requests: write`, `issues: write`
  (45-48), yet every write in the file uses `BOT_PR_TOKEN` (75, 138) and the two `github.token`
  uses (decide script, pause reader at 120) only read. **NIT (tracked as slice 4 "revert-on-red
  token perms"):** these three could be `read`. `workflow_run` on `branches: [main]` cannot be
  fired by a fork; the job also checks `head_repository.full_name == github.repository` (62).
- `concurrency` (auto-merge:29-31 per PR, cancel; revert:50-52 per sha, no cancel) is correct for
  the one-revert-per-commit rule.

### 5. Proposals byte-identical to installed copies -- YES

```
cmp docs/proposals/auto-merge-on-open.yml .github/workflows/auto-merge-on-open.yml  -> identical (md5 008ba552...)
cmp docs/proposals/revert-on-red.yml      .github/workflows/revert-on-red.yml       -> identical (md5 5e234038...)
```

### 6. Register + artifact-policy guard -- correct, no loosening beyond the two entries

- `secrets-register.json`: `BOT_PR_TOKEN` `readers_allowed` gains the two files; `grandfathered`
  gains two entries dated `2026-11-16`, each naming PR #1681, the flag, what the token does and
  "owner review"; `untrusted_trigger_grandfathered` gains one entry for `auto-merge-on-open.yml`
  (pull_request) with the exposure spelled out. `revert-on-red.yml` is not listed there, which is
  right: `workflow_run` + `workflow_dispatch` are not untrusted triggers.
- `tests/automationRegister.test.ts:80`: the date regex widens from `2026-11-(0[45]|13)` to
  `2026-11-(0[45]|1[36])` (adds only the 16th); line 82 pins the exact grandfathered key set
  including the two new files, so a third undocumented reader would still go red.
- `scripts/check-workflow-artifact-policy.mjs`: `FLOORS.workflowFiles` 20 -> 30 and
  `MEASURED.workflowFiles` 38 -> 48, with dated comments. Band check: measured 48 -> pinned band
  [24, 46]; 30 is inside and off both ends. Nothing else in the guard changed. Run on the head:
  passes, "measured 48 workflow file(s), 73 job(s), 467 step(s)".
  **NIT:** the new comment says "only workflowFiles was reported stale, the rest is unchanged",
  but `MEASURED.jobs: 60` / `steps: 389` are now 73 / 467 on main. The guard's drift band still
  passes, so this is a stale-comment nit, not a defect.

### 7. Tests on a checkout of head d8fbc35

```
npx vitest run tests/automationPauseWorkflows.test.ts tests/automationRegister.test.ts
  tests/automationPauseWorkflows.test.ts  (23 tests)  passed
  tests/automationRegister.test.ts        (81 tests)  passed
  Test Files 2 passed (2) / Tests 104 passed (104)
node scripts/check-workflow-artifact-policy.mjs    -> exit 0 (passed)
YAML parse of both installed workflows             -> ok
```

### Other checks made

- `workflow_run.workflows` list (revert:24-32): all eight names resolve to a workflow on main
  whose trigger includes `push: branches: [main, ...]` (architecture-guard, bom-check,
  db-contract-check, e2e-smoke, perf-budget, typecheck, unit-tests, workflow-lint). No silent
  name mismatch.
- The scripts the workflows run (`scripts/lib/merge-tier.mjs` and its three imports,
  `scripts/automation-pause.mjs`, `scripts/lib/automation-pause.mjs`, `scripts/lib/entry-point.mjs`)
  import only `node:` built-ins and sibling files, so the absence of an `npm ci` step is correct.
- `classifyTier([])` returns `'A'` (`merge-tier.mjs:65`): a missing or capped file list (API cap
  3000, auto-merge:56, revert:101) degrades to "owner Approve / never revert".
- `hasSelfReview` (`merge-tier.mjs:86-100`) rejects empty, comment-only and placeholder bodies.
- Dry-run default `true` on `workflow_dispatch` (revert:40-43, 67, 130-134) stops before any write.

## Nits (none blocking; the flag is off)

1. revert-on-red `permissions` are write x3 while every write uses `BOT_PR_TOKEN`; could be read
   x3 (slice 4, already tracked).
2. `check-workflow-artifact-policy.mjs` MEASURED comment claims jobs/steps unchanged; they are
   60/389 vs 73/467 live. Harmless (guard green), fix the comment or re-derive when next touched.
3. When paused, revert-on-red skips the revert with only the reader's `::notice`; no owner-turn
   issue says "red main left unreverted because paused". Acceptable since only the owner sets the
   pause, but worth a line in docs/automation-pause.md.
4. The `pull_request` workflow-definition exposure (item 3) is accepted in the register, not fixed.

## Verified / Not verified

- Verified: job-level flag gate in both files; pause fail-closed path in reader and consumers;
  env indirection for all PR-derived strings; checkout refs and tokens; byte identity of
  proposals; register/test/guard diffs; 104 vitest tests and the artifact-policy guard on head.
- Not verified: a live run of either workflow (the flag is off and the brief forbids enabling
  it); `actionlint` (not installed in this sandbox; Workflow Lint runs on the PR); no Supabase or
  browser walk (docs/CI-only change, nothing user-facing).
