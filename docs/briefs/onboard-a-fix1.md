# Fix round 1: PR #1763 (branch claude/onboard-a), review BLOCK

Work on `claude/onboard-a` (head 3bfe74e2d). Read the review first: `git fetch origin claude/review-onboard-a-1763` then `git show FETCH_HEAD:docs/review/onboard-a-1763.md`. Flag stays OFF; flag-OFF behaviour must stay identical to main.

Fix, with a test row for each (tests must fail on the old code):
- H1: `ticketCardStatus.ts` passed rule: ticket stays valid until the night is really over. Use the after-midnight rule in `src/lib/programDayRollover.ts` (00:00-08:00 belongs to the previous day). Rows: 00:30 the morning after = valid; 09:00 the morning after = passed.
- H2: `useTicketCard.ts:73` / `TicketCard.tsx:39-41`: remove the "under another email" claim. Show the existing neutral line ("Your tickets are in your email") whenever the QR read is empty. No new cause claims.
- H3: `TicketPickerB1.tsx` `notYou()`: if `signOut()` returns `'failed'`, show a plain line "We could not sign you out. Try again." and do not open the empty email card; disable the button while it runs. Test row for `'failed'`.
- Nits, cheap ones: N1 restore `??` at TicketPickerB1.tsx:78; N3 add the basket-survives assertion in pickerNotYou.test.tsx; N6 use the same `isOrderId` test in TeaserScreens.tsx:72; N9 move the stray import up; N5 fix the fake in ensureProfile.matrix.test.ts to `created: false` + expect `no_profile`. Skip N2, N4, N7, N8.
- If the allow-list seams change, run `node scripts/check-dancer-area-isolation.mjs` and its `--self-test`.

Update docs/handover/onboard-a-slice-a.md (what changed, Not verified). Push to claude/onboard-a (final push NOT [skip preview]). Update PR #1763 body only if labels need it (run the two PR-body checks).
