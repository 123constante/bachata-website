# Brief: round 2 independent review of the pause-series acceptance contract (READ-ONLY, different model from the author)

Branch: `claude/review-pause-series-contract-r2` (review branch, no PR, no code). Author of the contract: website-50 (Sonnet). Round 1 reviewer (Opus) returned BLOCK with 2 blockers and 18 further findings: `docs/reviews/pause-series-contract-r1.md` (on `claude/review-pause-series-contract`, read it first). This is the ONE allowed second round: stopping rule, two rounds for a data-integrity change.

## What to review
`docs/design/pause-series.CONTRACT.md` (DRAFT 3) and `docs/design/pause-series.INVENTORY.md`, both on `brief/review-pause-series-contract-r2`. Feature unchanged: an organiser pauses a recurring or course series from the Website with an optional resume date; reminder; confirm on the resume day; auto-resume after 3 nudges; public banner. Owner decisions (section 2) are binding. Open owner questions are in section 12: do not rule on them, only check they are stated and that the contract's default is safe.

## Method (read-only; Supabase read-only on prod project stsdtacfauprzrdebmzg, counts only, no personal data; no writes)
1. For EACH round 1 finding (numbers 1 to 20 in the r1 table, plus C4, C11, C14) say FIXED / PARTLY / NOT FIXED with the DRAFT 3 section that answers it. Judge whether the fix is correct, not only present. Special attention:
   - Finding 1 (D6): is the dedicated auto-resume function safe? Check on prod: what `_assert_can_edit_series_p5`, `tg_enforce_lifecycle_transition` and the lifecycle transition allowlist do for a postgres or definer caller; whether writing the status directly skips any trigger, audit row or version bump that a normal transition does; whether skipping `organiser_publish_gate_v1` is consistent with how service_role is exempted today.
   - Finding 2 (D2): any path left where a non-owner of the paying organiser learns a count, amount or night: error text, helper grants, snapshot fields, the S10 co-organiser case.
   - D7: dates either side of 2027-03-28 and 2027-10-31; catch-up for a missed run; idempotency key.
   - D8 and J17/J18: boundary values.
2. Tally section 9a and 9b yourself, cell by cell. The contract claims 147 cells (65 yes, 82 coded) and 280 cells (89 yes, 191 coded), GAP 0. Report your counts. Check that every code is TRUE for its cell (R3, R6, R8, R10, R11 especially) and list any cell that should be yes but is coded, or the reverse.
3. Re-run the prod survey (counts only) and compare with section 5; report differences.
4. Look for what DRAFT 3 introduced: new gaps, contradictions between sections (D1 vs D9, D2 vs S3 row, section 7 vs section 11), a GRANT list entry that does not match the function list.
5. If you cannot read the admin repo (round 1 could not), say so once and verify against deployed prod function bodies as round 1 did; do not repeat the file:line complaint finding by finding.

## Output
Write `docs/reviews/pause-series-contract-r2.md` on your branch: a table of the r1 findings with FIXED / PARTLY / NOT FIXED, a numbered table of NEW findings (BLOCK / FIX / NOTE, where, what is wrong, the exact change to the contract), then `VERDICT: PASS | PASS WITH FIXES | BLOCK`, then your matrix tallies. Do not edit the contract. Do not open a PR. Push once; last commit subject ends with the done marker from the ticket.
