# Review: PR 867 docs-only CI skip (`claude/ci-docs-skip`)

Reviewed head: `9c2fd6f` (the brief named `ca5d5d4`; one later commit adds the
classifier to `prove-entry-point-dispatch.mjs` TARGETS). Base: `main` @ `03f37b4`.
Read-only review; nothing on the PR branch was touched. Ticket dt_b47e75214616.

## Verdict: PASS WITH FIXES

The mechanism is sound and fails safe: a crash, an empty file list, an unknown
event or an unfetchable sha all come out `docs_only=false`, and every gate keeps
its job id, name, matrix and concurrency. Two problems remain. F2 is a fix inside
this PR. F1 comes from the owner's own docs-only definition, so it needs an owner
call before merge.

## Findings

### F1 - HIGH (owner call): `.claude/**` counts as docs, but tests and guards read and run it
`scripts/ci/docs-only.mjs:26` allows every path under `.claude/`, and the
self-test pins that at `scripts/ci/docs-only.mjs:69` (`.claude/settings.json` -> true).
Real readers of those files:
- `tests/integrityCouldNotRun.test.ts:756` runs `.claude/hooks/post-write-check.sh`.
- `tests/reviewEnforcement.test.ts:593` and `tests/ctxGateCloud.test.ts:85`
  `JSON.parse` `.claude/settings.json`.
- `scripts/integrity-guard.py:76` parses `.claude/settings*.json`.
- The repo's own classifiers call this surface code. `scripts/automerge-classify.mjs:47`
  forbids `.claude/` ("CI / hook / agent surface"), and `reviewScope`/`reviewEnforcement`
  tests rank `.claude/hooks/*` and `.claude/settings.json` as risk tier "hard".

Failing scenario: a PR edits only `.claude/settings.json` and leaves a trailing
comma, or breaks `.claude/hooks/post-write-check.sh`. The classifier says
`docs_only=true` (verified through `isDocsOnly`), so `unit (Europe/London, full)`
and `integrity` both report green without running. The PR merges, the push run
on main goes red, and every later PR's merge commit inherits the red.

The original brief lists `.claude/**` under "decisions already made, do not
re-open", so this review does not override it. Recommended owner choice: narrow
the arm to `.claude/rules/**` plus `.claude/**/*.md`, and treat `.claude/hooks/**`
and `.claude/settings*.json` as code. Then flip the `.claude` row in the self-test
and add a hooks row that must come out false.

### F2 - MEDIUM (fix in this PR): docs-only PRs skip the two guards that check docs
`.github/workflows/architecture-guard.yml:61,73` (PyYAML + integrity guard) and
`:158` (Mojibake guard) now carry the docs-only `if:`. Both guards check `.md` files:
- `scripts/integrity-guard.py:53` lists `.md` in its scanned extensions (null
  bytes and truncation, the FUSE corruption class).
- The mojibake guard is a whole-repo `git grep`.

CLAUDE.md says `.md` is not covered by the safe-write hook, so this CI step is
the only check on markdown corruption. Docs-only PRs are exactly the ones that
change markdown.

Failing scenario: a docs-only PR commits a handover with `â€”` mojibake or a
null-byte-truncated `.md`. Today `integrity` goes red on the PR. With this PR it
is green on the PR and red on main after merge, and then red on every other open
PR. The brief's goal was "without touching what any check proves", and this
changes what `integrity` proves for docs.

Fix: remove the `if:` from `Ensure PyYAML`, `Run integrity guard (sealed wrapper)`,
`Mojibake guard` and (cheap, no npm) `Mojibake rules (canary)`, if it really needs
no `npm ci` (check first; otherwise leave it skipped). None of these needs
`npm ci`, so the docs-only fast path stays fast (python + git grep, seconds).

### F3 - LOW: markdown under other code-adjacent directories counts as docs
`MD_EXCLUDED` (`scripts/ci/docs-only.mjs:21`) covers `src/ public/ .github/
scripts/ tests/ app/`, but not `api/ supabase/ bin/ .githooks/ components/ e2e/ .vercel/`.
`scripts/automerge-classify.mjs:46-47` already forbids these. Verified true:
`api/README.md`, `supabase/README.md`, `bin/x.md`, `.githooks/x.md`, `e2e/x.md`.
None of these is known to be read by code today, so the risk is low. Suggest
reusing the automerge FORBIDDEN prefixes so the repo has one definition of
"not docs".

### F4 - INFO: the classifier deepens the checkout
`scripts/ci/docs-only.mjs:109` runs `git fetch --depth=2 origin <merge sha>` on
every event, including push. In the four workflows that check out with depth 1,
later steps now see a depth-2 repo (`HEAD^` exists). No step was found that
depends on shallowness, so nothing breaks. Noted because it is a side effect on
non-PR runs. Optional fix: only fetch when `EVENT_NAME=pull_request`.

## Checked and clean
- **Self-test:** `node scripts/ci/docs-only.mjs --self-test` gives 27 cases, 11
  mutants, ok. Every RULES entry has a case that kills its mutant, including each
  `md-excluded:*` veto and `sane-path`.
- **Extra cases through `isDocsOnly`:**
  - false: `src/modules/event-page/CLAUDE.md`, mixed docs + code,
    `docs/../src/a.ts`, absolute paths, git-quoted paths, `docsx/`, empty list,
    `package*.json`, `.github/**`.
  - true, as the owner's rule intends: `CLAUDE.md`, `docs/x.ts`, `plans/x.mjs`,
    `.MD`, paths with spaces.
- **Fail-safe CLI:**
  - Empty stdin gives false. A bad `--merge` sha gives false and logs
    "running everything".
  - `EVENT_NAME=push` and `EVENT_NAME=merge_group` give false.
  - The only skip is on `pull_request`; `workflow_dispatch`, `schedule` and
    `deployment_status` cannot skip.
  - If the step prints nothing, the output is `''` and `'' != 'true'`, so
    everything runs. If the step crashes, the job is red, never a false green.
- **`if:` expressions:** all use `steps.changes.outputs.docs_only != 'true'`
  (not `== 'false'`), and the `id: changes` step is present in every touched job.
  The status functions that existed before were kept: `failure()` on the
  Playwright upload, `!cancelled()` on chunk cycles. `matrix.scope == 'full'` was
  kept on the live-DB gate. A skipped `gate` step only feeds a step that is also
  skipped.
- **Range:** `github.sha^1..github.sha` on a `pull_request` merge commit is
  exactly the PR's net change against the current base. Fork PRs work because
  the merge ref lives in the base repo. `--no-renames` lists both sides of a
  rename.
- **Required contexts:** job ids `integrity`, `bundle-budget`, `e2e-smoke`,
  `wallclock-brand`, `masking-check`, `bom-check`, `unit` and the matrix values
  are byte-identical. The diff touches no job-level key, `on:`, `concurrency`,
  `permissions` or timeout.
- **YAML:** all six workflows parse with PyYAML. The expression syntax is valid.
- **`tests/entryPoint.test.ts`:** the exemption is an exact-string match on the
  one docs-only `if:`. The fixture proves that the inverse (`== 'true'`) is still
  excluded. This does not weaken the guard. `npx vitest run tests/entryPoint.test.ts`
  passes 10/10.
- **`masking-check`:** runs the classifier self-test unconditionally, so a broken
  table is red even on a docs-only PR.

## Not verified
- I did not see a live Actions run of PR 867. The `gh api` and MCP check reads
  were not used, so I did not confirm the PR's check states or a real docs-only
  run reporting green.
- Did not run the full unit suite or e2e on the PR head (only `entryPoint.test.ts`).
- I did not check whether `Mojibake rules (canary)` needs `npm ci`. That matters
  only if F2 is fixed by un-skipping it.
