# Independent review: PR #1394 (workflow allow-list guard) at head 84e537780a5767b9519002278cec22107ae75df9
Read-only review. Branch for your report: claude/review-1394-r2. Never push to claude/automation-loop-editable-workflows. Never approve or merge. Hard tier (.github/workflows + scripts guard): ONE review round.

## Review target (explicit)
`git fetch origin claude/automation-loop-editable-workflows main`; review `git diff origin/main...origin/claude/automation-loop-editable-workflows` (4 files: .github/workflows/workflow-lint.yml, scripts/check-automation-workflow-allowlist.mjs, tests/automationWorkflowAllowlist.test.ts, docs/handovers/workflow-allowlist-*.md). Handover: docs/handovers/workflow-allowlist-3.md on that branch.

## Must answer
1. Workflow change: only the guard step; no change to on:, runs-on, secrets, pull_request_target, permissions (quote the diff lines).
2. Guard correctness vs scripts/data/automation-workflow-allowlist.json on main: loop PR editing a non-listed workflow fails; editing the list itself fails; subfolder look-alike fails; the PR's own diff passes.
3. MUTATION: write 3 mutants of the guard (e.g. always exit 0; compare basename not path; ignore the list-edit rule), run the committed tests against each; every mutant must turn a test red. Report any that stays green.
4. Does the guard weaken any existing check? Is it wired to run on the loop PR path only?
5. Check state at head: `gh pr checks 1394`; name any red and whether also red on main.

## Output
docs/review/review-1394-r2.md: verdict PASS / PASS-with-fixes / BLOCK, findings ranked, mutants table, Verified / Not verified. Docs-only; delete Phone QA section from any PR body. Final commit subject ends with [worker-done <ticket>].
