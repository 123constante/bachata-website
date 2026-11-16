# Review: PR #1726 (Website) -- merge-tier slice 4b, harden auto-merge-on-open and revert-on-red, flag off

Repo 123constante/bachata-website. PR #1726, branch `claude/merge-tier-slice4b`,
head 80c2fac5f773afde54c7523a35d46fea8f7f7e5c.
Independent review. No product code edited. Brief: `docs/briefs/review-1726.md` on `brief/review-1726`.
Hard tier (workflows, secrets-register). Scope: the seven checks in the brief. The 2 allow-list
entries and flipping `MERGE_TIERS_ENABLED` are out of scope, as briefed.

## Verdict: PASS WITH NITS

## Hard-tier: PASS

With the flag unset or not `'true'`, neither workflow can arm, push, open a PR, comment, raise an
issue or revert: each file has ONE job and the flag is the first clause of its `if`. The
`pull_request_target` move checks out `ref: main` only, never PR-head code, and the only PR text
that reaches a step (the body) goes through `env`. The disable step is `always()`, disables
unconditionally and fails closed on an unreadable or still-armed state. revert-on-red's
GITHUB_TOKEN is read-only and every write goes through BOT_PR_TOKEN. The register change removes
exactly one entry, which rule (c) of `check-secrets-register.mjs` now makes stale anyway; nothing
is loosened. Proposals are byte-identical. All briefed tests and guards are green on a checkout
of the PR tip. The nits below are safe-direction races and doc gaps, none of them blocking.

Line numbers below are from the files at the PR tip; `.github/workflows/*.yml` and
`docs/proposals/*.yml` are identical, so they apply to both copies.

## Findings

### 1. Flag off: no write path (PASS)

- `auto-merge-on-open.yml` has one job, `arm` (line 36). Its `if` (lines 37-42) is
  `vars.MERGE_TIERS_ENABLED == 'true' && base.ref == 'main' && author kiki-claude-bot &&
  same-repo head && !claude/revert-*`. Flag unset or any other value: the job is skipped, so no
  step runs, including the `always()` disable step (step-level `always()` never resurrects a
  skipped job). `gh pr merge --auto` (line 96) and `--disable-auto` (line 108) are unreachable.
- `revert-on-red.yml` has one job, `revert` (line 56). Its `if` (lines 57-63) requires the flag
  for BOTH `workflow_run` and `workflow_dispatch`. Without it: no checkout, no `git push`
  (line 159), no `gh pr create` (161), no `gh pr comment` (162), no `gh issue create` (149, 163).
- No job-level or step-level `permissions:` in either file; no second job; no reusable-workflow
  call.
- With the flag ON (not this PR's state): arming also needs tier B/C, the tier-B self-review and
  `paused == 'false'` (line 91); the revert step needs `decide`, not dry-run, `paused == 'false'`
  and tier B/C (line 139).

### 2. pull_request_target safety (PASS)

- Trigger: `pull_request_target` with `branches: [main]` (lines 22-24), no `pull_request`. The
  `branches` filter on this event is the BASE branch, so the definition always runs from main.
  The job additionally requires `github.event.pull_request.base.ref == 'main'` (line 39); there is
  only one job, so the check covers every job.
- Checkout: `actions/checkout@v7` with `ref: main` and `persist-credentials: false`
  (lines 46-49). Nothing else fetches or executes PR code: the classifier is imported from
  `./scripts/lib/merge-tier.mjs` on main (lines 65, 77); the PR's files come from the API as
  data (`pulls.listFiles`, line 57) and are only parsed as JSON.
- PR text in `run:`: the body is passed as `env.BODY` (line 73) and read via
  `process.env.BODY`; the PR number and the PR-head sha go through `env` (lines 94-95, 101-102).
  No `run:` interpolates title, body, branch name or any `github.event.*` string. The
  `concurrency.group` uses only the PR number (line 32).
- Fork guard kept: `head.repo.full_name == github.repository` (line 41), plus the author pin
  (line 40), so a fork or a non-bot PR never reaches the secret at all.
- `types` includes `edited` (line 24). A base-branch change INTO main re-triggers correctly;
  a change away from main is filtered out, which is the intended direction.

### 3. Disable step (PASS)

- `if: always() && !(<arm condition>)` (line 98), where the negated clause is the arm step's
  `if` verbatim (line 91). The new test asserts exactly that textual relationship.
- Unconditional: `gh pr merge "$PR" --disable-auto` runs every time the step runs (line 108); the
  stale-payload `ARMED` gate is gone (the test asserts the env var and the word are absent).
- Fail closed: on a non-zero exit it re-reads `autoMergeRequest != null` (line 109); only a
  literal `false` passes; `true`, or `unknown` when the re-read itself fails, exits 1 (line 110).
  `$(... || echo unknown)` strips the trailing newline, so the string compare is exact.
- Paused: `paused != 'false'` makes the arm step skip and the disable step run with
  BOT_PR_TOKEN, so an earlier arming is removed. That is the safe direction and matches the
  recorded behaviour of `bot-automerge.yml` and `dependabot-automerge.yml` in
  `docs/automation-pause.md` (rows 37-38): pause = no enable, existing arming disabled.
- Step failures upstream (checkout, classify, review) leave `steps.tier.outputs.tier` empty,
  the negated clause is true, and the disable still runs: fail closed. If the ARM step itself
  fails, the negated clause is false, the disable is skipped and the job goes red with nothing
  armed. Correct.

### 4. revert-on-red (PASS)

- Permissions (lines 46-49): `contents: read`, `pull-requests: read`, `issues: read`. The
  `issues: read` is needed by the pause reader (line 123, `github.token`).
- Every write uses BOT_PR_TOKEN: the checkout's `token:` (line 76) is what `git push` (line 159)
  pushes with; the write step's `GH_TOKEN` (line 141) covers `gh pr create`, `gh pr comment`,
  both `gh issue create` calls and `owner_turn`. The `Decide` github-script (lines 80-115) runs
  with the default `github.token` and performs reads only: `getCommit`,
  `listPullRequestsAssociatedWithCommit`, `pulls.get`, `issues.listEvents`, `pulls.listFiles`,
  `pulls.list`, `GET /search/issues`.
- Ancestor check (line 89) really blocks: the sha is first pinned to `^[0-9a-f]{40}$` (line 87),
  so nothing but a hex sha reaches `spawnSync` argv; `fetch-depth: 0` (line 75) makes
  `actions/checkout` fetch `+refs/heads/*:refs/remotes/origin/*`, so `origin/main` exists;
  `git merge-base --is-ancestor` returns 1 for a known non-ancestor and 128 for an unknown
  object, both `!== 0`, both `SKIP`. It runs before any API read, so a bogus dispatch sha costs
  nothing.
- Owner-turn fallback (line 161): `if ! URL=$(gh pr create ...)` is correct under
  `set -euo pipefail`: the exit status of a bare assignment is that of its command substitution,
  and `set -e` is suspended inside an `if` condition. `owner_turn` is defined above (lines 148-153),
  names `$BRANCH` in its body and `exit 0`s, so the duplicate guard (`GET /search/issues` for the
  branch name, lines 113-114) still finds it: one revert per commit holds even on this path.

### 5. secrets-register.json (PASS)

- The diff touches exactly two things under the BOT_PR_TOKEN entry: the `grandfathered` reason
  for `auto-merge-on-open.yml` is reworded (still dated `2026-11-16`, so the register test's
  date regex passes) and the `untrusted_trigger_grandfathered` key for `auto-merge-on-open.yml`
  is removed. `readers_allowed`, `contract_readers`, `required_minimum_scope`, `contract_text`
  and every other entry are untouched; nothing is loosened.
- The removal is REQUIRED, not optional: rule (c) in `scripts/check-secrets-register.mjs`
  (header lines 16-19, implementation line 336) exempts a `pull_request_target` job that checks
  out only `ref: main`, and fails a grandfather entry that is no longer reachable from an untrusted
  trigger as stale. `bot-pr.yml` stays, correctly, since it is still reachable from `push`.
- Register matches the workflow: the entry text says "pull_request_target that checks out main
  only (never PR head code)", which is what lines 22-24 and 46-49 do. `revert-on-red.yml`'s entry
  is unchanged and still accurate.
- `node scripts/check-secrets-register.mjs` on the PR tip: OK (48 workflows, 73 jobs, 24 secrets
  read, 29 entries).

### 6. Proposals byte-identical (PASS)

`cmp` of `docs/proposals/auto-merge-on-open.yml` vs `.github/workflows/auto-merge-on-open.yml`
and of the two `revert-on-red.yml` copies: both identical, exit 0.

### 7. Tests and guards on a checkout of the PR tip (PASS)

| Check | Result |
| --- | --- |
| `npx vitest run tests/automationPauseWorkflows.test.ts tests/automationRegister.test.ts tests/mergeTier.test.ts` | 3 files, 172 tests, all pass |
| `node scripts/check-workflow-artifact-policy.mjs` | exit 0 |
| `node scripts/check-secrets-register.mjs` | OK |
| `node scripts/lint-workflow-masking.mjs` | 48 files, no unjustified continue-on-error |
| `node scripts/lint-workflow-notification.mjs` | 48 files, OK |
| `npm run check:mojibake` | 2779 files, clean |
| PR check runs at review time | every completed run green; unit (full), e2e-smoke and phone-qa x3 still in progress; `mergeable_state: blocked` (awaits review) |

The new tests are structural and would catch regressions in each briefed property: the trigger
list, `branches`, `base.ref`, checkout ref and credentials, the `always()` negation, the absence
of `ARMED`, the re-read command and its `exit 1`, the ancestor check and the `owner_turn` call.
The PR body states a mutant check (9 failures against main's files); not re-run here.

## Nits (non-blocking)

- N1. `cancel-in-progress: true` (line 33) plus a step-level `always()`: when a `synchronize`
  supersedes a run, the cancelled run's disable step still executes (GitHub runs `always()` steps
  on cancel). In the unlikely case it lands after the new run's `--auto`, the PR ends up disarmed
  rather than armed, and the next `synchronize`/`edited` re-arms it. Safe direction, same shape as
  `bot-automerge.yml`; worth one comment line, not a change.
- N2. `docs/automation-pause.md`'s consumer table (rows 36-40) does not yet list
  `auto-merge-on-open.yml` or `revert-on-red.yml`, although the pause test now treats both as
  consumers. That file is outside the brief's allowed list, so this is a follow-up, not a defect
  of this PR.
- N3. In `revert-on-red.yml` lines 162-163, a failure of `gh pr comment` or the final
  `gh issue create` after the revert PR exists goes red under `set -e` without an owner-turn
  issue. The revert PR is already open at that point, so nothing is lost silently; pre-existing
  from #1681 and not in the brief.
- N4. The ancestor check runs inside `Decide`, before the dry-run split, so a `workflow_dispatch`
  with a non-main sha logs `SKIP ... not an ancestor of main` and stops. That is the right outcome;
  noting only that the dry-run step (line 133) never sees such a sha, which the step's wording
  does not promise anyway.

## Not verified

- Neither workflow has run live (flag off): the `pull_request_target` event payload, the
  `gh pr merge --disable-auto` exit code on an un-armed PR, and the `autoMergeRequest` re-read
  are reasoned from the gh and GitHub docs and the file text, not observed.
- `scripts/check-identity-register.mjs` (needs a live `GET /user`) was not run.
- No dry-run `workflow_dispatch` of revert-on-red was triggered from this session.
- tsc: this review changes no TypeScript; `npx tsc --noEmit -p .` was not run for the review
  branch (docs-only). The PR body reports 0 errors on its two touched test files.
