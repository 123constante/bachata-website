Brief-version: 2

# Brief: wire and harden the automation workflow allow-list (the loop may edit no workflow)

Repo 123constante/bachata-website. Branch claude/automation-loop-editable-workflows. Lane: careful, hard tier (`.github/**`, `scripts/**`: owner Approve at head; the worker never merges or approves). Model: Opus. Builds on merged #1342 (autopilot loop, ships OFF) and #1353 (the list and guard exist but are NOT wired).

LEAD NOTE (read first; the job as first written duplicated main): `scripts/data/automation-workflow-allowlist.json` (ships `[]`), `scripts/check-automation-workflow-allowlist.mjs` (--self-test, 20 cases) and `tests/automationWorkflowAllowlist.test.ts` already exist on main. Do NOT create a second list under `.github/automation/` (two sources of truth). This brief finishes the job: wire it, make the loop test author-aware, close the path-variant gaps. The list stays the existing JSON array of bare names and stays `[]`.

## Aim
After this PR: any PR authored by the automation loop (head branch `claude/` or `ccr-`, OR author `kiki-claude-bot`) that touches a path under `.github/workflows/` not on the list fails a CI step; any change to the list by such a PR fails; an owner-authored PR is never affected. Default list empty = the loop edits no workflow.

## What main lacks
- A CI step that runs the guard: it is not wired -- grep: `automation-workflow-allowlist` in .github/workflows/*.yml returns nothing on origin/main (only guard-paths.json lines 16-17, package.json lines 33-34, docs)
- Author-based detection: the guard keys ONLY on the head branch (`isLoopBranch` = `isWorkerBranch`), so a `kiki-claude-bot` PR from a branch with another prefix is never checked -- grep: `isWorkerBranch` in scripts/check-automation-workflow-allowlist.mjs (no `PR_AUTHOR`, no `BOT_LOGIN`)
- Path-variant hardening: `violations()` uses exact `f.startsWith(WORKFLOW_DIR)`, so `.GitHub/Workflows/x.yml`, a backslash path or a leading `./` is not seen; guard-paths matching is case-insensitive, this guard is not -- grep: `startsWith(WORKFLOW_DIR)` in scripts/check-automation-workflow-allowlist.mjs
- A conditional entry for the new check in required-jobs.json -- grep: `"conditional"` in .github/automation/required-jobs.json lists only phone-qa, build-smoke, types-drift
- Rename proof on the PR_FILES route: only `--merge` uses `--no-renames`; a REST-fed rename needs `previous_filename` -- #1353 (docs/handovers/workflow-allowlist-1.md, "Review round 1")
- No list of editable workflows under .github/automation: verified, `git ls-tree --name-only origin/main .github/automation/` is exactly arming.json, components.json, guard-paths.json, money-set.json, required-jobs.json, secrets-register.json -- .github/automation
- extends: the existing guard, list and test file (do not rebuild) -- scripts/check-automation-workflow-allowlist.mjs

Bot authors found on main: `kiki-claude-bot` (BOT_LOGIN in scripts/lib/autopilot.mjs and scripts/automerge-classify.mjs; acts_as in secrets-register.json; conditions in bot-automerge.yml and autopilot.yml). `github-actions[bot]` (autopilot status comments, drill records, types-drift-autoheal) and `dependabot[bot]` (dependabot-automerge.yml) are NOT the loop: leave them unaffected and prove it in a test case. Import BOT_LOGIN from scripts/lib/autopilot.mjs, never copy it.

Guard-path note: `.github/automation/guard-paths.json` already covers `.github/**` and both guard files (lines 4, 16, 17), so the list and guard are already owner-Approve paths; confirm and do NOT edit that file.

## Files
.github/workflows/architecture-guard.yml
.github/automation/required-jobs.json
scripts/check-automation-workflow-allowlist.mjs
tests/automationWorkflowAllowlist.test.ts
docs/ci-guard-notes.md
docs/handovers/workflow-allowlist-2.md

Read-only context, not edited: scripts/data/automation-workflow-allowlist.json (stays `[]`).

## Deliverables (4)
1. Guard hardening in scripts/check-automation-workflow-allowlist.mjs: new input `PR_AUTHOR` (loop = isWorkerBranch(branch) OR author equals BOT_LOGIN, exact compare); normalise every path before matching (backslash to slash, strip leading `./`, case-insensitive test for the `.github/workflows/` prefix and for the list file); a changed list file by a loop PR fails; a non-loop (owner) PR never reads the list. Keep exit 0/1/2 and `--self-test`; extend the canary with the new cases and keep R3/R5 satisfied (drive the exit-code function). A CI run with no PR_AUTHOR is exit 2, never a silent pass.
2. Table-driven tests in tests/automationWorkflowAllowlist.test.ts, red first (record the red run): listed workflow passes (list injected via AUTOMATION_WORKFLOW_ALLOWLIST); unlisted fails; list edited by loop fails; owner-authored PR unaffected; `kiki-claude-bot` on a non-claude branch fails; dependabot[bot] and github-actions[bot] unaffected; docs-only PR passes; rename onto and off a workflow (old AND new name considered); delete of a workflow; case and separator variants (`.GitHub/Workflows/x.yml`, `.github\workflows\x.yml`, `./.github/workflows/x.yml`, nested `.github/workflows/sub/x.yml`).
3. Wiring: ONE step in .github/workflows/architecture-guard.yml (the only workflow file touched), `if: github.event_name == 'pull_request'`, env HEAD_REF from github.head_ref, PR_AUTHOR from github.event.pull_request.user.login, `--merge "$MERGE_SHA"` (reuse the depth-2 fetch the docs-only step does; no `${{ }}` text inside the shell), self-test first. Add ONLY a `conditional` entry in .github/automation/required-jobs.json in the existing `{ "name": ..., "when": ... }` shape for the check-run that step belongs to; do not touch `pr_head`. Bootstrap warning: this PR edits a workflow, so under the loop's own rules it MUST go red on this step (empty list). That red is the proof it works: record it in the per-job table as "expected red; owner Approve at head covers it", and do not list architecture-guard.yml to get green.
4. Docs: update docs/ci-guard-notes.md "Automation workflow allow-list" (wired, author rule, path variants, who may change it) and write docs/handovers/workflow-allowlist-2.md: what changed, the per-job table, ROLLBACK (delete the wired step and its required-jobs conditional entry; the JSON list and guard stay as inert files; nothing else depends on them), and an ADMIN section (below).

## Admin repo: REPORT ONLY (no admin change in this PR)
In the handover state, from `git -C C:/dev/bachata-admin-11april show origin/main:...`, whether 123constante/bachata-admin needs the same list. Lead's finding to confirm: admin `.github/automation/` holds only arming.json, components.json, required-jobs.json, secrets-register.json (no guard-paths.json, no workflow allow-list, no guard script) and its bot-automerge.yml acts on `kiki-claude-bot` (line 83), so the same rule is needed there. One line, plus the follow-up brief name you suggest.

## Limits
- No admin change, no migration, no SQL, no `package.json` edit (npm scripts already exist), no edit to the list, guard-paths.json, arming.json or any second workflow file.
- No stacking: base is current origin/main; one branch, ONE push (hard tier, Vercel cap, paid CI minutes). Never add `run-ci` yourself.
- Hard tier: never merge, never approve, never `--no-verify`. Source files over 2 KB through scripts/safe-edit.py / safe-write.py; HTML entities, no raw Unicode punctuation.
- Conventions: docs/ci-guard-notes.md "Writing a new guard -- the six rules check-script-conventions.mjs enforces" (R1 silent-skip, R2 swallowed-error, R3 exit-drift, R4 canary, R5 unproven-exit, R6 `isEntryPoint`). Do not re-baseline scripts/script-conventions-allowlist.json to pass.

## Verify
- Mutation proof (one line, required): in a scratch copy make `violations()` / the author test pass an unlisted `.github/workflows/x.yml` edit by `kiki-claude-bot`; show the table test and `--self-test` go RED; revert; show green.
- Run every CI job step that applies (read architecture-guard.yml, unit-tests.yml, workflow-lint.yml, typecheck.yml; includes `npm run lint`, `check:script-conventions`, `prove:entry-point`, workflow-lint on the edited YAML, `check:required-jobs`, vitest on the test file); the per-job table goes in the PR body.
- PR body: run the repo's own body check right after the PR exists; label exactly `- Shapes surveyed:` (counts only: recent PRs by author and by touching `.github/workflows/`); "Verified on real data" block with an honest "Not verified" (the loop is OFF, no live loop PR exercised); no Phone QA walk (no screen).
- Mojibake: `npm run check:integrity` and a grep for raw Unicode punctuation in every touched file.
