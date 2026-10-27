# Handover: S4 buyer checkout, review should-fixes

Brief: `docs/briefs/ticketing-checkout-fixes.md` (branch `brief/ticketing-checkout-fixes`).
Review: `docs/review/ticketing-checkout-1063.md` (branch `claude/ticketing-checkout-review`, PR #1065).
Branch: `claude/ticketing-checkout-fixes`. Website only, no DB, no edge function, flag
`publicTicketing` still OFF (no flag default touched).

## What #1063 had already closed

#1063's last round (before merge) already carried the brief's items 3 (`<form>`, Buy is
`type="submit"`), 4 (origin reason first), 6 (`?o=` must be a UUID), the timeout signal of
item 2 and the `invalid_*` half of item 7, each with a test in
`src/modules/tickets/__tests__/reviewFixes.test.tsx`. This branch re-proves those by mutation
and fixes what was still open.

## What this branch changes (brief item -> change)

1. **Paid wording only on server confirmation.** `thanksCopy(free, state)` now takes
   `'confirmed' | 'checking' | 'none'`. The Website has NO public order read (prod read-only
   survey: every `ticket_order_*` RPC is not anon-executable), so the thank-you page passes
   `'checking'` for a held order id and `'none'` otherwise: the heading is "Checking your
   order" and the body says what to do (spam folder, then the organiser). "Payment received"
   is only reachable with `'confirmed'`, which needs a server read that does not exist yet.
2. **Timeout = its own retry state.** A `TimeoutError`/`AbortError` from the 20 s signal is now
   reason `timeout` ("The ticket service took too long to answer. You have not been charged.
   Try again."), offline stays `network`. The wire never resends on its own; a retry is one
   POST per buyer action, and the `inFlight` ref still holds Return/double-tap (tested).
3. / 4. / 6. Already on main (above); mutation-proved here.
5. **Rate-limit after a cancel return:** tested end to end (cancel notice, then `rate_limited`
   with and without the server message -> the server text plus the held-tickets sentence once).
7. **Every server reason mapped:** `invalid_fee`, `refused`, `free_issue_failed`, `not_free`,
   `not_pending`, `stale`, `method_not_allowed` and `timeout` added to the ONE `REASON_COPY`.
   The lookup is own-key only, so a reply reason like `toString`/`__proto__` (previously
   returned a function / the prototype) now gets the safe generic.
8. **One booking-fee constant:** `src/lib/ticketBookingFee.ts` (comment: server value is env
   `TICKET_BOOKING_FEE_PENCE`, keep unset = 50). Read by buyer totals, the block's fee line,
   the terms of sale (same words; the amount is interpolated) and the organiser model and
   screen. Behaviour unchanged at 50.

Also: `formatPence` now groups thousands (2,022 pounds, 40,450 pounds) for the big-number shape.

## Tests

- `__tests__/checkoutFixes.matrix.test.tsx`: items 1, 2, 5, 7 and the 0/1/many/2,022 shapes.
- `__tests__/bookingFee.shared.test.tsx`: mocks the shared constant to 75 and requires every
  client line to follow it.
- Old pins updated for the new intended behaviour (thanks heading, timeout reason).

## Left / next steps

- A public, anon-safe order-status read (admin repo) would let the thank-you page show
  "Payment received" when the webhook has marked the order paid. Until then it never does.
- Server-side idempotency (an idempotency key on `ticket-checkout`) is not in scope: a
  timed-out request may still have created a pending order, which expires on its own (32 min)
  and holds stock meanwhile. Item 6 of the review (close pending on cancel) is also server.
- The organiser screen line (`SeriesTickets.tsx`) reads the constant but has no rendering
  test against a mocked fee; its model (`buyerTotal`) does.
