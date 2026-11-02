# Handover: acceptance-contract-r1 (docs only)

Branch `claude/acceptance-contract-r1`, PR #1259. Briefs: `docs/briefs/acceptance-contract-r1.md` (r1) and
`docs/briefs/acceptance-contract-r1-fix.md` (fix round), both on their `brief/...` branches. Review:
`docs/review/acceptance-contract-r1.md` on `claude/review-acceptance-contract-r1` (BLOCK). The fix round applies B1-B3 and
N1-N5 and N7. N6 needed no change.

## Done (fix round, 2026-11-02)
- **B1.** Re-read the live `claim_organiser_v1`. Added C15 (success) and C15a-d, one row per refusal: `no_contact_email`,
  `not_live`, `organiser_already_claimed`, `email_mismatch`. Added shape S19 "no claim e-mail" (45 of 50 pages; 35 of 37
  ownerless pages). C15e states what the card does on those pages today: it is not hidden; signed in, it offers
  Request access to the Bachata Calendar team. C15e is the rank-1 GAP.
- **B2.** Opened every COVERED cite and read its it/test names and assertions (C01-C06 and C09 rely on the review's line
  check). C36, C44, C32 and C25 are now GAP. Cites fixed for C52, C53, C55, C33 (and C35, C07, C10, C16, C20-C24, C58,
  C60, among others). C29 now cites `pdates.flow.test.tsx:329`. Where only part of a row is asserted, the row carries a
  part GAP: C08, C11, C23, C26, C40, C41, C57, and C59 (all GAP).
- **B3.** Added rows C19 (J14), C39 (S03), C39b (S09), C03b (contributor `already_member`) and C09b (`link_failed`). J07,
  J12, J13 and S13 are cited by ID, and S16 is tied to C15e. CONTRACT section 4 maps all 65 inventory IDs to rows and
  shows the arithmetic: 28 GAP + 1 OWNER-PHONE + 36 COVERED = 65 rows.
- **N1.** S01 is split into S01a weekly 28, S01b monthly 6, S01c custom 1 and S01d no rule 10. C28b is the Repeat sheet
  on custom and no-rule series.
- **N2.** C31 is COVERED in P3 (`allDates100.matrix.test.tsx`) and stays a GAP in R1.
- **N3/N4.** GAPs are re-ranked by organiser pages reached. Contributor rows rank 12 (reach 0). C12 ranks 11 (0 of 4 open
  invites go to an owned page).
- **N5.** Counts re-run on 2026-11-02: 50 pages, 37 ownerless, 1 with no member, 16 invites, 1 revoked, 0 contributor
  rows. Distinct pages per series shape were added.
- **N7.** Q2 is marked OWNER-PHONE.

## Verified
- Prod `stsdtacfauprzrdebmzg`, read-only SELECT only (counts and function bodies, no personal data), 2026-11-02:
  - the `claim_organiser_v1` body;
  - the `already_member` and `link_failed` lines of `redeem_organiser_invite_v1`;
  - page, owner, claim-evidence, invite and member counts;
  - series by lifecycle x format x rule mode;
  - distinct pages per shape.
- Every COVERED cite was opened at the cited line or `describe`/`it` name (part delegated to a read-only sub-agent and
  merged by hand).
- `npm run lint`: 24 of 24 links green (whole-tree eslint is informational, as on main).

## Not verified
- No test was run. COVERED means the assertion was read, not executed.
- No browser walk at 390x844.
- Prod flag values (`organiserP3`, `organiserSelfServe`, `organiserTicketing`) are unknown (G-INV-6).
- Where a Request access from a no-claim-e-mail page lands, and whether anyone acts on it, was not traced in the admin repo.
- The `link_failed` seat outcome comes from the review's reading plus a partial body read. The full branch was not
  traced.
- How many series carry prices was not counted (C25 shows an upper bound).
- The 320 px coverage of `organiser-layout.spec.ts` was not checked.

## Checks (PR #1259, fix-round push 645efbc)
At hand-off these were green: integrity, e2e-smoke, live-db-gate, bundle-budget, real-data-verified, phone-qa-section,
unit (New York), dancer-area-isolation, wallclock-brand, bom-check, masking-check. Still running: unit (London,
Sydney) and notification-check. The preview-gated jobs were skipped (`[skip preview]`). The final push re-runs everything.

## Next
1. The owner decides C15e: add claim e-mails to the 35 pages, issue invites, or change the card. The owner also decides
   C12, C17 and the C26 R1 cancel-reason conflict.
2. The independent reviewer re-checks B1-B3.
3. Build tests for the GAP rows in rank order.
