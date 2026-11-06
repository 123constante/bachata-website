# Ticketing: partial refund amount on the organiser Refund sheet (CAREFUL-ish: NORMAL lane, MONEY path, no database change)

Brief-version: 2
Branch: claude/ticket-partial-refund-ui (from main). One push. Lane normal but money-careful: model=opus, context cap 45%, a different model reviews before the PR. No `supabase/**`.

## Decisions
Owner Q5 (2026-10-27, plans/ARC-ticketing.md): a partial refund keeps the tickets valid and the order stays `paid`; only a whole refund voids tickets. Q15: only owner / manager refunds (unchanged). Admin PR #1283 is merged and the deployed `ticket-refund` function accepts the new fields (lead verified). Contract (admin `supabase/functions/ticket-refund/index.ts`): body `{ order_id, amount_pence?, request_id? }`. No `amount_pence` = whole refund, today's call, unchanged. With `amount_pence` (integer pence) `request_id` (8-64 chars `[A-Za-z0-9_-]`) is REQUIRED: one per button press, reused on a retry of the same press (idempotency key). Replies: whole `{ok:true,refunded:true}`; partial `{ok:true,refunded:false,partial:true,amount_pence,remaining_pence,clears_balance}`; refusals `{ok:false,reason}` with reasons `invalid_amount` (also carries `remaining_pence`), `request_id_required`, `request_id_reused`, `not_refundable`, `refund_exceeds_balance` (with a `message`). The order row is written by the `charge.refunded` webhook, so `refundedPence` updates a moment after the call.

## What main lacks
- `refundOrder` takes only an order id and never sends `amount_pence` or `request_id` -- grep: partialRefundRequest
- No per-press idempotency key helper on the client -- grep: newRefundRequestId
- No amount field, partial/whole choice or amount validation on the Refund sheet -- grep: refundAmountError
- `REASON` has no words for `invalid_amount`, `request_id_required`, `request_id_reused`, `not_refundable`, `refund_exceeds_balance` -- grep: refund_exceeds_balance
- A partial refund result (amount refunded, what is left) is not told to the organiser -- grep: partialRefundDone

## Files
- src/modules/organiser/tickets/ticketsApi.ts (`refundOrder(orderId, opts?)`; keep the whole call byte-identical when no amount)
- src/modules/organiser/tickets/ticketModel.ts (`refundAmount`, `refundable`, `refundQuestion`, `REASON` live here; add `refundAmountError`, `newRefundRequestId`, `partialRefundDone`)
- src/modules/organiser/p3/tickets/RefundSheet.tsx
- src/modules/organiser/p3/tickets/TicketsEntry.tsx (only if the Refund row text or in-flight lock must change)
- src/modules/organiser/tickets/__tests__/ticketsApi.wire.test.ts, ticketModel.matrix.test.ts
- src/modules/organiser/p3/tickets/__tests__/tickets.matrix.test.tsx, stack.draft.test.tsx, gate.matrix.test.tsx (extend; they mock `refundOrder`)

## What to build
0. Write INVENTORY.md first (docs/design/ticket-partial-refund-ui/INVENTORY.md): every field, state and option of the refund flow in the admin app, the current Website organiser Refund sheet and the public order/ticket pages, each with file:line, plus a coverage count. Build only after it exists.
   Name the client request type `partialRefundRequest` in ticketsApi.ts (the grep token above).
1. API: `refundOrder(orderId, opts?: { amountPence: number; requestId: string })`. No opts -> body exactly `{ order_id }` as today. With opts -> `{ order_id, amount_pence, request_id }`. Return the partial reply fields (`remainingPence`, `clearsBalance`) on ok.
2. Model: `newRefundRequestId()` (crypto.randomUUID with the fallback pattern in `src/modules/organiser/shared/seriesCommands.ts:142`, 8-64 chars of the allowed set). `refundAmountError(text, order)` using `penceOf`/`refundAmount(o)` (= total - refunded): empty, not a price, 0, more than what is left -> a plain sentence naming the maximum; null when fine. Add the five REASON strings (British English, say what the person can do; `refund_exceeds_balance` reuses the server meaning: an earlier refund may still be settling, wait a minute).
3. Sheet: keep "Refund all remaining" (whole, today's confirm button, no amount sent) as the default. Add a "Refund part of it" choice that reveals an amount field (pounds, prefilled empty, inputMode decimal, px sizes, 44px taps) with the max shown ("Up to 8.00 left to refund"). The key is generated once when the person presses Refund and held in a ref; a retry after a network failure or a refusal that left the sheet open reuses it ONLY if the amount is unchanged, a changed amount gets a new key. Typing the full remaining amount sends it as a partial with the amount (server decides `clears_balance`); do not silently convert.
4. After a partial: toast "Refunded 3.00. 5.00 is left to refund. Tickets stay valid." and the order row keeps its Paid tag with its "refunded" line (GetPaid already shows `refundedPence`); the Refund button stays while money is left and the in-flight lock still blocks a second press until the answer.

## States to walk at 390x844 (prod-shaped orders)
Whole refund (untouched sheet, no amount in the request). Partial (amount typed, valid). Order already part-refunded (max shows the remainder). Order fully refunded (no Refund button; `refundable` false). Free order (no button). Over-refund: amount above the remainder is blocked client-side with the max named; server `refund_exceeds_balance` shows its words in the sheet. Disabled controls say why: non-manager (existing `NOT_MANAGER_REFUND` note), empty or invalid amount (the confirm button disabled with the reason under the field), busy (button reads "Refunding..."). Empty/error states say what the person can do. No sideways scroll, nothing under the keyboard (confirm button stays reachable with the field focused).

## Tests
Table-driven, red first. Wire: no opts -> `{order_id}` only; opts -> exact three fields. Amount table x outcome: "", "abc", "0", "-1", "0.001", "3", "3.5", "3.50", "GBP3", exactly remaining, remaining+1p, over the 1,000,000p cap. Order shapes x controls: paid unrefunded, paid part-refunded, refunded, disputed, free, non-manager. Idempotency: same press retry reuses the key; changed amount uses a new key; a new press uses a new key. Every REASON word has a test that no copy points at a control not on screen. Untouched whole refund sends exactly today's body.

## Done when
Unit tests, lint chain, tsc green; every CI job step that applies run, per-job table in the PR body; one push; Verified / Not verified block. Verified: amount table, wire shapes, idempotency, 390x844 states above on prod-shaped orders (read-only shape survey of `ticket_orders` status x refunded_pence, counts only). Not verified: a real Stripe partial refund end to end (test mode only; the lead or owner runs one).
