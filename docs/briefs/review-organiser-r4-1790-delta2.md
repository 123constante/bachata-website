# Review: PR #1790 delta, b8ca2d154 -> 40ba2189d (round 2 of the delta, format fix)

An earlier delta review (docs/review/pr-1790-organiser-r4-delta.md on claude/review-organiser-r4-1790-delta) was PASS WITH NITS but its header lacks the `head <sha>` token the merge gate parses. Do the review again independently; do not copy it.

Do: `git diff b8ca2d154 40ba2189d` on claude/organiser-r4. Confirm only (a) full weekday/month names and (b) raw Unicode punctuation replaced by escapes; no save-path, routing, flag or money change. Run `npx vitest run src/modules/organiser/p3/r4 src/modules/organiser/p3/door` and `npx tsc --noEmit`. Do not edit the PR branch.

Output: docs/review/pr-1790-organiser-r4-delta2.md. FIRST LINE exactly: `# Review: PR #1790 (head 40ba2189d)`. Then headings `## Verdict: PASS|PASS WITH NITS|BLOCK` and `## Hard-tier: PASS|FAIL`, and an honest "Not verified". Push on claude/review-organiser-r4-1790-delta2.
