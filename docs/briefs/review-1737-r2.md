# Review PR #1737 round 2 (read-only): E2E Smoke scope fix

Branch under review: claude/ci-e2e-scope (head 9dff8b1bc). Do not push to it. You cannot comment on the PR. Create docs/review/pr-1737.md on your branch claude/review-1737-r2 (from main), containing `## Verdict` (one line), `## Hard-tier: PASS` or `## Hard-tier: FAIL` (with reviewed head SHA 9dff8b1bc), then findings one line each. Read the PR branch with `git fetch origin claude/ci-e2e-scope`. Make no other change.

Round 1 (head 7a64720bb) FAILED: emit() never wrote e2e_skip. Round 2 commit 9dff8b1bc changes only scripts/ci/docs-only.mjs: new exported emitLines(v, e2eSkip) writes both docs_only= and e2e_skip=; emit() uses it; E2E_BLIND narrowed from .github/ to .github/workflows/; two new self-test checks (emit output, .github/actions not skippable).

Check:
1. Run: echo supabase/a.sql | GITHUB_OUTPUT=/tmp/go.txt node scripts/ci/docs-only.mjs ; cat /tmp/go.txt  -> must show docs_only=false and e2e_skip=true. Also src/a.ts -> e2e_skip=false; docs/a.md -> both true; empty input -> both false.
2. node scripts/ci/docs-only.mjs --self-test passes.
3. e2e-smoke.yml reads steps.changes.outputs.e2e_skip on every heavy step; no step still reads docs_only; other workflows reading docs_only still get docs_only= unchanged.
4. Fail-safe and event handling unchanged (non-PR events: both false, suite runs). e2e-smoke.yml and package.json edits still run the suite.
5. Re-confirm the round 1 findings that passed (check 1-4) still hold at the new head.
