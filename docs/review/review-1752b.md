# Review 1752b: PR #1752 (ci-speed) at ce2a99df5, hard tier

Scope: `git diff d239b93ff ce2a99df5 -- .github scripts/check-phone-qa-skip.mjs`, run in a worktree at ce2a99df5.
(Whole-file yml diff is line-ending noise; `--ignore-space-at-eol` shows the real delta: +1 guard step, +1 TARGETS line.)

## Verdict: BLOCK — the new guard is red on the real file

### 1. Merge resolution — OK
Both blocks present in job `phone-qa`, order valid: `changes` -> `Decide the phone-suite mode` (id: mode) -> guard step -> Setup Node (gated `steps.mode.outputs.run`). `scripts/prove-entry-point-dispatch.mjs` TARGETS has the new script.

### 2. check-phone-qa-skip.mjs — FAILS on the real file
- `node scripts/check-phone-qa-skip.mjs` -> rc=1: `wallclock-budget: S1 no "id: changes" step running docs-only.mjs`.
- `--self-test` -> rc=1: `self-test: real file already red`.
- Cause: round 1's d239b93 added job `wallclock-budget` (setup-node, no `changes` step) to phone-qa.yml. The guard (written against main, which has no such job) walks every job; HEAVY matches `actions/setup-node`, so S1 fires. The guard step runs in every phone-qa shard, so all 3 shards (and the required check) go red on every run of this PR.
- Fix options: exempt jobs with no `docs-only.mjs` step from S1 (only guard the job that has `id: changes`), or name wallclock-budget in an allowlist. Then re-run both commands.

Mutants (checked on phone-qa job only, ignoring the wallclock failure):
- (a) npm ci ungated: refused (S2). (b) npm ci gated on `github.event_name == 'push'`: refused (S2). (c) `id: mode` no longer reads `steps.changes.outputs.e2e_skip`: refused (S3).
- (d) SURVIVES: `if: always() # steps.mode.outputs.run` on npm ci: SKIP_IF matches the comment text, no refusal. Minor: strip `#` comments before matching.
- Self-test only covers mutant (a); (b)/(c) are unpinned by the canary (S3 is not named in a self-test case).

### 3. Mode step / round-1 items — OK
Fail-safe intact: missing `E2E_SKIP`/`CI_LIGHT` -> `mode=full`, `run=true`. ci_light beats skip as designed. No other round-1 delta in .github or scripts beyond the items above.

### CI at head
Not looked up: `gh` is not available in this sandbox and the GitHub API is out of scope, so `gh pr checks 1752` was NOT run. By the above, phone-qa (1/2/3) must be red at ce2a99df5 once it queues.

## Hard-tier: BLOCK
