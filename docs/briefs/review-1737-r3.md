# Review brief: PR #1737 round 3 (format-exact re-review)

Branch under review: claude/ci-e2e-scope (head 9dff8b1bc). Do not push to it. You cannot comment on the PR. Review the diff against main independently: do not trust or copy any earlier review doc. Read the PR branch with `git fetch origin claude/ci-e2e-scope`.

Create docs/review/pr-1737-r3.md on your branch claude/review-1737-r3 (from main). Make no other change.

EXACT FORMAT (a script parses it; deviations are rejected):
- Line 1: `# Review (PR #1737, head 9dff8b1bc)`
- Then exactly ONE line that is `## Verdict: PASS` or `## Verdict: BLOCK` (colon and value on the same line; no other line may start with "Verdict").
- Then `## Hard-tier: PASS` or `## Hard-tier: FAIL`, and the words `head 9dff8b1bc` once in the text below.
- Then findings, one line each.

What to check: scripts/ci/docs-only.mjs emit() writes both docs_only= and e2e_skip=; the e2e-smoke.yml gated steps read e2e_skip; E2E_BLIND narrowed to .github/workflows/; `node scripts/ci/docs-only.mjs --self-test` passes; fail-safe on push/schedule/dispatch and on git errors runs the suite; no regression to other docs_only readers.
