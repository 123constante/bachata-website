# Handover: workflow-allowlist-1 (PRIORITY-QUEUE item 8, hard tier)

Branch `claude/workflow-allowlist-1`, PR #1353. Brief: `docs/briefs/workflow-allowlist-1.md`
on `brief/workflow-allowlist-1`. Owner Approves at head; the worker never merges.

## Done
- `scripts/data/automation-workflow-allowlist.json` -- ships `[]` (nothing allowed).
- `scripts/check-automation-workflow-allowlist.mjs` -- exit 0 / 1 / 2. A loop branch is
  `claude/` or `ccr-` (`isWorkerBranch` imported from `scripts/lib/autopilot.mjs`, one
  definition). On a loop branch it fails when a changed `.github/workflows/*` path is not
  `.github/workflows/<listed name>`, and when the PR changes the list itself (owner-only, so
  a worker can never list its own workflow in the same PR). Any other branch is never read.
  Canary `--self-test` (20 cases, every exit code); added to `TARGETS` in
  `scripts/prove-entry-point-dispatch.mjs`; npm scripts
  `check:automation-workflow-allowlist` (`--local`) and `:self-test`.
- `tests/automationWorkflowAllowlist.test.ts` -- the brief's table plus edges; ran RED first
  (module missing), then green.
- `docs/ci-guard-notes.md#automation-workflow-allow-list` -- what it is, who may change it.

## NOT wired into CI (brief step 4) -- owner decision
Wiring into `architecture-guard.yml` `integrity` is not one line: it needs a step with an
`if: github.event_name == 'pull_request'`, an `env: HEAD_REF: ${{ github.head_ref }}`, and
`--merge "$MERGE_SHA"` (it can reuse the depth-2 fetch the docs-only step already does).
More important than the size: **`claude/` is also the prefix of every dispatched worker
branch**, so with the empty list it would turn red EVERY worker PR that edits a workflow
-- and this PR too, since it adds the list file. Decide first whether that is wanted, or
whether the loop should get its own narrower branch prefix. The step, when wanted:

```yaml
      - name: Automation workflow allow-list
        if: github.event_name == 'pull_request' && steps.changes.outputs.docs_only != 'true'
        env:
          HEAD_REF: ${{ github.head_ref }}
          MERGE_SHA: ${{ github.sha }}
        run: |
          npm run check:automation-workflow-allowlist:self-test
          node scripts/check-automation-workflow-allowlist.mjs --merge "$MERGE_SHA"
```

## Review round 1 (the only one) -- what was left
- The `--merge` fetch+diff duplicates `changedPaths` in `scripts/ci/docs-only.mjs`; a shared
  `scripts/lib` helper would stop them drifting. Left: refactoring docs-only (a required-check
  classifier) is out of scope.
- `--local` does not see untracked files and trusts a possibly stale `origin/main`
  (documented in the header). If CI is ever fed `PR_FILES` from the REST files API, it must
  include `previous_filename` for renames, or a rename onto a listed name passes; prefer
  `--merge` (git `--no-renames`).

## Next steps
1. Owner: decide the branch-prefix question above, then wire (or not).
2. Owner adds names to the list in their own PR when a workflow is safe for automation.
