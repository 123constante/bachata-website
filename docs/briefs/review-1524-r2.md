# BRIEF: review-1524-r2 (Website; independent DELTA re-review of PR #1524 fix round; Fable; normal lane; read-only on the PR branch)

Brief-version: 2
Re-review of 123constante/bachata-website PR #1524, branch `claude/welcome-w1-link-rel`, head `cf9d24d55` (fix round after review r1, verdict PASS-with-fixes). You do NOT edit that branch. You write ONE review file and push it on your own branch `claude/review-1524-r2`. You never approve or merge. First review: `docs/review/review-1524-r1.md` on branch `claude/review-1524-r1` (read it first). Fix brief: `docs/briefs/welcome-w1-link-rel-fix.md`.

## What main lacks
- A recorded independent review verdict for PR #1524 at head cf9d24d55 -- grep: review-1524-r2 in docs/review (absent on main)

## What to do (in order)
1. Clone fresh with `npm ci` in YOUR OWN directory. No node_modules junctions.
2. Verify at the CODE, not the commit message: F1 (the DJ no-dates Instagram anchor now carries the shared rel and the test row has no exception for it; revert that one source line and confirm the test goes red), F2 (the PR body has no `TO FILL` left, has the changed/left table, the per-job CI table, a Verified on real data block with read-only counts and a Not verified block; check the counts yourself, read-only, counts only), F3 (no placeholder handover remains), N1 (the comment sits at both WhatsApp sites).
3. Review the delta `f8e330b70..cf9d24d55` only for new risk: nothing beyond rel attributes, comments, the test row and docs; no copy, layout, snapshot, workflow or protected calendar file change. Re-grep the same public pages for user-typed new-tab links still on `noopener noreferrer` (the r1 sweep found only F1).
4. Run `tests/publicLinkRel.test.ts` and `npm run test:unit`; record exit codes. Mutants (>= 6 on the delta, killed/survived): restore the old rel on the F1 line, re-add the exception row, drop the new user-link count by one, add an unlisted `noopener noreferrer` anchor.
5. Per-job CI table for the PR head (`gh pr checks 1524`); if jobs are still pending when you read, say which and re-read before you finish.

## Output
`docs/review/review-1524-r2.md`: verdict PASS / PASS-with-fixes / BLOCK; F1-F3/N1 status table; numbered new findings (severity, file:line, how reproduced); mutant table; CI table; Verified / Not verified. End your final commit subject with the done marker for your ticket.

## Files
- `docs/review/review-1524-r2.md` (new review file)
