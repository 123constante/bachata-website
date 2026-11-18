# Review: PR #1790 delta, b8ca2d154 -> 40ba2189d (organiser Round 4)

Delta review of the fix commit only. Prior review (docs/review/pr-1790-organiser-r4.md, PASS WITH NITS) covered b8ca2d154.

Do: `git diff b8ca2d154 40ba2189d` on branch claude/organiser-r4. Confirm the change is only (a) full weekday/month names replacing short ones and (b) raw Unicode punctuation replaced by escapes/entities, in r4 models, R4Tickets.tsx and matrix tests; no behaviour, save-path, routing or flag change. Run `npx vitest run src/modules/organiser/p3/r4 src/modules/organiser/p3/door` and `npx tsc --noEmit`. Do not edit the PR branch.

Output: docs/review/pr-1790-organiser-r4-delta.md with `## Verdict: PASS|PASS WITH NITS|BLOCK` and `## Hard-tier: PASS|FAIL` plus an honest "Not verified". Push on your review branch claude/review-organiser-r4-1790-delta.
