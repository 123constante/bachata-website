# T4 buyer: basket wire with expected prices, "price rises on <date>", "price changed, confirm"

Repo: Website. Branch `claude/ticket-t4-buyer`. Lane: careful (money). One branch, one PR, behind a flag. Do not merge.
Read first: `docs/briefs/design-ticketing-organisers.md` s.3a, s.3b, s.3c, s.3d, s.5 "T4", s.6 (contract rows), s.8.
Admin issue (contract): bachata-admin #1437. T1 and T2 are live on prod (edge `ticket-checkout` v23 has the v5 path; `ticket_types_public_v3` exists). Edge, DB and migrations are NOT in scope.

## Files (as of origin/main)
- `src/modules/tickets/ticketCheckoutApi.ts`: `fetchPublicTicketTypes` (:50, reads `ticket_types_public_v2`) -> `ticket_types_public_v3`; `postTicketCheckout` (:91) body.
- `src/modules/tickets/ticketCheckoutModel.ts`: `PublicTicketType`, `parsePublicTypes` (:58), `totals` (:174), `BOOKING_FEE_PENCE`.
- `src/modules/tickets/TicketsBlock.tsx`: `payPence` (:207, `pv.appliedTotalPence + sum.feePence`), fee row (:414), buy button (:582), `REASON_COPY`.
- Also check `FestivalTicketsPage.tsx` / `EventTicketsPage.tsx` for other checkout posts, and tests under `src/modules/tickets/__tests__/` (feeZero, bookingFee.shared, checkoutFixes matrices).

## Build (smallest working version)
1. Flag `ticketPriceSteps` (same mechanism as the other site flags). OFF: byte-for-byte the current behaviour. ON: everything below.
2. Wire: post the BASKET shape `lines[]`, each with `expected_unit_price_pence` (the unit the buyer saw, post-step price from v3), plus `expected_total_pence` = exactly the pay-button total. Free ticket: unit 0 on every line, total 0. Integers only.
3. Fee rule: `fee = net > 0 ? BOOKING_FEE_PENCE x quantity : 0` on the post-discount amount, replacing `pv.appliedTotalPence + sum.feePence`. A 100% code sends total 0.
4. Read `ticket_types_public_v3`; parse `next_price_pence` / `next_price_at` (both null when no step). Types sorted by effective price (the RPC orders them; do not re-sort). Show on the card "price rises on <date>" (or "price changes on <date>" when it drops), date en-GB built on the client in Europe/London (DST-correct; test a date across a clock change).
5. `price_changed` reply (`lines[]` with `new_unit_price_pence`, `new_total_pence`): re-render the basket with the new prices and show "The price changed while this page was open. New total: <total>. Check and pay again." with a "Price changed, confirm" button. Nothing is charged until the buyer taps it; confirming resends with the NEW expected values. If a refusal such as `below_minimum` follows, show its normal copy.
6. `expected_price_required` copy: "Please reload the page and try again." (old open tabs after T2b.)
7. Course (whole-course ticket): same flow. No prod course rows: tests + fixtures only.
8. Empty/loading/error states stay actionable; disabled controls say why; no copy pointing at a missing control.

## Tests (table-driven, screen x shape, red first)
Matrix: no step / future step up / future step down / free / promo % / promo 100% with fee / fixed promo larger than unit / stale page (price_changed at unit, at total) / old tab (expected_price_required) / course fixture. Assert the exact request body for each. Flag OFF = old body. Mutants to prove: expected total built from the pre-discount sum; fee charged on net 0; re-sending the OLD expected values after confirm.
Prod shape (read-only, say so in the PR): 19 paid types, 0 steps; so the real-data walk is "no step" and the stepped case is a fixture.

## Walk
390x844 and 360x640 on a stepped fixture and on an unstepped real-shape event: card shows the rise line, stale-page confirm state, 100% code. Screenshots in the PR only.

## Review
Money: an independent review posted as a PR comment (not a review PR). Per-job CI table in the PR. Verified / Not verified block. No migrations, no `supabase/**`, no workflows, no `.env*`.
Out of scope: step editor (#1436), T2b revokes, edge changes.
