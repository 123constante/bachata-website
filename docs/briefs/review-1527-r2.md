# BRIEF: review-1527-r2 (Website; independent DELTA re-review of PR #1527 fix round; Fable; normal lane; read-only on the PR branch)

Brief-version: 2
Re-review of 123constante/bachata-website PR #1527, branch `claude/welcome-w1b-join-note`, head c1c4307cb (fix round after review r1, verdict PASS-with-fixes). You do NOT edit that branch. You write ONE review file and push it on your own branch `claude/review-1527-r2`. You never approve or merge. First review: `docs/review/review-1527-r1.md` on branch `claude/review-1527-r1` (read it first). Fix brief: `docs/briefs/welcome-w1b-join-note-fix.md`.

REVIEW FILE HEADER RULE: the first lines of your review file must contain, on ONE line with no line break between the word and the sha, the text `head c1c4307cb` (or the full head sha if the PR head moved), because the merge tooling reads that token.

## What main lacks
- A recorded independent review verdict for PR #1527 at head c1c4307cb -- grep: review-1527-r2 in docs/review (absent on main)

## What to do (in order)
1. Clone fresh with `npm ci` in YOUR OWN directory. No node_modules junctions.
2. Verify at the CODE, not the commit message, each r1 finding: F1 (PR body: zero `TO FILL`, per-job CI table, Verified on real data with read-only counts you re-check, Not verified; 390x844 screenshots attached for empty, 2 chars, 3 chars, server error; read the body via the GitHub API); F2 (the test asserts the field's maxLength attribute equals 500; remove `maxLength={500}` and see it fail); F3 (three spaces and padded short note cases exist; remove `.trim()` and see it fail); F4 (the guard inside `request` is exercised by a real path with a short note and zero RPC calls; remove the guard and see it fail); F5 (`aria-describedby` on the textarea points at the reason line; remove it and see it fail).
3. Review the delta `260c2df33..c1c4307cb` only for new risk: nothing beyond the source line(s) for F5, the test file and docs; no server, public card or workflow change.
4. Run the new test and `npm run test:unit`; record exit codes. Re-run the r1 mutants M1 to M8 plus the five above; report killed or survived for each.
5. Per-job CI table for the PR head (`gh pr checks 1527`); some jobs were still pending when this brief was written, so say which were pending when you read and re-read before you finish.

## Output
`docs/review/review-1527-r2.md`: verdict PASS / PASS-with-fixes / BLOCK; F1-F5 status table; numbered new findings (severity, file:line, how reproduced); mutant table; CI table; Verified / Not verified. End your final commit subject with the done marker for your ticket.

## Files
- `docs/review/review-1527-r2.md` (new review file)
