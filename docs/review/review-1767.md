# Review of PR #1767 at e8c05d7d41c445a0f0247d17cfd964ce8bdda889

Branch `claude/audit-review-doc-name` vs `main` (merge base at `origin/main` bf518f9). Diff: 2 files, +18/-3.
Read-only review; no source edits.

## Findings (most severe first)

No blocking findings. Two informational notes:

1. INFO -- `scripts/owner-approval-audit.mjs:258`: the `-.+` suffix (pre-existing, now also behind `pr-`) accepts a name carrying a second PR number, e.g. `pr-1767-1768.md` counts for PR 1767 (and not for 1768). Not a widening of real concern: the doc must still sit on a `claude/review-1767*` branch (`okRef` unchanged) and must name PR 1767's head sha in its first 5 lines, so a doc about another PR cannot satisfy the verdict rules. CONFIRMED (behaviour), not a defect.
2. INFO -- `scripts/owner-approval-audit.mjs:121`: the block comment on reviewer-doc evidence still says only `docs/review/<n>*.md`; the `readReviewDocs` JSDoc (line 261) was updated to list `pr-<n>*.md`. Doc drift only, no runtime effect. CONFIRMED.

## Judgement on the brief's questions

1. Regex. Ran with node against the PR head's exported `reviewDocNameRe('1767')`. Compiled source is `^(review-|pr-)?1767([a-z]|-.+)?\.md$` -- the template literal's `\\.` yields `\.`, so the dot is literal.
   - Accepted (true): `1767.md`, `review-1767.md`, `review-1767b.md`, `pr-1767.md`, `pr-1767-review.md`.
   - Rejected (false): `review-17670.md`, `pr-11767.md`, `pr-1767.txt`, `review-1768.md`, `1768.md`, `pr-1767xmd`, `1767Xmd`, `review-1767-xmd`, `pr-1767b.mdx`, `xpr-1767.md`, `pr-review-1767.md`, `PR-1767.md`, `../1767.md`, `prx1767.md`, `pr1767.md`, `1767.md.txt`, `1767bc.md`, `review-1767-.md`.
   All match the brief's intent.
2. Evidence widening. Only the file-name filter changes; the new alternation is anchored (`^`), so no prefix attack (`xpr-`, `pr-1` + other number) passes. `okRef` (line 267) and the verdict rules (`reviewerDocAtHead`, `decideAudit`) are untouched by the diff -- confirmed from `git diff origin/main...e8c05d7`. Author identity of the doc was never checked and still is not; that is unchanged behaviour, outside this PR.
3. Red first. Under the old regex `^(review-)?<n>([a-z]|-.+)?\.md$`, `pr-1747-review.md` and `pr-1741.md` evaluate false (verified with node using the old pattern), so those two `accepts` cases fail against the old code. The other accept cases and all reject cases pass under both (regression guards). Note the import of `reviewDocNameRe` itself would also fail against old code (no such export).
4. Beyond the name rule: the diff is only the extraction of `nameRe` into the exported `reviewDocNameRe(n)`, the JSDoc update, the test import and the new describe block. Nothing else.

## Verdict: PASS
## Hard-tier: PASS

## Not reviewed

- vitest not run locally (per brief); test behaviour reasoned and regex checked with node only.
- The live GitHub API path of `readReviewDocs` (refs/contents listing) was not exercised.
- CI status of PR #1767 not checked.
- Rest of `owner-approval-audit.mjs` outside the diff.
