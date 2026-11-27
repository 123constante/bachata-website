# Brief: acceptance-contract-r1-fix (WEBSITE docs only, Opus, ONE fix round on PR #1259). Branch claude/acceptance-contract-r1 (continue it; never push another).

Context line: stay under 35% of your context; push + handover by 50%. Never merge/approve/--no-verify. Plain git only. Supabase READ-ONLY (counts only). Docs only.

Independent review (BLOCK, fix to PASS WITH NITS): `git fetch origin claude/review-acceptance-contract-r1` then `git show FETCH_HEAD:docs/review/acceptance-contract-r1.md`. Apply, nothing else, in docs/acceptance/CONTRACT.md, INVENTORY.md and your handover:
B1. Public claim: add a C15 row per refusal of the live claim_organiser_v1 (no_contact_email, not_live, organiser_already_claimed, email_mismatch; re-read the body from prod read-only), a new shape S19 "no claim e-mail" with the re-surveyed count (review found 45 of 50 pages; 35 of 37 ownerless pages cannot use the public card), and rank it the top GAP by count. State what the page does today on those pages.
B2. Re-check every COVERED row against its cited test (open the file, read describe/it names). Re-mark C36, C44, C32, C25 GAP; fix the cited files for C52, C53, C55, C33; name a real test for C29 or mark GAP. Do not leave a COVERED row without an assertion you have read.
B3. Cite or add rows for J14, S03, S09, S16 and the J07/J12/J13/S13 IDs; add the redeem `already_member` contributor case and the `link_failed` e-mail-page invite case. Make the "none silently omitted" count true (recount, show the arithmetic).
N1 split S01 (weekly 28, monthly 6, custom 1, no rule 10) and add a shape row for the Repeat sheet on custom/no-rule series. N2 re-mark C31 COVERED in P3 (allDates100.matrix.test.tsx). N3 rank contributor rows by reach 0. N4 re-rank by counts. N5 re-run the counts and state the date. N7 mark Q2 OWNER-PHONE.
Run `npm run lint` on docs. Handover docs/handover/acceptance-contract-r1.md updated with Verified / Not verified. Commit subject ends [worker-done <ticket>].
