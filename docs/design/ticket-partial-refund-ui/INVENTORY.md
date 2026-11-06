# Inventory: the refund flow (partial refund UI)

Written before any build (brief step 0). Main at `900b025`. Line numbers are on that commit.

## 1. Admin app (`bachata-admin-11april`)

NOT READ BY FILE: this session's GitHub access does not reach the admin repo (add_repo refused:
"you don't have access"). Its rows below come from the brief's contract (`supabase/functions/ticket-refund/index.ts`,
admin PR #1283, verified deployed by the lead), not from file:line.

| # | Field / state / option | Where | Website covers it? |
|---|---|---|---|
| A1 | body `order_id` (required) | ticket-refund index.ts (contract) | yes, today |
| A2 | body `amount_pence` (integer pence, optional; absent = whole refund) | contract | NEW: ticketsApi `refundOrder(id, opts)` |
| A3 | body `request_id` (8-64 chars `[A-Za-z0-9_-]`; required with A2; idempotency key) | contract | NEW: `newRefundRequestId()` |
| A4 | reply whole `{ok:true,refunded:true}` | contract | yes, today |
| A5 | reply partial `{ok:true,refunded:false,partial:true,amount_pence,remaining_pence,clears_balance}` | contract | NEW: parsed into `PartialRefundDone` |
| A6 | refusal `invalid_amount` (+ `remaining_pence`) | contract | NEW REASON |
| A7 | refusal `request_id_required` | contract | NEW REASON |
| A8 | refusal `request_id_reused` | contract | NEW REASON |
| A9 | refusal `not_refundable` | contract | NEW REASON |
| A10 | refusal `refund_exceeds_balance` (+ `message`) | contract | NEW REASON (server meaning: earlier refund still settling) |
| A11 | refusal `not_authorised` (owner / manager only, Q15) | contract | yes, `REASON.not_authorised` |
| A12 | order row written by the `charge.refunded` webhook (refunded_pence lags the call) | contract | yes: refetch after; toast says what was sent |
| A13 | admin's own refund screen (fields / states) | not readable this session | NOT COVERED (see Not verified) |

## 2. Website organiser Refund sheet (today)

| # | Field / state / option | file:line | After this change |
|---|---|---|---|
| W1 | Refund button per order, manager + `refundable(o)` only | src/modules/organiser/p3/tickets/TicketsEntry.tsx:200 | unchanged; stays while money is left |
| W2 | in-flight lock: button disabled, reads "Refunding..." | TicketsEntry.tsx:84, :205-209 | unchanged; covers partial too |
| W3 | non-manager note `NOT_MANAGER_REFUND` | TicketsEntry.tsx:233; ticketModel.ts:57 | unchanged |
| W4 | `refundable` = paid and total - refunded > 0 | src/modules/organiser/tickets/ticketModel.ts:366 | unchanged |
| W5 | `refundAmount` = total - refunded | ticketModel.ts:364 | reused as the maximum |
| W6 | `refundQuestion`: title, body (tickets stop working), confirm "Refund £X" | ticketModel.ts:371-381 | whole kept; partial body says tickets stay valid |
| W7 | sheet title / body / order card / Paid tag | src/modules/organiser/p3/tickets/RefundSheet.tsx:58-80 | kept |
| W8 | confirm button, busy "Refunding..." | RefundSheet.tsx:64-66 | kept; disabled with reason when the amount is wrong |
| W9 | "Keep the order" (autofocus) | RefundSheet.tsx:67 | kept |
| W10 | refusal note in the sheet (role=alert, focused) | RefundSheet.tsx:78 | kept; carries the new REASON words |
| W11 | late answer after close -> `onLate` toast/alert | RefundSheet.tsx:49-55 | kept; partial late text names the amount |
| W12 | done -> toast "Refund started." | RefundSheet.tsx:52 | whole kept; partial -> `partialRefundDone` words |
| W13 | `refundOrder(orderId)` body `{order_id}` | src/modules/organiser/tickets/ticketsApi.ts:249-254 | byte-identical with no opts |
| W14 | not deployed / 503 -> `NOT_SWITCHED_ON` | ticketsApi.ts:210-219; RefundSheet.tsx:53 | kept |
| W15 | unknown reason -> "That did not work. Try again in a moment." | ticketModel.ts:411-412 | kept |
| W16 | money format `formatPence` / parse `penceOf` (cap 1,000,000p) | ticketModel.ts:161, :168 | reused |
| W17 | per-type "£X refunded" line | src/modules/organiser/p3/tickets/GetPaid.tsx:44 | unchanged (shows partials once the webhook lands) |
| W18 | order tags Paid / Refunded / Disputed | ticketModel.ts:383-388 | unchanged (partial keeps Paid, Q5) |
| NEW | "Refund all remaining" / "Refund part of it" choice | RefundSheet.tsx | NEW |
| NEW | amount field (pounds, decimal keyboard, max shown) + `refundAmountError` | RefundSheet.tsx, ticketModel.ts | NEW |
| NEW | per-press key held in a ref, reused only for the same amount | RefundSheet.tsx | NEW |

## 3. Public order / ticket pages

| # | Field / state | file:line | Effect of partial refunds |
|---|---|---|---|
| P1 | refund policy sentence (full refund includes booking fee) | src/modules/tickets/legalCopy.ts:29-30 | unchanged; still true (partial is not a full refund) |
| P2 | thanks page order status paid / pending / failed | src/modules/tickets/ticketCheckoutModel.ts:300, :318 | order stays `paid` on a partial: no change |
| P3 | My tickets list / QR | src/modules/tickets/MyTicketsPage.tsx, OrderQrBlock.tsx | tickets stay valid on a partial: no change |

## Coverage count

- Admin contract rows A1-A12: 12 / 12 handled (A13, admin's own screen, not readable: 0 / 1).
- Website sheet rows W1-W18: 18 / 18 kept or extended; 3 NEW rows built.
- Public rows P1-P3: 3 / 3 checked, no change needed.
- Total: 33 / 34 covered; the gap is A13 (no access).
