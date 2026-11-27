# Brief: partial refund UI, continuation 1 (fixes from the independent review)

Brief-version: 2
Branch: claude/ticket-partial-refund-ui (ALREADY has the build at head 588c1f93; continue on it, do not recreate). Normal lane, Sonnet, context cap 50%. One push. No `supabase/**`. This is a money path: every change needs a test.

## Decisions
An independent review of head 588c1f93 returned SAFE AFTER FIXES. Fix findings 1 to 3 and tidy 4. Server facts (admin `supabase/functions/_shared/ticketingHandlers.ts` partialRefund): a refusal with a reason is a DEFINITE answer only for the list in finding 1; `stripe_error` (502) and `internal_error` (500) can happen AFTER Stripe created the refund.

## What main lacks
- the sheet deletes the idempotency key on any non-null reason -- grep: refund_exceeds_balance

## What to build
0. Write INVENTORY.md first (docs/design/ticket-partial-refund/INVENTORY.md if absent): every field, state and option of the Refund sheet from the admin app, the current Website and the public page, each with file:line; read docs/design/1068.md and the existing RefundSheet tests. Build only after it exists and report the coverage count (covered / total) at the end. No new design work.
1. HIGH, RefundSheet.tsx near line 92: delete the held request key ONLY on `ok`, `not_configured`, or one of these definite reasons: `invalid_request`, `invalid_amount`, `request_id_required`, `request_id_reused`, `not_signed_in`, `not_authorised`, `not_found`, `not_refundable`, `refund_exceeds_balance`, `method_not_allowed`. KEEP the key for `stripe_error`, `internal_error` and any unknown reason or gateway code, so a retry sends the same key. Tests (red first): `stripe_error`, `internal_error` and an unknown code each reuse the same key on the next press; each definite reason makes a new key.
2. MEDIUM, RefundSheet.tsx near lines 98 and 134 and ticketModel.ts near 399/415: `refunded_pence` is advisory and lags the webhook. Keep a per-order "sent but not yet reflected" pence total in the parent (TicketsEntry), cleared when `refundedPence` for that order changes. Subtract it from the maximum and from the whole-refund amount shown and sent. Also do not toast a `remaining_pence` taken from the server reply without subtracting it the same way; if unsure, toast "Refund sent" without a remaining figure. Tests: after a £3 partial of £8, reopening shows up to £5.00 and the all-remaining body says £5.00 until `refundedPence` moves.
3. LOW, RefundSheet.tsx: when an unclear-failure key is held for the order, show under the note: "The last refund may have gone through. Tap Refund again to check, or reload the page before changing the amount." (use the real amount in the button text). Test it appears only while a key is held.
4. Tidy: remove the stray blank lines in RefundSheet.tsx imports, TicketsEntry.tsx after `keys={...}`, ticketModel.ts (`refundPartQuestion`, before `newRefundRequestId`, after `REASON`) and the test files; rename the type `partialRefundRequest` to `PartialRefundRequest` everywhere; make `keysFor` create the Map only on the first press (no change during render).
5. Run `npx vitest run src/modules/organiser`, `npx tsc -p tsconfig.app.json --noEmit` (error count not higher than before), `npm run check:mojibake`. Put the Verified / Not verified block in the PR body update: Not verified = a real Stripe refund (no test-mode run here).
6. Commit `fix(tickets): partial refund review fixes (key kept on unclear errors, pending-refund amounts) [worker-done <ticket>]` and push ONCE (not [skip preview]).

## Files
- src/modules/organiser/p3/tickets/RefundSheet.tsx
- src/modules/organiser/p3/tickets/TicketsEntry.tsx
- src/modules/organiser/tickets/ticketModel.ts
- src/modules/organiser/tickets/ticketsApi.ts
- the existing refund tests under src/modules/organiser

## Done when
The three findings each have a test that failed before the fix and passes now, tsc count not higher, organiser tests pass, one push.
