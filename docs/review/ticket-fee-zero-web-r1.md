# Review r1: PR #1135, remove the 50p booking fee (Website half)

Independent, read-only review (Fable; the builder was another model). Branch `claude/ticket-fee-zero-web`
at `17e8465` against `main` at `95a8dce`. Brief: `docs/briefs/ticket-fee-zero-web-review.md` on
`brief/ticket-fee-zero-web-review`. No src changed; no Supabase call made. One round.

## Verdict: FIX FIRST

One block: the P3 organiser tickets sheet (`src/modules/organiser/p3/tickets/TicketsEntry.tsx:315`,
behind `organiserP3`, shipped in #1132) still renders "Buyers pay a 0p booking fee per paid ticket"
and its matrix test is red on the PR head (`unit (Europe/London, full)`: 7 failed). The rest holds:
the buyer total equals the ticket price for every price x quantity shape; the 50p-era terms wording
is intact behind the gate; the refund sheet names the fee only when the order row carried one. Two
should-fix items are about the merge window and the "APPROVED" stamp on unapproved wording.

## Findings

### F0 (block) P3 organiser sheet says "Buyers pay a 0p booking fee"; CI red on the PR head

`src/modules/organiser/p3/tickets/TicketsEntry.tsx:315` (untouched by the diff):
`{eventDateLine(series)}. Buyers pay a {feeLabel(BOOKING_FEE_PENCE)} booking fee per paid ticket, up to {MAX_PER_ORDER} tickets an order.`
With the constant at 0, `feeLabel(0)` is `"0p"`, so an organiser with `organiserP3` on opens the
tickets sheet and reads "Buyers pay a 0p booking fee per paid ticket". Same sentence as the legacy
`SeriesTickets.tsx:191-193`, which the PR did gate; this copy was not.

Evidence: PR #1135 check run `unit (Europe/London, full)` on `17e8465` = **failure**, 7 failed /
18991 passed, all seven at `src/modules/organiser/p3/tickets/__tests__/tickets.matrix.test.tsx:52`:
expected "Buyers pay a 50p booking fee...", received "Buyers pay a 0p booking fee...". The handover's
"pre-existing reds, identical on main" list does not include this one, and it is not: it fails
because of this PR's constant. Note my own grep sweep (item 1 below) also missed this file; the
CI caught it.

Suggested fix (in #1135, two files): mirror the gate from `SeriesTickets.tsx:191-193` at
`TicketsEntry.tsx:315` ("Buyers pay the ticket price, up to 20 tickets an order." at 0), and change
the expectation at `tickets.matrix.test.tsx:52-54` to the zero-fee sentence (ideally via the same
`BOOKING_FEE_PENCE > 0` branch so the test follows the constant). Better still, hoist the rules
sentence into `ticketModel.ts` as one `rulesLine()` so the two screens cannot drift again. Re-run
`npx vitest run src/modules/organiser/p3/tickets` and the full `unit` job before re-requesting.

### F1 (should-fix) Merge window: the PR cannot shrink it, so flip the secret FIRST, not after

`src/modules/tickets/ticketCheckoutModel.ts:187-194` (`CheckoutBody`): the client sends
`ticket_type_id`, `quantity`, `buyer_email`, `buyer_name?`, `success_url`, `cancel_url`. No expected
total, no fee, so the server cannot detect a client/server fee mismatch and refuse.

Scenario, in the brief's order (merge + deploy, THEN secret to 0): a buyer picks 2 x GBP 12.50.
The block shows `2 x Type a GBP 25.00 / Total GBP 25.00` (`TicketsBlock.tsx:262-277`, fee line
hidden by `sum.feePence > 0`). Stripe Checkout, built by the v7 edge function with the env unset
(= 50), lists the 50p per-ticket fee and charges GBP 26.00. The terms the buyer ticked
(`legalCopy.ts:19-30`, HAS_FEE false) say nothing about a fee. That is an under-stated total plus
terms that do not mention the charge, for every paid order in the window.

The reverse order is safe: with the secret at 0 and the OLD client still deployed, the block shows
GBP 26.00 and Stripe charges GBP 25.00 (server sends no `application_fee_amount` at 0). Over-stated
is a surprise in the buyer's favour. Suggested fix (orchestrator, no code): set
`TICKET_BOOKING_FEE_PENCE=0` on the edge function BEFORE this PR's Vercel production deploy, not
"right after merge". The handover (`docs/handovers/ticket-fee-zero-web.md:34-36`) says "merge and
flip together"; it should say "flip, confirm one GBP 0.01 or test-mode checkout shows no fee, then
merge".

### F2 (should-fix) `LEGAL_COPY_STATUS = 'APPROVED'` now stamps wording the owner has not approved

`src/modules/tickets/legalCopy.ts:14` keeps `LEGAL_COPY_STATUS = 'APPROVED' as const`, and
`ticketCheckoutModel.matrix.test.ts:194` asserts it. The header (`legalCopy.ts:5-7`) says the
zero-fee result is "owner to confirm". The two statements disagree: the status constant exists so a
reader (and the test) can tell approved wording from draft, and today it says approved for a
refund sentence the owner has never seen. Scenario: a later session trusts the constant, skips the
owner, and ships further edits on top. Suggested fix: either get the owner's confirmation in the PR
thread and cite it in the header before merge (then the constant is true), or set the constant to
`'PENDING_OWNER'` for the zero-fee branch and update the one assertion. Either is a one-line change.

### F3 (nit) Refund wording trusts `booking_fee_pence` alone for the three 50p-era orders

`src/modules/organiser/tickets/ticketModel.ts:370`: `o.bookingFeePence > 0 ? ', booking fee included' : ''`.
`ticketsApi.ts:138` maps the column through `num()` (`ticketModel.ts:148`), which turns null or a
non-numeric value into 0. If any of the three prod orders that carried a fee has a null
`booking_fee_pence` (not checked here; the brief forbids Supabase from this seat), its refund sheet
would say "GBP 21.00 goes back." with no fee clause, while GBP 21.00 is in fact GBP 20.00 + GBP 1.00
fee. Nothing is mis-refunded (the edge function refunds the whole order), only mis-described.
Suggested fix, if the column can be null: `(o.bookingFeePence > 0 || o.totalPence > o.subtotalPence)`.
If the column is NOT NULL DEFAULT 0 in admin's schema, close this as no change.

### F4 (nit) 480 KB of PNG screenshots committed under `docs/handovers/`

`docs/handovers/ticket-fee-zero-web/qa-0{1,2,3,4}-*.png` (80 KB, 264 KB, 69 KB, 73 KB). In scope for
the handover, but binary weight the repo carries forever; prior handovers link screenshots or keep
them out of the tree. Suggested fix: drop `qa-02-terms.png` at least (264 KB, a wall of text that
the terms test already proves), or move all four to the PR body.

### F5 (nit) `BOOKING_FEE_LABEL` is now the string `"0p"`

`src/modules/tickets/ticketCheckoutModel.ts:75-76`: `feeLabel(0)` is `"0p"`. Every reader is gated
(`TicketsBlock.tsx:267`, `legalCopy.ts:22`), so it never renders. Harmless today; a future ungated
use would print "0p booking fee". No change needed; noted so the next reader does not have to check.

## Brief items, with evidence

1. **Where a fee is shown or computed.** Non-test src hits for `BOOKING_FEE|feePence|booking fee|
   application_fee|50p|\bfee\b` (the `50px` CSS hits excluded): `src/lib/ticketBookingFee.ts:15`
   (the constant, 0); `ticketCheckoutModel.ts:76,129-130` (label, `totals()`); `TicketsBlock.tsx:267-271`
   (fee line, gated); `legalCopy.ts:12,22-28` (terms, gated); organiser `ticketModel.ts:370`
   (refund, per-order), `:429-436` (`buyerTotal`, gated), `:562-567` (`orderLine`, shows
   `totalPence / quantity`, so a 50p-era order reads "2 x GBP 10.50", correct and fee-word-free);
   `SeriesTickets.tsx:191-193` (rules line, gated); `ticketsApi.ts:85,138,152` (reads the DB
   columns, not displayed except through the two above; `bookingFeesPence` is summed in
   `ticketModel.ts:196` and rendered nowhere). `TicketThanksPage.tsx`, `RefundSheet.tsx`,
   `TypeSheet.tsx`, `parts.tsx`, `TicketsHome.tsx`: no fee words. Emails are server-side (admin
   repo), not reviewable here. **Missed by this sweep and caught by CI: `src/modules/organiser/p3/
   tickets/TicketsEntry.tsx:315` (F0), an ungated copy of the rules sentence.** Docs: only `docs/ticketing-buyer-journey.md` and
   `docs/organiser-ticketing-journey.md` mention the fee and both are updated; `docs/handover/*` and
   `docs/review/ticketing-checkout-1063.md` keep 50p as history. **One place still assumes a fee at 0: F0.**
2. **Total == price.** `totals()` (`ticketCheckoutModel.ts:126-131`): `feePence = free ? 0 : 0 * q`,
   `totalPence = subtotal + 0`. Covered by `feeZero.matrix.test.tsx:50-60` (6 prices x 4 quantities,
   incl. 0p, 1p, 99p, GBP 2,022.50 x 20) and the rendered block at `:62-94` (paid x1, x2, x20,
   capped at 3 left, free, mixed free-sold-out + paid, sold out only). The rendered assertion is the
   exact `textContent` `"<q> x <name><sum>Total<sum>"` with exactly two `<dt>`, so a stray fee line
   cannot pass.
3. **Terms wording.** Before (main `legalCopy.ts:17,19`):
   > Paid tickets carry a booking fee of 50p per ticket. This fee is ours and pays for running the ticketing service. Free tickets have no fee.
   > Refunds are up to the organiser. If the organiser gives you a full refund, the booking fee is refunded too. If the event is cancelled, contact the organiser.

   After, at 0 (`legalCopy.ts:22-24,26-28`): the first sentence is omitted entirely; the second is
   > Refunds are up to the organiser. If the event is cancelled, contact the organiser.

   The other five paragraphs are byte-identical. Non-zero path: both 50p-era strings are kept
   verbatim behind `HAS_FEE` with the amount from `BOOKING_FEE_LABEL`; `bookingFee.shared.test.tsx:36,56`
   mocks the constant to 75 and asserts "a booking fee of 75p per ticket." renders in the terms, so
   the wording is reachable and still passes (7/7).
4. **Refund wording for fee-bearing orders.** `refundQuestion` (`ticketModel.ts:364-373`) adds
   ", booking fee included" iff `o.bookingFeePence > 0`, per order, not per constant. Tests:
   `screens.matrix.test.tsx:665-675` (fee 0 -> no fee words; default fixture `bookingFeePence: 100`
   -> "booking fee included"). No case describes a fee-bearing order as fee-free or the reverse,
   subject to F3 (null column).
5. **Tests.** On the branch: `npx vitest run src/modules/tickets src/modules/organiser/tickets`
   = 12 files, **1512 passed, 0 failed** (`feeZero.matrix.test.tsx` 34, organiser
   `screens.matrix.test.tsx` 108, `compact.model.test.ts` 122, `bookingFee.shared.test.tsx` 7).
   Red-first: with the seven non-test src files restored to `main` and the branch's tests kept,
   the three files with new or changed fee assertions gave **62 failed / 202 passed** (feeZero 28,
   organiser screens 26, compact 8). The handover's "39" counts differently but the direction holds.
   Pass-either-way cases in `feeZero.matrix.test.tsx`: 6 of 34 (`0p x {1,2,5,20}`, `free`,
   `sold out only`): a free ticket never had a fee, so these guard the free path, not the change.
   `expect(s.totalPence).toBe(s.subtotalPence)` at `:56` is implied by `:55` and `:57`; redundant,
   not vacuous. Organiser `screens.matrix.test.tsx:674` ("still says the fee goes back") passes on
   old code by design (regression guard for F3's branch). No assertion is vacuous in the sense of
   proving nothing.
6. **Merge-ordering risk.** See F1. Shown: Total = price (fee line hidden, terms silent on a fee).
   Charged: price + 50p per ticket. No PR-side change shrinks the window: the wire body carries no
   total, and the server's fee comes only from its env. Only the flip order shrinks it (flip first).
7. **Out of scope in the diff.** None in src (the gap is a file the diff should have touched and
   did not, F0). `docs/handovers/ticket-fee-zero-web.md` and the four
   PNGs (F4) are the handover. Comment-only edits in `ticketsApi.ts:247`, `ticketCheckoutModel.ts:10-11`,
   `ticketModel.ts:153,421` are all about the fee.

## Verified

- Full diff `95a8dce...17e8465` read (20 files, +251/-33).
- Grep sweep of `src/**` for every fee term; every hit traced to a `> 0` gate or a per-order field.
- `npx vitest run src/modules/tickets src/modules/organiser/tickets` on `17e8465`: 1512/1512.
- Red-first on `main`'s src with the branch's tests: 62 failures in the three fee files.
- 50p-era terms wording reachable at a non-zero constant (`bookingFee.shared.test.tsx`, 75p).
- Wire body (`CheckoutBody`) has no total or fee field.
- CI on PR #1135 head `17e8465` (check runs read via the GitHub API): `unit (Europe/London, full)`
  **failure** (F0); `real-data-verified` failed on the first push then passed after the PR body was
  edited; `build-smoke`, `integrity`, `contract-check`, `bundle-budget`, `e2e-smoke`,
  `dancer-area-isolation`, the two tz-sensitive `unit` jobs, `masking-check`, `notification-check`,
  `bom-check`, `phone-qa-section` all success; the preview-only jobs skipped (`[skip preview]`).

## Not verified

- Prod `ticket_orders.booking_fee_pence` nullability and the three 50p-era rows (F3): no Supabase
  call from this seat, per the brief.
- The `ticket-checkout` v7 edge function body, its default when the env is unset, and the emails:
  admin repo, not in this tree. The "unset means 50" claim is taken from the brief.
- The four screenshots were not re-walked in a browser; the rendered assertions in
  `feeZero.matrix.test.tsx` stand in for the 390x844 walk.
- The `unit (Europe/London, full)` job log was read only for its failing assertions (tail); the
  full 19,013-test run was not reproduced locally (the two tickets directories were).
