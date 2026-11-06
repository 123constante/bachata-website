# Handover: ticket partial refund UI (dt_50a73ef945dc)

PR #1458, branch `claude/ticket-partial-refund-ui`. Brief: `brief/ticket-partial-refund-ui` (sha d244530).

## Done
- INVENTORY.md first (33 / 34 rows covered; the admin refund screen could not be read, no repo access).
- `refundOrder(orderId, opts?)`: with no opts the body is exactly `{ order_id }`; with opts it is `{ order_id, amount_pence, request_id }`. Type `partialRefundRequest`; the reply is `PartialRefundDone` (integer-checked).
- Model: `refundAmountError`, `refundPartQuestion`, `partialRefundDone`, `newRefundRequestId`, and 5 REASON strings ("Tap", never "Press").
- Sheet: Refund all remaining (default) / Refund part of it; amount field; confirm disabled with the reason under the field.
- Keys: `TicketsEntry` keeps them per `orderId:refundedPence` and amount. An unclear failure keeps a key; a definite answer drops it.
- Tests run red first. `/code-review` plus a review on a different model; outcomes are in the PR body.
- tsc run on the final commit: 0 errors in branch files.

## Left / next steps
- 390x844 browser walk (not run): check the keyboard does not cover the confirm button, there is no sideways scroll, and every state in the brief.
- Run a real Stripe test-mode partial refund end to end (lead or owner).
- Lead: confirm that `ticket-refund` with no amount on a part-refunded order refunds only the remainder.
- Follow-ups (review, skipped): show the server's `remaining_pence` for `invalid_amount`. The maximum stays stale until the `charge.refunded` webhook lands; the server refuses with `refund_exceeds_balance`, whose words say to wait a minute.
- Repo: `.githooks/*` are not executable in this sandbox, so the pre-push hook did not run. pre-ship was run by hand; the 4 failing unit suites fail the same way on main.
