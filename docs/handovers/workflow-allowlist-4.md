# Handover: workflow-allowlist-4 (PR #1394 fix round after review r2)

Brief: `brief/automation-loop-editable-workflows:docs/briefs/fix-1394-review-r2.md`
(blob 15624a0f). Review: `claude/review-1394-r2:docs/review/review-1394-r2.md`.
Scope: F2, F3, F4 only. ONE fix round, pushed once.

## Done

- **F2 (wiring pinned).** New `describe('the CI wiring in workflow-lint.yml')` in
  `tests/automationWorkflowAllowlist.test.ts` parses the workflow with `yaml` and pins:
  the step exists once in `masking-check`; its `run:` is exactly the self-test line and
  `--merge "$MERGE_SHA"` (so `|| true`, `set +e` or a dropped line is red); no
  `continue-on-error` / `shell:` on the step, no `continue-on-error` / `if:` on the job;
  `env` is exactly HEAD_REF / PR_AUTHOR / MERGE_SHA; `if:` is the exact expected string;
  and the `if:` cannot skip on a workflow change (the `changes` step runs first, unconditionally,
  runs `docs-only.mjs --merge`, and `isDocsOnly` returns false for `.github/workflows/*`,
  a case variant and a `.md` under workflows/).
- **F3 (wording).** Workflow step comment and script header now say the list is
  "owner-curated; currently `workflow-lint.yml`" (comment lines only; no change to
  `on:`, `runs-on`, secrets, permissions, `pull_request_target`).
- **F4 (list not pinned).** The committed-list cases read the committed list via
  `committedNames(ALLOWLIST_PATH)` and derive the paths: own diff (listed names + the
  PR's non-workflow files) passes; a non-listed workflow fails; a list edit fails; a
  `x/<first listed name>` look-alike fails. `committedNames` throws "... is empty ..."
  or "... is malformed: <reason>" (both unit-tested on fixtures).
- `scripts/data/automation-workflow-allowlist.json` is NOT in the diff.

## Mutant table

Wiring mutants (F2), `vitest tests/automationWorkflowAllowlist.test.ts` (89 tests):

| Mutant | Result |
|---|---|
| remove the `--merge "$MERGE_SHA"` line | 1 failed (red) |
| M12: append `|| true` to the `--merge` line | 1 failed (red) |
| `if:` changed to `github.event_name == 'push' && ...` | 1 failed (red) |
| `continue-on-error: true` on the step | 1 failed (red) |
| drop `PR_AUTHOR` env | 1 failed (red) |

F4, list temporarily changed (restored after; not committed):

| Committed list | Result |
|---|---|
| `["e2e-smoke.yml","autopilot.yml"]` | 89 passed (green) |
| `[]` | file fails to collect: `committed allow-list .../automation-workflow-allowlist.json is empty: the committed-list cases need at least one listed name` |

Review r2 script mutants, re-run (vitest red count / `--self-test` exit):

| Mutant | vitest | self-test | Killed |
|---|---|---|---|
| M1 always exit 0 | 36 red | 1 | yes |
| M2 basename | 5 red | 1 | yes |
| M3 ignore list-edit | 6 red | 1 | yes |
| M4 case-sensitive prefix | 5 red | 1 | yes |
| M5 drop author rule | 3 red | 1 | yes |
| M6 no normalisation | 14 red | 1 | yes |
| M7 drop CI author requirement | 2 red | 1 | yes |
| M8 no tab split | 2 red | 1 | yes |
| M9 case-sensitive list file | 2 red | 1 | yes |
| M10 case-insensitive author | 1 red | 0 | yes (vitest) |
| M11 broken list passes | 5 red | 1 | yes |

11 of 11 still killed; M12 now killed too.

## Verified

- `npx vitest run tests/automationWorkflowAllowlist.test.ts tests/automationFoundations.test.ts`: 159 passed.
- `--self-test`: PASS, 36 cases. `npm run check:mojibake`: clean. `lint-workflow-masking.mjs`: clean.
- Guard CLI on this PR's own file set (loop branch, kiki-claude-bot): exit 0.
- eslint on the touched test + script: clean. `npx tsc --noEmit -p .`: 0 errors.

## Not verified

- Full `npm run test:unit` (only the two targeted files were run).
- CI at the new head (read after push; see PR checks).
- Real data: n/a (CI-only code, no data path; no Supabase query run).

## Left to the owner

- **F1 (Medium): the guard's host workflow is on the allow-list.** `workflow-lint.yml` is
  listed, so a loop PR may edit the file that runs the guard. F2's test now makes such an edit
  red in `tests/automationWorkflowAllowlist.test.ts`, but a loop PR could edit that test too;
  owner Approve at head is still the real protection. Recommended: after #1394 merges, the owner
  removes `workflow-lint.yml` from `scripts/data/automation-workflow-allowlist.json`. Thanks to
  F4 that list PR needs no test edit (as long as the list stays non-empty; an empty list makes
  the committed-list cases fail loudly with the "is empty" message, which would then need a
  test change).
