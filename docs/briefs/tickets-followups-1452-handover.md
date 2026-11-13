# Tickets follow-ups #1452 — handover

## Survey (file:line, before the fix)
Money (all via `formatPence`, `ticketModel.ts` ~247, which printed `£12.00`):
GetPaid.tsx:49,50,63,286; SalesReport.tsx:71,76,87,91; TypeSheet.tsx:356; ticketModel.ts refundQuestion/refundAmountError/refundPartQuestion/partialRefundDone/refundMaybeSent/orderLine; promoModel.ts; priceSteps.ts.
Going: one string only on this screen, `goingCountLine` (ticketModel.ts:99) rendered at TicketsEntry.tsx `tix-going-count`. It said "Going: 7 people are going to the next 2 dates" (taps counted as people; own wording).

## Done
- `formatPence`: whole pounds print whole (`£12`), a real part-pound keeps two digits (`£10.50`). Raw minor units appear nowhere on screen.
- `goingCountLine` now uses `organiserTotalText` from `goingCopy` (the one Going source): "7 going across 2 nights. Free event: no money is taken here."
- Part-refunded paid order: tag "Part refunded" plus note "£X of £Y has been refunded. The tickets still work." (`orderTagFor`, `partRefundedNote`; owner only, honours pending refunds).
- New table test `tickets.moneyGoing.matrix.test.tsx` (role x order shape: paid, part-refunded, free, huge, empty). Red first: 17 of 23 failed on unfixed code.
- Existing tests updated from `£N.00` to `£N`.

## Decisions to check
- Brief says "no pence figures": read as no `.00` / no minor units. Genuine part-pound amounts (booking fee 75p, £10.50 part refund) still show their pence; rounding them would lie about refunds. Owner may want otherwise.
- CSV column "Refunded (pence)" (owner download) untouched: not on screen, and changing it would alter a data export.
- A manager's read carries no pence, so a manager cannot see a part-refunded note (no data); manager orders still say "Paid".

## Left
- 390x844 browser walk and screenshots (not done).
- Pre-existing red: `check:no-social-word` on src/modules/tickets/__tests__/priceSteps.matrix.test.tsx:32 (not touched here).
- tsc: 145 errors repo-wide, none in the files changed here.
