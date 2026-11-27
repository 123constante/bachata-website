# Brief: ticket picker B1 fix round 1 (PR #1747, branch feat/ticket-picker-b1)
Class: BUILD-non-visual on a money path, flag ticketPickerB1 stays OFF. Fix on the SAME branch/PR. Read the review first: `git fetch origin claude/review-1747` then `git show FETCH_HEAD:docs/review/pr-1747-review.md`. Do not edit that doc.

Fix, in order (review finding numbers):
1. Terms of sale: add the same terms checkbox + link the classic page uses (`TicketsBlock.tsx`, `disabledReason` in `ticketCheckoutModel.ts`); Continue/Buy disabled until ticked. Reuse the classic copy and helper, no new wording.
2. `price_changed`: reuse `parsePriceChanged`; invalidate `publicTicketKeys.types` on `price_changed` and on every stock/status refusal; show the new total and make the buyer confirm before retry (same as classic `TicketsBlock.tsx:256-270`).
3. Whole-order 20-ticket cap: stop `+` once total count >= MAX_PER_ORDER (20); show the limit calmly.
4. Tests: in the signed-out flow assert the FULL `postTicketCheckout` body (lines, `expected_total_pence`, no `promo_code` key, basket on screen = basket sent). Then re-run the three surviving mutations from the review (total+100, basket swap, promo_code added) and show each is now caught.
5. OTP copy: map wrong/expired on `error.code` (`otp_expired`) else neutral "That code is wrong or expired."; map 429 / `over_email_send_rate_limit` to a wait message; resend timer 60 s.
6. Preview origin: add the `checkoutOriginOk` early guard like classic.
Finding 7 (signing out after handoff): do NOT change; list it under owner questions in the handover.

Also: `npm run pre-ship` green, tsc 0 errors in touched files, PR body labels exact (Verified on real data / Phone QA). Walk 390x844 (explicit px tap targets). Final commit ends [worker-done <ticket>].
