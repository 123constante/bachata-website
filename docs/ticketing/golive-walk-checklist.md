# Ticketing go-live walk checklist (phone, 390x844, private Vercel preview)

Docs only. Written from the repo on `main` at 2026-11-05 (sources named per row). Nothing here was run
against Stripe or prod; no Stripe calls, no secrets. Sources: `docs/ticketing-buyer-journey.md`,
`docs/organiser-ticketing-journey.md`, `docs/handovers/ticket-*.md`, `docs/handover/ticketing-checkout-fixes.md`,
and the code under `src/modules/tickets/`, `src/modules/organiser/tickets/`, `src/modules/organiser/p3/tickets/`,
`src/modules/organiser/p3/door/`.

## 0. Read first: things the repo says that change the walk

1. **Promo codes are NOT in the Website.** `docs/handovers/ticket-promo-codes-web.md` (2026-10-29) is a BLOCKED
   handover: nothing built. A search of `src/` finds no `promo_code`, `ticket_promo` or promo field in the
   ticket modules. Step 5 below therefore cannot be walked as a feature; it is a "confirm there is no promo
   field" check. If the owner expects promo codes, that work is still to dispatch.
2. **There is no "My tickets" screen in the Website.** No such route or component exists. The buyer's tickets
   arrive by email (one `Ticket N: <code>` line per ticket, plain text, no QR image: `ticket-qr-door-screen.md`).
   The only buyer-side screen after payment is `/tickets/thanks`. Walk that, and treat "My tickets" as absent.
3. **Checkout on a preview only works with two settings.** Buy is disabled on any origin other than
   `bachatacalendar.co.uk` / `www.` unless the preview build has `VITE_TICKET_PREVIEW_ORIGIN` set to ONE bare
   https origin (the stable walk alias) AND Vercel sets `VERCEL_ENV=preview` (`previewCheckoutOrigin` in
   `ticketCheckoutModel.ts`), AND the edge function has the same value as its `TICKET_PREVIEW_ORIGIN` secret
   (server side, not visible from this repo). Open the preview on exactly that alias. Without it you will see
   "Checkout only works on bachatacalendar.co.uk, not on this preview." and the walk stops at step 3.
4. **Flags** (build-time, Vercel env, `src/lib/featureFlags.ts`): `VITE_ENABLE_PUBLIC_TICKETING=true`,
   `VITE_ENABLE_ORGANISER_TICKETING=true`. The organiser screens also need `organiserSelfServe` and
   `organiserP3` on (`P3Routes.tsx`). "Live site OFF" = Production env leaves all of these unset (default off).
5. **Stripe needs test mode end to end**: the organiser's connected account, the platform keys and the webhook
   must all be test-mode. Test card: `4242 4242 4242 4242`, any future expiry, any CVC, any postcode.
   Declined-card test: `4000 0000 0000 0002`. These are Stripe's published test numbers, nothing secret.
6. Fee: `BOOKING_FEE_PENCE = 0`. Buyers pay ticket price only. The edge secret `TICKET_BOOKING_FEE_PENCE`
   must be `0` too (`ticket-fee-zero-web.md`); if it is still unset the server charges 50p more per ticket than
   the page shows. **Check Total on the page equals the amount on the Stripe page.**
7. Use two accounts: an organiser (owner/manager of a page with one LIVE event) and a separate buyer email you can read.

## 1. The walk

Format: **Screen** / **Tap** / **Should see** / **Failure looks like**.

### Part A: Organiser sets up a ticket (flags on, signed in as organiser)

**A1. Get paid** (needed only for paid tickets; free tickets skip it)
- Screen: `/account/p3/you/get-paid?o=<page id>` (You tab, "Get paid for tickets").
- Tap: **Connect payments**, finish Stripe test onboarding, return.
- See: on return "Back from Stripe. It can take a minute to show as connected; reload the page if it does not."
  then tag **Paid out via Stripe**, title "Payments connected".
- Failure: "Payments are not switched on yet. Free tickets work now; paid tickets and refunds come soon." (edge
  function `stripe-connect-onboard` missing: BLOCKER for paid); "We could not read your payment set-up."; a Stripe
  link that "ran out" ("That Stripe link ran out. Tap the button to carry on where you left off.") is recoverable.

**A2. Open the event's tickets**
- Screen: P3 event page (`/account/p3/events/<seriesId>`), the tickets row.
- Tap: the tickets row, then **Add a ticket**.
- See: sheet titled "Add a ticket", steps "Name and price", "Places and dates", "Review".
- Failure: row detail "Could not load"; "Put this event live before adding tickets." (event not live); the Add
  button disabled with "Only an owner or manager ..." when signed in as a contributor.

**A3. Create a paid type and put it on sale**
- Tap: name (e.g. "Early bird"), price 5, capacity 5, **Put on sale** (or **Save as draft** then switch to Selling).
- See: toast "Ticket added and on sale." Status tag **On sale**.
- Failure: "Ticket saved as a draft, not on sale yet. <reason>" (e.g. Stripe not connected on a paid type);
  "Nothing changed, so nothing was saved." on an untouched edit (correct, not a bug).
- Also create a **free** type (price empty or 0: "Leave empty or 0 for a free ticket.") for step B5.

### Part B: Buyer checks out (second device or private tab, signed out is fine)

**B1. Event page shows the Tickets block**
- Screen: `/event/<id>` of that live event, under the bento grid.
- See: one row per type on sale with price (or "Free") and "N left" (shown when 20 or fewer) or "On sale".
- Failure: no block at all (flag off, event not live, night past or cancelled, RPC failed, no types). Known DB gap:
  `ticket_types_public_v1` is keyed on the series uuid; for 59 of 69 live series the public id differs
  (`ticketing-buyer-journey.md`), so the block can be missing on a real event. If the block is missing on an event
  that definitely has an on-sale type, STOP and tell the orchestrator: it is the DB-side id fix, not a phone bug.

**B2. Pick a type and fill the form**
- Tap: the row, the **+** stepper once, type the buyer email, tick the terms box (optionally **Read the terms of sale**).
- See: quantity stepper with "Up to 20 tickets per order." (or "Only N left."), Subtotal and Total lines equal
  (no fee line), email field, terms checkbox, one Buy button with the reason it is disabled under it.
- Failure: horizontal scroll; Total differs from subtotal; a "+ fee per ticket" line (means the constant is not 0).

**B3. Pay with the test card**
- Tap: **Buy tickets**.
- See: redirect to `checkout.stripe.com`. The Total there equals the page's Total. Pay with `4242...`.
- Failure: the reasons in section 2 table "Buy errors"; stuck on "Working on it..." beyond 20 s becomes "The ticket
  service took too long to answer. You have not been charged. Try again."; Stripe total differs from the page (fee
  secret mismatch, see 0.6).

**B4. Thank-you page**
- Screen: `/tickets/thanks?o=<order id>` after Stripe returns.
- See: first "Checking your order" (neutral), then within seconds "Confirmed. Your tickets are in your email." with
  ticket count, event title and date, plus "Order reference: <8 chars>". Back link "Back to what's on" is 44px tall.
- Failure: stays on "Checking your order"/"Still processing" after about a minute (webhook late or not delivered:
  see 2.3); "Payment didn't go through" after a successful test payment (BLOCKER). The page must NEVER say
  "Confirmed" before the server says paid.
- Then open the buyer's email: expect one `Ticket N: <64 hex chars>` line per ticket. No QR image exists yet.

**B5. Free ticket**
- Tap: the free type, email, terms, **Get free ticket**.
- See: no Stripe; lands on `/tickets/thanks?o=<id>&free=1`: "Your free tickets are on their way" then the Confirmed copy once the server says paid.
- Failure: "Your free tickets could not be issued. Nothing was booked. Try again."

**B6. Cancel path**
- Tap: Buy, then Stripe's back arrow.
- See: back on the event with "Checkout cancelled. You have not been charged. You can try again below." and a
  usable form; `?tickets=cancelled` is removed from the URL after the first read.
- Failure: the notice reappears on reload; the form is empty or broken.

### Part C: Promo code (NOT built; see 0.1)

**C1.** On the Tickets block form and the organiser's ticket sheet, confirm there is no promo field and nothing
says "promo". Record "promo: not built" in the sign-off. Do not try to enter a code. When the feature ships, this
section needs its own copy table (the admin handover holds it; this repo has none).

### Part D: Organiser sees the sale, door scan

**D1. Orders**
- Screen: P3 event page, the orders list under the ticket type.
- See: the buyer's order with name, quantity, total, date and a **Refund** button; with no orders yet:
  "No orders yet. They show here, by buyer name, the moment someone buys." (or the "Switch a ticket to Selling" /
  "An owner or manager can put a ticket on sale" variants).
- Failure: sale missing after B4 showed Confirmed; counts disagree with the buyer's tickets.

**D2. Door scan** (`/account/p3/events/<seriesId>/door`, full screen, via the **Scan tickets** row on the event page)
- Tap: **Scan tickets**, allow the camera, point at a ticket code. A QR image is not issued yet, so use the **Type
  code** box and paste the 64-char code from the email.
- See: green band **LET IN** "1 person ... enjoy the night" (or "1 person, ticket 1 of an order of N").
  Second scan of the same code: amber **ALREADY IN** with "Do not let in again.".
- Failure: **CODE NOT RECOGNISED**, **NOT FOR THIS EVENT**, **NOT VALID** (refunded) are correct for wrong input
  only; **CANNOT CHECK TICKETS** ("You're not on this event's team") for a team member is a role bug;
  **NO SIGNAL** with good signal is an RPC failure. A live camera scan of a real printed/phone QR is impossible
  today (no QR rendered), so camera decoding is Not verified.

**D3. Refund**
- Tap: **Refund** on the order, read the sheet, tap **Refund GBP 5** style confirm button.
- See: sheet "Refund <name>?" body "GBP 5 goes back. Their ticket stops working and the place reopens. Cannot be
  undone." then toast "Refund started." and the order tagged refunded.
- Then re-scan the same code: **NOT VALID** "This ticket was refunded or cancelled".
- Failure: "Payments are not switched on yet..." (edge fn `ticket-refund` missing, BLOCKER for refunds); refund
  button enabled for a contributor; ticket still scans LET IN after refund (BLOCKER).

## 2. States each screen can be in, and the copy that must show

### 2.1 Buyer Tickets block (`/event/:id`, `TicketsBlock.tsx`, `availability()`)

| State | What shows | Copy / behaviour |
|---|---|---|
| No ticket types / RPC fails / flag off / event ended, paused, past or cancelled night | Block is absent | Page renders exactly as before |
| On sale, plenty left | Row, pickable | "On sale"; stepper max 20 |
| On sale, 20 or fewer left | Row, pickable | "N left"; "Only N left." under the stepper when N below 20 |
| Sold out (`sold_out` or remaining 0) | Row shown, not pickable | "Sold out"; Buy reason "<name> cannot be bought right now (sold out)." |
| Sales not open yet | Row, not pickable | "On sale Fri 6 Nov, 19:00" style (London time) |
| Sales closed | Row, not pickable | "Sales closed" |
| On sale PAUSED by organiser | Row is absent (RPC returns only on_sale / sold_out) | Block hides if it was the only type; nothing says "paused" to the buyer |
| Free type | Price "Free", Subtotal/Total "Free" | Button "Get free ticket" |
| Mixed free and paid | Each row its own price | Button label follows the picked type |
| Preview origin not allowed | Buy disabled | "Checkout only works on bachatacalendar.co.uk, not on this preview." (shown before any field) |
| Form incomplete | Buy disabled with reason | "Pick a ticket first." / "Enter your email so we can send your tickets." / "That email does not look right." / "Tick the box to accept the terms of sale." / "Choose between 1 and N tickets." |
| Submitting | Buy disabled | "Working on it..." |
| Cancelled return | Note above the block | "Checkout cancelled. You have not been charged. You can try again below." |

**Buy errors** (one mapping, `REASON_COPY`; each also shows a way-forward button):
`not_on_sale` "This ticket is not on sale right now. Pick another ticket." / `outside_sales_window` "Sales for this ticket
are not open right now. Pick another ticket or come back later." / `sold_out` "Not enough of this ticket left. Pick fewer or
another ticket." / `organiser_not_onboarded` "The organiser cannot take payments yet. Contact the organiser for tickets."
(Buy then stays off: "Online tickets are not available for this event right now.") / `rate_limited` "Too many ticket
requests. Please wait a while and try again. If you cancelled a checkout just now, those tickets are held for about 30
minutes." / `stripe_error` "The payment page could not be opened. You have not been charged. Try again." / `network`
"Could not reach the ticket service. Check your connection and try again." / `timeout` (see B3) / `internal_error` "Something
went wrong on our side. You have not been charged. Try again." / any unknown reason: "Your tickets could not be booked. You
have not been charged. Try again." Payment failure ON Stripe's page is Stripe's own screen (declined card
`4000 0000 0000 0002`); coming back via the back arrow is the cancel path (B6).

### 2.2 Promo expired

Not applicable: no promo code exists in the Website (0.1). If you see any promo wording, report it.

### 2.3 Thank-you page (`/tickets/thanks`, `thanksCopy`)

| State | Title | Notes |
|---|---|---|
| No order id (typed URL, garbage `o`) | "Checking your order" | Body: "If you completed payment, your tickets will arrive by email in a few minutes. ..." No reference line |
| Order id, server not answered yet or `pending` (webhook late) | "Checking your order" | Polls at 2, 4, 8, then 15 s, at most 8 repeats |
| Polls exhausted, still pending | "Still processing" | "Your order is still processing. Check your email in a few minutes. If nothing arrives within an hour, check your spam folder, then contact the organiser." Link reads "Back" |
| Server says `paid` | "Confirmed. Your tickets are in your email." | Count, event, date when the server sends them |
| Server says `failed` | "Payment didn't go through" | "No tickets were issued ... You can go back and try again." Link reads "Back" |
| Free order (`free=1` with a valid id) | "Your free tickets are on their way" until the server says paid | |
| Odd or error reply | Treated as `unknown`, never `paid` | Stays "Checking your order" |

Webhook-late test: after paying, hold the page; the title must stay neutral, never "Confirmed", until the
webhook marks the order paid.

### 2.4 Organiser ticket screens (P3)

| State | Copy |
|---|---|
| Stripe not connected | Tag "Not connected"; "Connect payments to sell <event>"; "Stripe pays you directly. About 10 minutes, once." |
| Stripe started, unfinished | Tag "Not finished"; "Finish connecting payments"; "Stripe still needs a few details before you can sell paid tickets. Free tickets work meanwhile." |
| Connected | Tag "Paid out via Stripe"; "Payments connected" |
| Edge functions not deployed | "Payments are not switched on yet. Free tickets work now; paid tickets and refunds come soon." |
| No ticket types | "No tickets on this event yet." then "Tap Add a ticket below. Free tickets work straight away; paid ones need payments connected." (non-managers get the "Only an owner or manager ..." reason instead) |
| Event not live | "Put this event live before adding tickets." |
| Type statuses | draft "Not on sale yet", on_sale "On sale", paused "Paused", sold_out "Sold out", closed "Closed" |
| No orders | "No orders yet. ..." (three variants by role and whether anything is on sale) |
| More than the preview count of orders | "See all N orders" |
| Price after orders exist | Price field locked with a reason |
| Closed type | Sheet opens read-only |
| Contributor (read-only) | Every write control disabled with a reason |

### 2.5 Door screen (`door/model.ts`)

| Result | Band | Headline | Sub |
|---|---|---|---|
| ok | green | LET IN | "1 person ..." |
| already_in | amber | ALREADY IN | when it was scanned; "Do not let in again." |
| wrong_event | red | NOT FOR THIS EVENT | "This ticket is for a different event" |
| not_valid | red | NOT VALID | "This ticket was refunded or cancelled" |
| unknown_code | red | CODE NOT RECOGNISED | "No ticket matches this code" |
| not_allowed | grey | CANNOT CHECK TICKETS | "You're not on this event's team" |
| no signal | grey | NO SIGNAL | "Cannot check this code right now" |
| signed out (42501) | card | "You were signed out" | |
| camera denied / none | | says so plainly, opens the list tab with the code box | |

## 3. Verified by code and tests today vs Not verified

"Verified" means a unit/component/e2e test in this repo pins it with mocked network. Counts of `it`/`test` cases
come from `grep` of the files named, not from a run today; re-run `npm run test:unit` before relying on them.

| Area | Verified by (file) | Not verified (needs the Stripe sandbox or a real phone) |
|---|---|---|
| Flag off = no block, no route, no organiser route | `tickets/__tests__/flagOff.test.ts`, `organiser/tickets/__tests__/flagOff.test.ts` | Flag ON build on an actual Vercel preview |
| Type rows, availability (sold out, not yet, closed, left counts), quantity clamp, totals, disabled reasons | `ticketCheckoutModel.matrix.test.ts`, `screens.matrix.test.tsx`, `feeZero.matrix.test.tsx` | Real `ticket_types_public_v1` data (prod has 0 ticket types as of the 2026-10-27 survey; re-survey before the walk) |
| Fee is 0 and a non-zero fee still renders from the one constant | `feeZero.matrix.test.tsx`, `bookingFee.shared.test.tsx` | The server secret `TICKET_BOOKING_FEE_PENCE` value; Stripe amount equals page Total |
| Every server reason maps to copy; own-key lookup; timeout and rate-limit paths; double-tap guard | `checkoutFixes.matrix.test.tsx`, `reviewFixes.test.tsx` | The edge function actually returning each reason |
| Checkout request body, redirect only to `checkout.stripe.com`, free order path | `ticketCheckoutModel.matrix.test.ts`, `screens.matrix.test.tsx` | A real Stripe Checkout round trip; free-order issuance on the server |
| Preview origin gate (only with VERCEL_ENV=preview plus one https origin) | `ticketCheckoutModel.matrix.test.ts` (pure function) | The alias, the build env and the edge `TICKET_PREVIEW_ORIGIN` secret being set together |
| Thank-you copy per state, polling, never "Confirmed" before `paid`, stored order id handling | `orderStatus.test.tsx`, `reviewFixes.test.tsx`; e2e `tests/e2e/ticket-thanks.spec.ts` (390x844, mocked RPC; NOT in the `test:e2e` gate list because the flag is off there) | Webhook delivery and timing; `ticket_order_public_status_v1` on prod; the ticket email arriving and its spam placement |
| Organiser status words, allowed moves, form to payload, untouched save sends nothing | `organiser/tickets/__tests__/ticketModel.matrix.test.ts`, `compact.model.test.ts`, `ticketsApi.wire.test.ts`, `p3/tickets/__tests__/model.matrix.test.ts`, `stack.draft.test.tsx`, `tickets.matrix.test.tsx` | RPC behaviour on prod (`ticket_type_upsert_v1`, `ticket_type_set_status_v1`) with real rows |
| Get paid states and Stripe return params | `p3/tickets/__tests__/getPaid.matrix.test.tsx`, `legacyRedirect.*` tests | Real Stripe Connect onboarding (edge fn `stripe-connect-onboard` may not be deployed) |
| Refund sheet question and states | `p3/tickets/__tests__/tickets.matrix.test.tsx`, `ticketModel.matrix.test.ts` | A real refund through `ticket-refund`; the ticket going NOT VALID afterwards |
| Door result table, code parsing, scan debounce, camera-denied states, list states, 390x844 layout | `p3/door/__tests__/door.model.test.ts`, `door.screen.test.tsx`, `door.listShape.test.tsx`; e2e `tests/e2e/ticket-door-scanner.spec.ts` (in the `test:e2e` gate) | Real camera decode of a real QR on a phone (Chromium fake camera has no QR; iPhone Safari uses the jsQR fallback); no QR image is issued yet |
| Promo codes | Nothing: not built | Entire feature; blocked on admin PR #1125 per `ticket-promo-codes-web.md` |
| "My tickets" screen | Nothing: does not exist | Entire feature |
| Phone layout of the buyer block and organiser sheets | Design walks recorded in the handovers under `docs/handovers/` (screenshots, 390x844) | Walk on the final preview on a real phone, 320 wide too |
| `ticket-checkout` / `ticket-refund` / webhook edge functions | Contract read from deployed source (checkout v3) in `ticketing-buyer-journey.md` | Everything server side: not testable from this repo |

## 4. Sign-off

Record per step: pass / fail, phone model and browser, preview URL, time. Any BLOCKER above stops the go-live.
Known not-built items (promo codes, My tickets, ticket QR image) are not failures of the walk; list them as
"not built" so the owner decides whether they gate go-live.
