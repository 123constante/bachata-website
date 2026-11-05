Brief-version: 2

# Brief: close the path-variant gap in the automation workflow allow-list guard (fix round on #1394)

Repo 123constante/bachata-website. Branch claude/automation-loop-editable-workflows (PR #1394 exists, current head 248841ad8). CONTINUE ON THAT BRANCH: `git fetch origin` then check it out from origin, never branch from main. Lane: careful, hard tier (`scripts/**`, `.github/**`: owner Approve at head after your push; the worker never merges or approves). Model: Opus. ONE final push (the lead sends the owner the Approve line after it). Never add `run-ci`.

## Aim
`normalisePath` in the guard must catch `.github//workflows/x.yml` and `.github/./workflows/x.yml`, not only backslash and case variants. The guard's step runs the PR's own checkout, so the handover must say plainly what protects the guard itself.

## What main lacks
- extends: `normalisePath` only swaps backslashes and strips a leading `./`, so doubled or inner-dot separators slip past the prefix test -- grep: `export function normalisePath` in scripts/check-automation-workflow-allowlist.mjs
- No test row for a doubled or inner-dot separator, in the table test or in the `--self-test` canary -- grep: `workflows` in tests/automationWorkflowAllowlist.test.ts (no `//workflows` or `/./workflows` row)
- No handover note that the wired step runs the PR's own checkout, so a loop PR editing the guard, scripts/lib/autopilot.mjs (BOT_LOGIN) or the test could weaken it -- docs/handovers/workflow-allowlist-2.md (check on the branch; extend it if present, create it if not)
- The docs anchor `#automation-workflow-allow-list` is already on main: heading `## Automation workflow allow-list` at docs/ci-guard-notes.md line 468 -- grep: `## Automation workflow allow-list` in docs/ci-guard-notes.md

## Files
scripts/check-automation-workflow-allowlist.mjs
tests/automationWorkflowAllowlist.test.ts
docs/handovers/workflow-allowlist-2.md

## Deliverables (3)
1. Guard fix: in `normalisePath`, after the backslash swap use `path.posix.normalize` (import `path` from node:path, use the posix member), keep the case-insensitive prefix test and the leading `./` handling, and keep exit codes 0/1/2. Add 2 or more table rows in the guard's `--self-test` AND in tests/automationWorkflowAllowlist.test.ts: `.github//workflows/x.yml` and `.github/./workflows/x.yml` (plus one combined, e.g. `.GitHub\.\workflows//x.yml`). RED FIRST: write the rows, run them against the UNFIXED code and record the red output, then apply the fix and show green.
2. Handover docs/handovers/workflow-allowlist-2.md: add a short "What protects the guard itself" note: the step runs the PR's own checkout, so a loop PR that edits the guard script, scripts/lib/autopilot.mjs (BOT_LOGIN) or the test could weaken the guard in the same PR; the protection is the hard-tier owner-Approve audit on `scripts/**` (guard-paths.json lines 4, 16, 17 cover it). State it as the accepted residual risk, one paragraph.
3. Docs anchor check, ALREADY DONE by the lead on origin/main: `## Automation workflow allow-list` exists in docs/ci-guard-notes.md (line 468), so the anchor resolves. DO NOT edit docs/ci-guard-notes.md (open PR #1389 edits it). Re-run `git fetch origin` and `git grep -n "## Automation workflow allow-list" origin/main -- docs/ci-guard-notes.md` once. If, unexpectedly, it no longer matches, add a short section with exactly that heading (what the check does, the empty list, how to add an entry, rollback) as a clearly separated block at the very END of the file to minimise conflict with #1389, and say so in the handover. Otherwise record "anchor present, no edit" in the handover.

## Limits
- Nothing else touched: no workflow file, no list, no package.json, no guard-paths.json, no required-jobs.json, no re-baselining of scripts/script-conventions-allowlist.json. No merge, no approve, never `--no-verify`.
- Source files over 2 KB through scripts/safe-edit.py / safe-write.py; no raw Unicode punctuation in any touched file.
- One push only, after everything below is done.

## Verify
- Self-test (`npm run check:automation-workflow-allowlist:self-test`) and vitest on tests/automationWorkflowAllowlist.test.ts green.
- Mutation proof again, one line: drop the `path.posix.normalize` call in a scratch copy, show the new rows and `--self-test` go RED; revert; show green.
- Run every CI job step that applies (`npm run lint`, `check:script-conventions`, `prove:entry-point`, workflow-lint on the unchanged YAML, `check:required-jobs`).
- PR body updated, using the repo's body check (`node ~/.claude/bin/check-pr-body.mjs <body-file>`): labels exactly per CLAUDE.md (`- Shapes surveyed:` counts only), a per-job CI table, and it still records "EXPECTED RED on its own new step, owner Approve at head covers it".
- Mojibake: `npm run check:integrity` and a grep for raw Unicode punctuation in every touched file.
