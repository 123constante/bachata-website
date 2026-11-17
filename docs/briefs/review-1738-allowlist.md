# Review PR #1738 (read-only): add four workflows to the automation allowlist

Branch under review: claude/ci-allowlist-4 (head 024a12e95). Do not push to it. You cannot comment on the PR. Instead create docs/review/pr-1738.md on your branch claude/review-1738-allowlist (from main), containing `## Verdict` (one line), `## Hard-tier: PASS` or `## Hard-tier: FAIL` (with reviewed head SHA 024a12e95), then findings one line each. Read the PR branch with `git fetch origin claude/ci-allowlist-4`. Make no other change.

Change: scripts/data/automation-workflow-allowlist.json gains unit-tests.yml, pr-mergeable-guard.yml, autopilot.yml, automation-pause-guard.yml. This lets bot PRs edit those workflows (owner click 2026-11-17, to cut Actions minutes).

Check:
1. JSON valid, no duplicates, files exist under .github/workflows, names exact.
2. Find the guard that reads the allowlist; confirm it does not also grant other powers (merge tier, secrets, permissions changes) to listed workflows.
3. None of the four workflows holds a secret or deploy/prod-write step that makes bot edits dangerous; note any that does.
4. Tests for the guard still pass or are updated.
