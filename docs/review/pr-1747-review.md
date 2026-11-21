# Review: PR #1747 ticket picker B1 (`feat/ticket-picker-b1` @ 86e306d)

Brief: `brief/ticket-buyer:docs/briefs/ticket-picker-b1-review.md` (blob 5cc66c7). Read-only review: no code
was changed on the PR branch. Checks covered money and auth. ONE round.
Dispatch ticket dt_841f1774de67.

## Verdict: BLOCK

## Hard-tier: FAIL

Reason: this is a money path, and three things break the hard tier: (a) the classic page requires the buyer to
accept the terms of sale before payment, and B1 removes that step; (b) a `price_changed` refusal is not handled,
so the buyer gets a generic "try again" message and is sent the same stale price again; (c) the tests never
check `expected_total_pence` or what the component actually sends. No charge at an unseen price is possible
(the server checks every price again), and the flag is OFF by default, so nothing is live. All of these must be
fixed before the flag is turned on.

## Findings (most severe first)

1. **The terms-of-sale step is gone (BLOCK).** On `main`, `TicketsBlock.tsx:101,219,592` makes the buyer tick
   the terms of sale before Buy works (`disabledReason`, `ticketCheckoutModel.ts:238`). B1 goes from Continue
   to email, code and Stripe with no terms box and no terms link (`TicketPickerB1.tsx:120-124, 234`). The edge
   function does not check terms (I found no `terms` in `_shared/ticketingHandlers.ts`), so the client is the
   only place this is enforced. Fix: add the same checkbox (or an explicit "By continuing you accept the terms
   of sale" line with the terms text), and have Ricky confirm which of the two is wanted.
2. **`price_changed` is not handled (BLOCK).** On a 409 `price_changed`, `startPayment` only calls
   `reasonCopy(r.reason)` (`TicketPickerB1.tsx:116`). `price_changed` is not in `REASON_COPY`, so the buyer
   sees the generic "could not be booked... Try again" text. The types query is not invalidated
   (`staleTime: 30_000`, `:52`), so for up to 30 s a retry sends the same stale `expected_unit_price_pence` and
   gets refused again. The classic page re-prices the order from the reply and asks the buyer to confirm
   (`TicketsBlock.tsx:256-270`). Fix: at minimum, invalidate `publicTicketKeys.types` on `price_changed` and
   any stock or status refusal, and show the new total. Best: reuse `parsePriceChanged`.
3. **The 20-ticket limit applies to the whole order but is only checked per type (should fix).**
   `cleanBasket` and `step` clamp each type to `maxQuantity` (20) (`pickerModel.ts:19`,
   `TicketPickerB1.tsx:104`). The edge function caps the whole order at `MAX_QUANTITY` = 20
   (`bachata-admin/_shared/ticketingHandlers.ts:330`). A basket of 15 + 10 shows a total and a Continue button,
   asks for an email and code, then gets `invalid_quantity` back. That is safe (no charge) but sends the buyer
   down a dead end. Real data makes this reachable: one prod series has 12 on-sale types. Fix: stop `+` once
   `sum.count >= MAX_PER_ORDER`.
4. **Tests do not check what the component sends (should fix).** Mutation results on 86e306d
   (`ticketPickerB1.test.tsx`, 8 tests):
   - `expected_total_pence` + 100: **survives** (no test reads it).
   - Unit price + 1: caught (`:56`).
   - Quantity + 1: caught (`:56`).
   - Component sends `{...clean, b: 9}` instead of the basket on screen: **survives**. The signed-out and
     signed-in flows only check `buyer_email`, `:120`.
   - `promo_code: "X"` added to the body: **survives**. Nothing checks that promo never reaches the wire.
   - Fee doubled: caught (total text, `:73`).

   Fix: in the signed-out flow, assert the full `postTicketCheckout` body (lines, `expected_total_pence`, no
   `promo_code` key).
5. **Wrong code vs expired code (nit, but user-facing).** `TicketPickerB1.tsx:142` tests `/expired/i` against
   `error.message`. Supabase sends "Token has expired or is invalid" for both a wrong code and an expired one,
   so every wrong code shows "This code has expired. Send a new code." The test fixture even uses that message
   (`:103`). Fix: map on `error.code` (`otp_expired`) or use neutral copy ("That code is wrong or expired").
6. **OTP send errors (nit).** `:132` maps every `signInWithOtp` error, including 429 / `over_email_send_rate_limit`,
   to "Check the address and try again". When the buyer is rate limited, show the wait message instead. The 30 s
   resend timer (`:133`) is shorter than Supabase's default 60 s OTP interval, so "Send a new code" will often
   hit exactly this error.
7. **Account creation and sessions (note for the owner, not a code bug).** `shouldCreateUser: true` creates an
   unconfirmed `auth.users` row for every address someone types, before the code is verified. There is no
   enumeration signal (sign-up and sign-in look the same), and Supabase's email rate limits cap the spam. A
   successful `verifyOtp` leaves the buyer signed in on this device: on a shared phone, the next buyer reaches
   checkout as the previous person, because `user?.email` skips the code step (`:122`). "Change email" before
   verifying is clean: no session exists yet. After a verify and then a refusal, the session stays the first
   email's. Owner decision: keep, or sign out after handoff when the buyer was not signed in at the start.
8. **Preview origin (nit).** The classic page refuses early on a preview with `checkoutOriginOk`
   (`ticketCheckoutModel.ts:233`). B1 posts from any origin (`pickerModel.ts:82-83`), so on a Vercel preview
   the buyer only learns at the end that checkout cannot work. Add the same guard.

## Brief checks

1. **Wire contract:** matches. `lines[]` holds 1..20 entries with `expected_unit_price_pence`, plus
   `expected_total_pence`: the only shape the edge function accepts (`ticket-checkout/index.ts` header and
   `parseBasketLines`). Several lines are allowed (`MAX_BASKET_LINES` = 20, no duplicate types: B1 builds one
   line per type). The fee rule (flat fee per ticket, none on a free order) matches `BOOKING_FEE_PENCE` and the
   server's `TICKET_BOOKING_FEE_PENCE` (0 today). No price is taken on trust from the client: the server
   re-prices and answers `price_changed`. Gaps: the 20-ticket order cap (finding 3) and `price_changed`
   handling (finding 2).
2. **Auth OTP:** see findings 5 to 7. No PII leaves the device except to Supabase Auth.
3. **Cancel return:** sessionStorage key `bc.pickerBasket.<series>.<occ>` holds `{typeId: count}` only, with
   no email or price. Prices are read again on return and checked by the server. OK.
4. **Flag OFF:** `EventTicketsPage` renders `ClassicEventTicketsPage` with the same props. The function body
   is unchanged, and the flag is a build-time constant, so hook order is stable. All 852 tests under
   `src/modules/tickets` pass on the PR branch. The promo stub never reaches the wire: `buildPickerBody` has no
   `promo_code`, and `applyPromo` makes no network call. That is not tested (finding 4).
5. **Tests:** see finding 4. They partly check the wire body. Mutating the total or the component's basket is
   not caught.

## Verified on real data
- Shapes surveyed: prod (read-only SELECT): 17 on-sale ticket types across 3 series, up to 12 types in one
  series, so a basket over 20 tickets is reachable. `ticket_types_public_v2` and `v3` both compute an
  effective price; only v3 reads price steps.
- Checks run: vitest on the PR branch (`ticketPickerB1.test.tsx` 8/8, `src/modules/tickets` 852/852); 6
  mutations of the wire body (3 survived); edge function contract read from `bachata-admin` HEAD
  (`supabase/functions/_shared/ticketingHandlers.ts`, `ticketing.ts`).
- NOT verified: a live `ticket-checkout` call with several lines (no writes allowed); the Supabase OTP email
  template (code vs link); whether v2's effective price equals what reserve v5 charges for a stepped type when
  `ticketPriceSteps` is OFF (B1 always sends expected prices); no browser walk (review only, no UI change).
