# Handover: workflow-allowlist-2 (automation loop may edit no workflow)

Branch `claude/automation-loop-editable-workflows`, PR #1394. Brief:
`docs/briefs/automation-loop-editable-workflows.md` on `brief/automation-loop-editable-workflows`.
Hard tier: owner Approve at head; the worker never merges or approves. Builds on #1342 and #1353.

## What changed
- **Wired.** One step, "Automation workflow allow-list", in `.github/workflows/workflow-lint.yml`
  job `masking-check`, after "Detect docs-only PR" and setup-node. Runs only on `pull_request`
  and only when the PR is not docs-only. Env: `HEAD_REF` (github.head_ref), `PR_AUTHOR`
  (github.event.pull_request.user.login), `MERGE_SHA` (github.sha). Runs `--self-test` first,
  then `--merge "$MERGE_SHA"` (same depth-2 fetch as docs-only). Node built-ins only, no npm ci.
  `masking-check` is already a required pr_head job, so `required-jobs.json` is unchanged. The
  workflow's `pull_request: branches: [main, master]` filter (no paths filter) is unchanged and
  no other workflow was touched.
- **Author rule.** A loop PR is a `claude/` or `ccr-` head branch (isWorkerBranch) OR author
  exactly `kiki-claude-bot` (BOT_LOGIN, imported from `scripts/lib/autopilot.mjs`).
  `dependabot[bot]` and `github-actions[bot]` are not the loop (tested). A non-loop PR never
  reads the list. In CI (`CI` or `GITHUB_ACTIONS=true`) a missing `PR_AUTHOR` is exit 2.
- **Path variants.** Every path is normalised (backslash to slash, leading `./` stripped);
  the `.github/workflows/` prefix and the list file are matched case-insensitively. Only the
  exact-case `.github/workflows/<listed name>` counts as listed, so `.GitHub/Workflows/x.yml`
  always fails on a loop PR. A `old<TAB>new` PR_FILES line counts both names; `--merge` uses
  `--no-renames` so both names appear anyway.
- **Who may change it.** Only the owner, in an owner PR (the guard fails any loop PR that
  touches `scripts/data/automation-workflow-allowlist.json`). The list, the guard and
  `.github/**` are already owner-Approve paths in `.github/automation/guard-paths.json`
  (lines 4, 16, 17; confirmed, not edited). The list stays `[]`.
- Self-test: 20 -> 33 cases. Tests: 64 in `tests/automationWorkflowAllowlist.test.ts`
  (red first: 20 failed against main's guard, then 64/64).

**Owner follow-up:** after #1389 merges, fold this section into the "Automation workflow
allow-list" section of `docs/ci-guard-notes.md` (not edited here: #1389 edits that file).

## Expect this
This PR is a `claude/` branch by kiki-claude-bot that edits a workflow, so `masking-check`
goes RED on the new step. That is the proof it works. Do not list `workflow-lint.yml` to get
green. Note: of the last 50 commits on main, 49 are by kiki-claude-bot and 10 touch
`.github/workflows/`; every such future worker PR will be red on this step by design, and
needs either an owner-listed name or the owner's Approve at head.

## Per-job table (local)
| Job / step | Result |
|---|---|
| masking-check: docs-only self-test, masking lint | pass |
| masking-check: Automation workflow allow-list | self-test pass; on this PR as loop PR exit 1 (expected red; owner Approve at head covers it); owner author 0; no author in CI 2 |
| notification-check (notification lint, no-preview prefixes, both self-tests) | pass |
| bom-check | pass |
| npm run lint | 34/34 links green (eslint informational) |
| check:script-conventions, prove:entry-point, check:required-jobs | pass |
| check:mojibake, check:integrity | pass |
| vitest tests/automationWorkflowAllowlist.test.ts | 64/64 |
| test:unit full | 16 unrelated failures in 8 files; identical with main's versions of the touched files |

Mutation proof: removing `|| author === BOT_LOGIN` made `--self-test` fail 1/33 and vitest
3/64; removing normalisation in `violations()` made self-test fail 1/33 and vitest 4/64;
revert restored green.

## ROLLBACK
Delete the "Automation workflow allow-list" step from `workflow-lint.yml` `masking-check`.
The JSON list and the guard stay as inert files; nothing else depends on them.

## ADMIN (report only, no admin change)
Confirmed from 123constante/bachata-admin `HEAD` (default branch, shallow clone): admin
`.github/automation/` holds only arming.json, components.json, required-jobs.json,
secrets-register.json (no guard-paths.json, no workflow allow-list, no guard script), and
`.github/workflows/bot-automerge.yml` line 83 acts on `kiki-claude-bot`. So the same rule is
needed there. Suggested follow-up brief: `admin-automation-workflow-allowlist`.

## Not verified
No live loop PR exercised (loop ships OFF). The step's GitHub run is visible on PR #1394.
