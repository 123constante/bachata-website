# Brief: allow-list of workflow files the automation loop may edit (PRIORITY-QUEUE item 8, HARD-TIER), Opus

Branch `claude/workflow-allowlist-1` (create from main; push early with [skip preview] once coherent, final push without it; final subject ends `[worker-done <ticket>]`). Careful lane, under 30% context. Hard-tier files (.github/workflows/**, scripts/**): the owner Approves at head; do not merge. One review round only.

## What main lacks
The autopilot loop (scripts/autopilot-step.mjs, merged in #1342, ships OFF) can open PRs but there is no written rule for which `.github/workflows/*.yml` files an automated change may touch. Today the rule is implied by hand-review.

## Do
1. Add a committed allow-list `scripts/data/automation-workflow-allowlist.json` (array of workflow file names the loop may edit; start EMPTY, so nothing is allowed until the owner adds a name) plus its docs in docs/ci-guard-notes.md (what it is, who may change it: owner Approve only).
2. Add a guard script `scripts/check-automation-workflow-allowlist.mjs` (follow the six rules in scripts/check-script-conventions.mjs, add to TARGETS in scripts/prove-entry-point-dispatch.mjs, add a self-test): given the changed files of a PR (env PR_FILES or git diff vs main) and the PR head branch name, it fails (exit 1) when the branch is an automation-loop branch (name the prefix the loop uses; read scripts/autopilot-step.mjs) and any changed `.github/workflows/*` file is not in the allow-list. Non-loop branches are never affected. Exit 2 on a measurement failure.
3. Table-driven tests: loop branch + no workflow change; loop branch + listed workflow; loop branch + unlisted workflow (fails); human branch + any workflow (passes); missing/unreadable list (exit 2). Red first.
4. Wire it into the integrity job only if the workflow pattern for the other guards makes that a one-line step; if wiring needs a larger workflow change, do NOT wire it, say so in the handover.
5. Run every integrity job step you can (read .github/workflows), per-step table in the PR body; Verified / Not verified filled, docs/scripts-only so delete the Phone QA section.
