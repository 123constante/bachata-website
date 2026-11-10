# BRIEF: review-1527-r1 (Website; independent REVIEW of PR #1527; Fable; normal lane; read-only on the PR branch)

Brief-version: 2
Review of 123constante/bachata-website PR #1527, branch `claude/welcome-w1b-join-note`, head 260c2df33 (Ask-to-join note required, minimum 3 characters, in the onboarding sheet; Welcome contract J3.1). You do NOT edit that branch. You write ONE review file and push it on your own branch `claude/review-1527-r1`. You never approve or merge. Build brief: `docs/briefs/welcome-w1b-join-note.md` (read it first). The builder was Sonnet.

REVIEW FILE HEADER RULE: the first lines of your review file must contain, on ONE line with no line break between the word and the sha, the text `head 260c2df33` (or the full head sha if the PR head moved) so the merge tooling can read it.

## What main lacks
- A recorded independent review verdict for PR #1527 at head 260c2df33 -- grep: review-1527 in docs/review (absent on main)

## What to do (in order)
1. Clone fresh with `npm ci` in YOUR OWN directory. No node_modules junctions.
2. Read the diff against the brief item by item: label no longer says optional; `REQUEST_NOTE_MIN` imported, not copied; send disabled while the trimmed note is shorter, with a reason line in the public card's words; 500-char limit kept; the guard inside `request` (try Enter key, double tap, programmatic call with a short note); an untouched sheet sends nothing; no change to the public card or any server code.
3. Run the new test and `npm run test:unit`; record exit codes. Mutants (>= 8, killed/survived): change the min, drop trim, drop the in-`request` guard, drop the disabled state, drop the reason line, `<` to `<=`, remove the 500 limit, restore "(optional)".
4. Check accessibility and phone use: the reason line is tied to the field (`aria-describedby` or equivalent), the disabled button says why without relying on colour, tap targets >= 44px, no layout jump at 390x844. Look at the PR screenshots; say if they are missing.
5. Check the existing tests that were edited (`dancerFirst.refusal.test.tsx` and any other) only changed in what the old optional rule required.
6. Per-job CI table for the PR head (`gh pr checks 1527`; say which were still pending when you read, and re-read before finishing). Check the PR body: no `TO FILL`, Verified on real data (read-only counts) and Not verified blocks present.

## Output
`docs/review/review-1527-r1.md`: verdict PASS / PASS-with-fixes / BLOCK; numbered findings (severity, file:line, how reproduced); requirement table; mutant table; CI table; Verified / Not verified. End your final commit subject with the done marker for your ticket.

## Files
- `docs/review/review-1527-r1.md` (new review file)
