# Handover: ticket picker B1, fix round 1 (PR #1747) [dt_d72088df2397]

Brief: `brief/ticket-buyer:docs/briefs/ticket-picker-b1-fix1.md`. Review: `claude/review-1747:docs/review/pr-1747-review.md`.
Flag `ticketPickerB1` stays OFF. No migrations, no new DB objects.

## Done (review finding numbers)
1. **Terms of sale**: the classic checkbox (`TERMS_CHECKBOX_LABEL`) sits in the bottom bar; Continue is disabled until it is ticked, and the reason shows under it (`TERMS_REASON`, the same string the classic `disabledReason` now uses through a named constant). "Read the terms of sale" opens the classic `TERMS_OF_SALE` + privacy text under the promo box. The privacy link opens in a new tab, so the picker state is kept.
2. **price_changed**: `parsePriceChanged(r.raw)` becomes a `PickerHeld` (`heldFrom`: the server's new unit per line + new total, keyed to the basket). The bar total shows the new total, the alert uses the classic copy (`priceChangedText`, now shared with `stepReasonCopy`), and the button reads "Price changed, confirm". The confirm tap sends the held units and total. Any basket change spends the hold. `publicTicketKeys.types` is invalidated on `price_changed` (readable or not) and on every `pick_another` / `pick_night` refusal. `expected_price_required` uses the classic "reload" copy.
3. **Whole-order cap**: `cleanBasket` clamps the whole order to `MAX_PER_ORDER` (20); `roomFor` disables every `+` at 20, with the note "20 tickets is the most for one order."
4. **Tests**: the signed-out flow asserts the FULL `postTicketCheckout` body (2 lines, `expected_total_pence` 3500, no `promo_code` key, basket on screen = basket sent). Mutations re-run on the fixed code: total+100 caught (3 tests fail), basket swap `{...clean, b: 9}` caught (2 fail), `promo_code: "X"` caught (1 fails). New tests also cover price_changed confirm, the stock-refusal re-read, the cap, the preview guard, the terms gate, OTP copy and the 60 s timer (14 tests).
5. **OTP copy**: `verifyCodeError` gives "That code is wrong or expired." for `otp_expired` and any other non-rate-limit error (Supabase does not tell wrong from expired). 429 / `over_email_send_rate_limit` / `over_request_rate_limit` show a wait message on send and on verify. The resend timer is 60 s (`RESEND_SECONDS`).
6. **Preview origin**: `checkoutOriginOk(window.location.origin)` blocks Continue before any email is asked, with the classic `PREVIEW_ORIGIN_REASON`.
- Night refusals (`pick_night`) say "Go Back to pick another night." (the picker has no night list, and Back is on screen).

## Owner questions
- **Finding 7 (not changed, as briefed):** a successful code check leaves the buyer signed in on this device. On a shared phone, the next buyer reaches checkout as the previous person. `shouldCreateUser: true` also creates an unconfirmed `auth.users` row for each address typed. Keep as is, or sign out after the Stripe handoff when the buyer was not signed in at the start?
- Finding 1: the review offered the checkbox OR a "By continuing you accept" line. The brief asked for the checkbox, and that is what is built. Confirm.

## Left / notes from the one code-review round (not fixed, low risk)
- If the re-read after `price_changed` clamps the basket (stock fell at the same moment), the hold is spent silently: no note explains the new count.
- `heldFrom` keeps the listed price for a line the reply does not name. The server total is authoritative; a mismatch only means one more `price_changed`.
- `verifiedEmail` is kept in local state so a refusal after the code step does not ask for a second code; it is not cleared if auth changes while the picker is open (ties into finding 7).
- A row still shows the old unit price after `price_changed` until the re-read lands. In the walk harness the re-read was mocked to fail, so the row stayed at the old price while the bar showed the new total.

## Checks
- tsc run on 316a453 (code head; later commits are docs only): 0 errors in branch files (`tsc -p tsconfig.app.json`; the repo has 136 errors elsewhere, the same count on main).
- vitest `src/modules/tickets` 858/858; `ticketPickerB1.test.tsx` 14/14. `check:mojibake` clean.
- `npm run pre-ship`: 44 PASS, 3 FAIL, none caused by this branch: `check:no-social-word` (fails on main), `test:unit` (live-DB contract tests + `integrityCouldNotRun` in the sandbox; no tickets file), typecheck ratchet (136 on main too, baseline 106). test:e2e was skipped by pre-ship as a result.
- Walk at 390x844 (Playwright harness, deleted afterwards): terms gate, terms text, 20 cap, email, code + 60 s timer, wrong code, price_changed confirm (second POST carries the new unit and total), preview block. No horizontal scroll, no tap target under 40px.

## Not verified
- A live multi-line `ticket-checkout` call, real OTP email and real Supabase error codes, a real Stripe redirect, a real device, the signed-in flow in a browser, test:e2e.
