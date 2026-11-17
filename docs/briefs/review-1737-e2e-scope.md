# Review PR #1737 (read-only): E2E Smoke skips when only trees the browser suite cannot see changed

Branch under review: claude/ci-e2e-scope (head 7a64720bb). Do not push to it. You cannot comment on the PR. Instead create docs/review/pr-1737.md on your branch claude/review-1737-e2e-scope (from main), containing `## Verdict` (one line), `## Hard-tier: PASS` or `## Hard-tier: FAIL` (with reviewed head SHA 7a64720bb), then findings one line each. Read the PR branch with `git fetch origin claude/ci-e2e-scope`. Make no other change.

Change: scripts/ci/docs-only.mjs now also emits `e2e_skip` (true when every changed file is docs, supabase/, .claude/, or another workflow); .github/workflows/e2e-smoke.yml step ifs switch from docs_only to e2e_skip. The job still runs so the required check still reports success.

Check:
1. YAML valid; CRLF preserved; no step still reads docs_only by mistake, and any other workflow/script that reads docs_only is unaffected.
2. Fail-safe: any error, empty diff, unknown path or merge-base problem gives e2e_skip=false (suite runs).
3. The skip list cannot hide a change the browser suite exercises: confirm src/, public/, package.json, lockfile, playwright/e2e config, vite config, tests/e2e, scripts used by the suite, and e2e-smoke.yml itself are NOT skippable. A PR that edits e2e-smoke.yml must still run the suite.
4. push to main and workflow_dispatch still run every step.
5. Any unit test for docs-only.mjs passes or is updated.
