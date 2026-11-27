# BRIEF: review-1524-r1 (Website; independent REVIEW of PR #1524; Fable; normal lane; read-only on the PR branch)

Brief-version: 2
Review of 123constante/bachata-website PR #1524, branch `claude/welcome-w1-link-rel`, head `f8e330b70` (user-typed links on teacher/DJ/dancer public pages use PUBLIC_LINK_REL, Welcome contract J12.8). You do NOT edit that branch. You write ONE review file and push it on your own branch `claude/review-1524-r1`. You never approve or merge. Build brief: `docs/briefs/welcome-w1-link-rel.md` (read it first).

## What main lacks
- A recorded independent review verdict for PR #1524 at head f8e330b70 -- grep: review-1524-r1 in docs/review (absent on main)

## What to do (in order)
1. Clone fresh with `npm ci` in YOUR OWN directory. No node_modules junctions.
2. For EVERY anchor line the build brief lists, decide independently whether its href is user-typed (page owner) or app-generated, and check the PR changed or left it correctly. Report any user-typed link still carrying `noreferrer`, and any app-generated link wrongly changed. Also grep the same public pages for user-typed links the brief's list MISSED (target="_blank" anchors with a profile field as href, `window.open`, `rel` built by a helper).
3. Run the new `tests/publicLinkRel.test.ts` and `npm run test:unit`; record exit codes. Mutants (>= 8, killed/survived): revert one file's change, add an unlisted `noopener noreferrer` anchor in a covered file, remove one allowed-exception row, change the constant, drop `target`.
4. Confirm the diff is only rel attributes plus the test: no copy, layout, snapshot, workflow or protected calendar file change. Check the `noreferrer` drop does not break anything that needs a referrer (embeds, WhatsApp, maps).
5. Per-job CI table for the PR head and the PR's Verified / Not verified block (the real-data counts: check they were read-only).

## Output
`docs/review/review-1524-r1.md`: verdict PASS / PASS-with-fixes / BLOCK; numbered findings (severity, file:line, how reproduced); anchor table (file:line, user-typed Y/N, correct Y/N); mutant table; CI table; Verified / Not verified. End your final commit subject with the done marker for your ticket.

## Files
- `docs/review/review-1524-r1.md` (new review file)
