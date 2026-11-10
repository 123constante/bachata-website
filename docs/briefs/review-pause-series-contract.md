# Brief: independent access-focused review of the pause-series acceptance contract (READ-ONLY review, different model from the author)

Branch: `claude/review-pause-series-contract` (review branch, no PR, no code). Author of the contract: website-50 (Sonnet). You are the independent reviewer.

## What to review
`docs/design/pause-series.CONTRACT.md` (DRAFT 2) against `docs/design/pause-series.INVENTORY.md` (both on `brief/review-pause-series-contract`). Feature: an organiser pauses a recurring or course series from the Website with an optional resume date; reminder; confirm on the resume day; auto-resume after 3 nudges; public banner. Owner decisions are binding (contract section 2). Lead constraints are in contract section 1.

## Method (read-only; Supabase read-only on prod project stsdtacfauprzrdebmzg, counts only, no personal data)
1. Verify every inventory claim you rely on against the repos (Website `123constante/bachata-website`, admin `123constante/bachata-admin-11april` on origin/main, not an old checkout): `_cmd_series_set_lifecycle_p5`, the owner allowlist, `_assert_can_edit_series_p5`, the 830000 paused visibility rule, ticket tables, cron patterns. Mark each CONFIRMED / WRONG / NOT FOUND with file:line.
2. ACCESS review (the focus): who can call pause, set resume date, resume, and read the sold-ticket count? Contributors/roster (contract O2: should they be refused?), admins, organiser of ANOTHER page, anonymous. Can a non-owner learn another organiser's sales through the refusal message? Any new function needs an explicit GRANT list; list what it must be (authenticated / service_role / anon) and what must NOT be granted. Does auto-resume bypass a permission or the publish gate unsafely? Can two organisers race (double pause, pause vs resume at the day boundary)?
3. DATA review: re-run the prod survey (status x format x rule-less x paid sales x past x upcoming x over the 100-row cap) and compare with contract section 5; flag any difference. Check the London-date logic for the resume day and DST.
4. COVERAGE: tally the section 9a and 9b matrices cell by cell; list every cell with no reason code as a GAP; check every N/A reason is true; list missing persons, journeys or shapes (for example: series paused by an admin then the organiser changes the date; resume date in the past; resume date before the next night; a series with all nights cancelled; course part-way through; organiser removed from the team while paused; paid order refunded after the pause).
5. SEQUENCING: confirm the DB slice must follow `claude/courses-owner-set-recurrence` and #1352 (S1a); list function signatures both touch.
6. Calendar density exclusions in the Website CLAUDE.md: confirm the planned Website files avoid them.

## Output
Write `docs/reviews/pause-series-contract-r1.md` on your branch: a numbered findings table (severity BLOCK / FIX / NOTE, file:line, what is wrong, the exact change to the contract), then a verdict line `VERDICT: PASS | PASS WITH FIXES | BLOCK`, then the tallied matrix counts. Do not edit the contract. Do not open a PR. Push once; last commit subject ends with the done marker from the ticket.
