# Brief: partial refund amount on the organiser Refund sheet (order stays paid, tickets stay valid)

Brief-version: 2
Branch: claude/ticket-partial-refund-ui
Lane: careful (money), Opus builds, a different model reviews. Website repo only. No migration, no edge change. Must not touch the calendar density-exclusion files, perf-budgets.json or vite.config.ts.
Serves: an organiser who needs to give part of the money back (e.g. a late-cancel fee kept) without voiding the buyer's tickets. Arc row: docs/arcs/ticketing.md "Slices not yet briefed" -> Partial refund UI (owner decision Q5).
HOLD: dispatch only after admin #1283 (ticket-refund partial amounts) is deployed. Check first: `grep: amount_pence` in supabase/functions/ticket-refund/index.ts on admin main, and that the edge function version live answers a partial call (lead checks; the worker does not call prod).

## What main lacks
- RefundSheet only refunds whole orders; no amount field -- grep: amount in src/modules/organiser/p3/tickets/RefundSheet.tsx (none)
- extends: refundOrder(orderId) sends only order_id; it must optionally send amount_pence and a request_id -- src/modules/organiser/tickets/ticketsApi.ts:249
- the model has no partial-refund rules (parse pounds, bounds, copy, new reason words) -- grep: refund_exceeds_balance in src/modules/organiser/tickets/ticketModel.ts (none)
- the server reason words request_id_required, request_id_reused, invalid_amount, refund_exceeds_balance, not_refundable are unmapped in REASON -- src/modules/organiser/tickets/ticketModel.ts

## Files
- src/modules/organiser/tickets/ticketModel.ts
- src/modules/organiser/tickets/ticketsApi.ts
- src/modules/organiser/p3/tickets/RefundSheet.tsx
- src/modules/organiser/p3/tickets/__tests__/refundPartial.matrix.test.tsx
- docs/design/ticket-partial-refund-ui.md (new)

## Server contract (verified on admin origin/main, supabase/functions/ticket-refund/index.ts and _shared/ticketingHandlers.ts:478-640)
- Body: `{ order_id, amount_pence?, request_id? }`. amount_pence absent = whole refund (today's behaviour, unchanged: voids tickets, reopens places).
- amount_pence present: positive safe integer, at most totalPence - refundedPence (server re-reads the order). request_id REQUIRED with it, 8-64 chars of [A-Za-z0-9_-], generated ONCE per button press and REUSED on every retry of that press (idempotency key). A new press = a new id.
- Partial answer: `{ ok: true, refunded: false, partial: true, amount_pence, remaining_pence, clears_balance }`. The order row is written by the charge.refunded webhook, not by this call, so the list does not change at once: say "Refund of GBP x started" and let the normal reload show refundedPence.
- Reasons to map in plain words: invalid_amount (carries remaining_pence), request_id_required (a bug: never shown raw), request_id_reused (same press, different amount: "Start the refund again"), refund_exceeds_balance (carries a message: show it), not_refundable, plus the existing ones.

## What to build
0. Write INVENTORY.md first: every field, state and option of the Refund sheet and order row today (Website, with file:line), what the admin app offers for refunds, and every order shape the sheet meets. Report the coverage count at the end.
1. Sheet: a choice "Whole order (GBP x, tickets stop)" vs "Part of it". Default stays the whole order, so an untouched sheet sends exactly what it sends today (no amount_pence, no request_id).
2. "Part of it": one pounds field (inputMode decimal, up to 2 dp, accepts "5" "5.5" "5.50", rejects 0, negatives, more than remaining, text). Helper text states the remaining amount and that tickets stay valid. Confirm button reads "Refund GBP x" with the typed amount; disabled with a reason while the field is empty or invalid. Typing exactly the remaining amount is still sent as a partial (the server decides; the webhook flips the order).
3. Copy for partial must not say tickets stop or places reopen. Whole copy unchanged.
4. Orders with refundedPence > 0 and status paid (earlier partial refunds): show "GBP y already refunded" and cap the field at the remaining amount; the whole-order option says it refunds what is left.
5. One request_id per press kept in a ref, reused if the same press is retried after a network error, regenerated after any settled answer. Never log it or the reply.
6. Pure parsing and bounds live in ticketModel.ts (one shared mapping); the sheet only renders them.

## Tests
Table-driven, red first: order shape (paid whole, paid with prior partial refund, 1 ticket, 5 tickets, booking fee, GBP 0.50 remaining, huge, refunded, disputed, free) x mode (whole, part) x input (empty, "5", "5.5", "5.555", "0", "-1", "abc", over remaining, exactly remaining) x server answer (ok partial, each reason word, network failure). Assert the exact body sent (untouched whole refund has no amount_pence and no request_id), retry reuses the id, a settled answer rotates it, no copy points at a missing control, disabled controls state why. Overlay geometry e2e at 390x844: the sheet, field, keyboard-open confirm button and toast stay inside the viewport and opening the sheet does not scroll the page.

## Done when
Run `npm run check:bundle-budget` on main and the branch: 0 bytes added to dancer-app first load. Walked at 390x844 on a prod-shaped account (paid order, order with a prior partial refund, refunded order) with a stubbed edge reply; screenshots in the PR; design record linked; Verified / Not verified block. Stripe live mode is never touched; test mode only.
