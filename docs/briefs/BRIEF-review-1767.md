# Brief: review PR #1767 (audit accepts pr-<n>*.md reviewer doc names), READ-ONLY, findings doc only

Repo 123constante/bachata-website. Review branch `claude/audit-review-doc-name` against `main`. You did not build it. You write ONE file on branch `claude/review-1767`: `docs/review/review-1767.md`. No source edits, no test additions, no DB write. Lane: normal.

## Read
`git fetch origin claude/audit-review-doc-name` then `git diff origin/main...FETCH_HEAD`. Files: `scripts/owner-approval-audit.mjs` (new exported `reviewDocNameRe(n)`, used by `readReviewDocs`), `tests/ownerApprovalAudit.test.ts` (new describe block at the end). Context: PR #1762 made the audit accept a reviewer doc `docs/review/<n>*.md` on branch `claude/review-<n>*` as hard-tier evidence.

## Judge
1. Does `reviewDocNameRe(n)` accept `<n>.md`, `review-<n>.md`, `review-<n>b.md`, `pr-<n>.md`, `pr-<n>-review.md` and reject `review-<n>0.md`, `pr-1<n>.md`, `pr-<n>.txt`, a different PR's number, and any name where a regex `.` could match a non-dot (the escape inside the template literal must produce `\.`)? Run it with node.
2. Does the change widen what counts as evidence beyond the intent (a doc by another account, another PR number, a prefix attack)? The ref rule `okRef` and the verdict rules are unchanged: confirm.
3. Do the new tests fail against the old regex (red first) for the `pr-` names? Reason it out; do not run vitest locally.
4. Anything else in the diff beyond the name rule.

## Output
Doc starts with `# Review of PR #1767 at <40-char head sha of claude/audit-review-doc-name>` (the sha within the first 5 lines). Then findings ranked most severe first: file:line, what is wrong, concrete failing input, CONFIRMED or PLAUSIBLE. Then, as exact lines at column 0, outside any code fence: `## Verdict: PASS` or `## Verdict: BLOCK`, and `## Hard-tier: PASS` only if no finding blocks merge (otherwise `## Hard-tier: FAIL`). End with a "Not reviewed" list. Zero findings is valid.

## Done =
Push `claude/review-1767` once; final commit subject ends with the done marker from your prompt. Stop at 30% context with a PARTIAL marker.
