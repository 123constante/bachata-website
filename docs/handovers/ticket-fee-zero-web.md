# Handover: remove the 50p booking fee (Website half)

Brief: `docs/briefs/ticket-fee-zero-website.md` on `brief/ticket-fee-zero-web`.
Branch: `claude/ticket-fee-zero-web`. Ticket `dt_744be76ecc3a`.

## Done

- `src/lib/ticketBookingFee.ts`: `BOOKING_FEE_PENCE = 0`; comment says the server env
  `TICKET_BOOKING_FEE_PENCE` must be set to 0 (unset only once the admin-side default is 0,
  because unset means 50 today).
- Buyer checkout (`TicketsBlock.tsx`): the "+ fee per ticket" line renders only when
  `feePence > 0`. `totals()` is unchanged code and now returns `feePence: 0`, Total == subtotal.
- Terms of sale (`legalCopy.ts`): fee sentence left out and refund sentence has no fee clause
  while the fee is 0 (the 50p-era approved wording is kept behind `BOOKING_FEE_PENCE > 0`).
  Before/after wording is in the PR body under "LEGAL COPY CHANGED (owner to confirm)".
- Organiser (`ticketModel.ts`, `SeriesTickets.tsx`): add-sheet preview line is
  "The ticket price, nothing added" (paid) / "Free" (free); event rules line is
  "Buyers pay the ticket price, up to 20 tickets an order."; refund question says
  "booking fee included" only for an order that actually carried a fee (prod has 3 such
  refunded orders from the 50p era).
- Tests: new `src/modules/tickets/__tests__/feeZero.matrix.test.tsx` (real constant, no mock:
  totals over 6 prices x 4 quantities, buyer block x paid 1/2/20/capped/free/mixed/sold out,
  terms), plus fee-zero blocks in organiser `screens.matrix.test.tsx` and `compact.model.test.ts`.
  Red first: 39 of them failed on the unfixed code. 50p-era assertions in the existing suites
  updated. `bookingFee.shared.test.tsx` (mocked 75p) still proves a non-zero fee renders.
- Docs: the two journey docs updated; historical handovers under `docs/handover/` left as
  records of what shipped at the time.
- Phone walk (390x844, throwaway harness, not committed): screenshots in
  `docs/handovers/ticket-fee-zero-web/`.

## Left / next steps (orchestrator)

1. Flip the ticket-checkout edge function secret `TICKET_BOOKING_FEE_PENCE` to `0` AFTER this
   merges (the server already sends no `application_fee_amount` at 0). Until then a buyer would
   see Total = ticket price but Stripe would charge 50p more per ticket: merge and flip together.
2. Owner to confirm the changed terms-of-sale wording (PR body).
3. Pre-existing reds not from this PR (identical on `main`): `/app` first-load 374.1 KB vs 374 KB
   budget; `tests/integrityCouldNotRun.test.ts` (5 tests, sandbox-only); typecheck 97 errors.
