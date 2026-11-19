# Review: Website PR #1860 (R4 cancel refund slice C), hard tier (money UI)

Review PR #1860 (branch claude/r4-cancel-refund-c, repo 123constante/bachata-website) at head c1b1f85d0 (take the full sha from gh). Read-only: change nothing, push only your review doc. Read the WHOLE diff (gh pr diff 1860 --patch), name every changed file in your doc, prefer FAIL over unverified PASS. Backend contract: admin edge ticket-refund-night (admin PR #2010 merged, #2015 pending).

Check with file:line evidence:
1. Everything behind VITE_ENABLE_ORGANISER_CANCEL_REFUND (default OFF): flag off renders nothing new.
2. Refund button and sheet visible and usable only to owner/admin, never to managers; no client-side widening of permission.
3. Sheet shows amount; confirm calls the edge function once; button disabled in flight (double tap = one call); every error/partial/not-cancelled result handled; never shows a false "refunded".
4. Part-used orders and free tickets handled as the model says (whole order refunded; free tickets end, no money).
5. No direct table write (write-door guards unaffected); tests cover the above; e2e spec registered in check-e2e-spec-coverage.mjs. Run the PR's tests plus one input the builder did not use.

Write docs/review/review-pr-1860.md on your branch with these EXACT headings on their own lines: `## Verdict: PASS` (or PASS WITH NITS / BLOCK), `## Hard-tier: PASS` (or FAIL with reason), and a line `head <full sha reviewed>`.
