# Handover: refunded-card-website (P2 Website slice)

Brief: `docs/briefs/refunded-card-website.md` on `brief/refunded-card-website`. Branch `claude/refunded-card-website`.

## Done
- `ticketCardStatus.ts` (the ONE mapping) extended: new `used` status (checked in), `ticketStatusTag`
  (Refunded / Used), `ticketStatusLines` (refunded = one line "GBP X refunded, usually 5 to 10 working
  days to reach your card"; cancelled = "This night was cancelled" + "The organiser will be in touch about
  refunds"), `partRefundLine` ("Part refunded GBP X"), `orderTicketList` (past dropped, soonest first,
  date-TBC after dated, greyed at the bottom). Refunded beats cancelled.
- `myTicketsModel.ts`: parses `refunded` and `order_refunded_pence` (absent on old replies = false / 0).
  Empty-state button now "Browse events" and styled as a button.
- `MyTicketsPage.tsx` (flag ON): one list in `orderTicketList` order, no Upcoming/Past sections, status tag,
  multi-line status, part-refund line; empty after dropping past = "No tickets yet" state.
- (Moved to the follow-up dancer PR) Tickets tab (`useTicketCard.ts`, `TicketCard.tsx`, `model.ts`): refunded rows (no QR) now reach the
  carousel (flag ON only), same list order, tag + lines + part-refund line.
- Tests: `src/modules/tickets/__tests__/refundedCard.matrix.test.tsx` (both surfaces x valid, used, used +
  part refund, cancelled, refunded, refunded + cancelled, refunded no amount, part refund, past, refunded
  past, empty; 27 fail on the unfixed code). Walk: `tests/e2e/walk-refunded-card.spec.ts`, shots in
  `docs/walk/refunded-card/`.

## Flag behaviour (unchanged flags)
Everything new is behind `VITE_ENABLE_BUYER_ONBOARDING` like the existing status mapping. With it OFF,
My tickets is as before, BUT my_tickets_v1 now also returns fully refunded tickets: those show as an
ordinary card with "QR code unavailable for this ticket..." under flag OFF. Owner call whether that matters
before the flag goes on.

## Left / next
- Owner phone check on a preview with the flag ON.
- Used card shows "Checked in at HH:MM" and "Already used at the door" (both kept; trim if the owner wants one).

## Gates
- tsc run on cc831c0: 0 errors in branch files (tsc -p tsconfig.app.json; 139 pre-existing errors elsewhere).
- PR: #1793. pre-ship was not finished as one run (timeout); its post-build steps were run individually and all pass.
