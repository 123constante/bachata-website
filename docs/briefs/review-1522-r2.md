# BRIEF: review-1522-r2 (Website; independent RE-REVIEW of PR #1522 fix round; Fable; careful lane; read-only on the PR branch)

Brief-version: 2
Review of 123constante/bachata-website PR #1522, branch `claude/whole-flyer-og-b1`, head `f96f7659d506735103c7745fc1af75bd21a50d81` (whole-flyer OG B1, fix round). You do NOT edit that branch. You write ONE review file and push it on your own branch `claude/review-1522-r2`. You never approve or merge. Build brief: `docs/briefs/whole-flyer-og-b1.md`; fix brief: `docs/briefs/whole-flyer-og-b1-fix.md`; contract: `docs/design/whatsapp-whole-flyer.CONTRACT.md` DRAFT 4. First review (verdict FIX, at head cb91320b): `C:/Users/ecual/.claude/plans/REVIEW-1522-whole-flyer-og-b1.md` (copy its text into your notes; read it before the code).

## What main lacks
- A recorded independent review verdict for PR #1522 at head f96f7659 -- grep: review-1522-r2 in docs/review (absent on main)

## What to do (in order)
1. Clone fresh with `npm ci` in YOUR OWN directory. No node_modules junctions or symlinks.
2. Verify each of the first review's findings 1-3 is fixed AT THE CODE, not by the fix commit message:
   - F1 golden test no longer pins text-rendering hashes that differ by host (CI job `unit (Europe/London, full)` green at head; run the test locally too).
   - F2 `scripts/check-og-images.mjs` `wholeFlyerFailures` compares decoded size to the `s=` of an `l=wf1` URL. Re-run the mutant: `l=wf1&s=960x1200` answered with a 1200x630 JPEG, `X-OG-Layout: wf1`, Cache-Control 3600 -> must now fail.
   - F3 a JPEG with no readable SOF (null width/height) is a failure. Re-run the mutant (JPEG header + EOI) -> must now fail.
   - Notes 4-6: say whether each was fixed, left, or parked; none block.
3. Run `node scripts/check-og-images.mjs --self-test` and every test the PR adds (tests/ogWholeFlyer*.test.ts); record exit codes.
4. New mutants on the FIX delta only (>= 12, record killed/survived): flip each new comparison, drop each new failure push, off-by-one on size parse, `s=` with extra/zero/negative/huge values, non-numeric `s`, uppercase `WF1`, missing `s` on an `l=wf1` URL.
5. Re-check the fix delta did not widen scope: `git diff cb91320b..f96f7659 --stat`; no workflow, SQL, `.env*`, or protected calendar files; default mode still OFF; mode OFF read path unchanged.
6. Per-job CI table for the PR head (`gh pr checks 1522`); confirm every job green or skipped-by-design.

## Output
`docs/review/review-1522-r2.md`: verdict PASS / PASS-with-fixes / BLOCK; numbered findings (severity, file:line, how reproduced); F1-F3 status table; mutant table (id, what changed, killed/survived, which test); per-job CI table; Verified / Not verified. End your final commit subject with the done marker for your ticket.

## Files
- `docs/review/review-1522-r2.md` (new review file)
