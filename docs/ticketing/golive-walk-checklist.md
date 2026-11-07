# Ticketing go-live walk checklist (phone, 390x844, private Vercel preview)

Docs only. Refreshed from the repo on `main` (origin/main 4a8bd97) at 2026-11-07 (first written 2026-11-05;
sources named per row). Nothing here was run against Stripe or prod; no Stripe calls, no secrets. Sources:
`docs/ticketing-buyer-journey.md`, `docs/organiser-ticketing-journey.md`, `docs/handovers/ticket-*.md`,
`docs/handover/ticketing-checkout-fixes.md`, `docs/scoping/go-live-flags-checklist.md`, `docs/arcs/ticketing.md`,
and the code under `src/modules/tickets/`, `src/modules/organiser/tickets/`, `src/modules/organiser/p3/tickets/`,
`src/modules/organiser/p3/door/`.

## 0. Read first: things the repo says that change the walk

1. **Promo codes are built** (admin A#1125; Website W#1366 organiser section, W#1372 and W#1387 buyer field;
   `docs/arcs/ticketing.md` slice "Promo codes", DONE). Organiser side: `src/modules/organiser/p3/tickets/promo/`
   ("Add a promo code" on the Tickets sheet). Buyer side: `src/modules/tickets/promo.ts` and the "Promo code
   (optional)" field in `TicketsBlock.tsx`. Walk it as Part E. The older handover
   `docs/handovers/ticket-promo-codes-web.md` (BLOCKED, 2026-10-29) is out of date.
2. **"My tickets" is built** (W#1334, W#1359; `docs/arcs/ticketing.md` slice "My tickets + door QR", DONE): route
   `/account/my-tickets` (`MY_TICKETS_PATH` in `myTicketsModel.ts`), mounted only while `publicTicketing` is on
   (`AnimatedRoutes.tsx`; flag off sends home). It needs a signed-in buyer; signed out it shows "Sign in to see
   your tickets". The buyer also gets the tickets by email and sees a door-code block on `/tickets/thanks`
   (`OrderQrBlock.tsx`). Walk it as Parts F and G.
3. **Checkout on a preview only works with two settings.** Buy is disabled on any origin other than
   `bachatacalendar.co.uk` / `www.` unless the preview build has `VITE_TICKET_PREVIEW_ORIGIN` set to ONE bare
   https origin (the stable walk alias) AND Vercel sets `VERCEL_ENV=preview` (`previewCheckoutOrigin` in
   `ticketCheckoutModel.ts`), AND the edge function has the same value as its `TICKET_PREVIEW_ORIGIN` secret
   (server side, not visible from this repo). Open the preview on exactly that alias. Without it you will see
   "Checkout only works on bachatacalendar.co.uk, not on this preview." and the walk stops at step 3.
4. **Flags** (build-time, Vercel env; full detail, call sites and flip order in
   [`docs/scoping/go-live-flags-checklist.md`](../scoping/go-live-flags-checklist.md), linked here, not copied).
   Each is on only when the env value is exactly `true`; "Live site OFF" = Production env leaves them unset.
   Live values: read the Production env, not verified here.

   | Flag (`src/lib/featureFlags.ts`) | Vercel env name | Routes / screens that need it |
   |---|---|---|
   | `publicTicketing` | `VITE_ENABLE_PUBLIC_TICKETING` | Tickets block on `/event/:id`, `/tickets/thanks`, `/account/my-tickets` |
   | `organiserTicketing` | `VITE_ENABLE_ORGANISER_TICKETING` | Inside P3: Get paid, Tickets entry, sales report, refunds, door route `events/:seriesId/door` (`P3Routes.tsx`) |
   | `organiserP3` | `VITE_ENABLE_ORGANISER_P3` | `/account/p3/*` (all organiser steps) |
   | `organiserSelfServe` | `VITE_ENABLE_ORGANISER_SELF_SERVE` | `/account/p3/*` only exists with `organiserP3` AND this on |

   The door needs `organiserTicketing` + `organiserP3` + `organiserSelfServe`. Separate from the four:
   typing the 6-character short code at the door needs `VITE_ENABLE_TICKET_DOOR_CODE=true` (`ticketDoorCode` in
   `src/modules/organiser/p3/door/doorFlags.ts`, not in `featureFlags.ts`); with it off, the door code box takes
   only the long QR token and the list is read-only (Part G).
5. **Stripe needs test mode end to end**: the organiser's connected account, the platform keys and the webhook
   must all be test-mode. Test card: `4242 4242 4242 4242`, any future expiry, any CVC, any postcode.
   Declined-card test: `4000 0000 0000 0002`. These are Stripe's published test numbers, nothing secret.
6. Fee: closed on the web side. `BOOKING_FEE_PENCE = 0` (`src/lib/ticketBookingFee.ts`; W#1135, W#1390), and
   `docs/arcs/ticketing.md` records "Remove the 50p booking fee" as DONE; the newest orders were reported with
   fee 0 since 2026-11-05 (ledger note, not re-read here). The edge secret `TICKET_BOOKING_FEE_PENCE` must be
   confirmed as `0` explicitly before the walk: value not read from the repo (secrets live in Supabase, and this
   session has no read of them). An unset secret defaults to 50 (`ticket-fee-zero-web.md`) and the server would
   charge 50p more per ticket than the page shows. **Check Total on the page equals the amount on the Stripe page.**
7. Use two accounts: an organiser (owner/manager of a page with one LIVE event) and a separate buyer email you can read.
8. **Edge functions must be current before the walk.** Functions: `ticket-checkout`, `ticket-email`,
   `stripe-webhook`, `ticket-refund`, `stripe-connect-onboard`. The deployed version must equal admin main:
   compare the Supabase function list (version and updated time) with the admin repo `git log` for
   `supabase/functions`. Do not start the walk on a stale `stripe-webhook`: partial refunds (Part I) depend on it.
   Not verified here: deployed function bytes.

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
- Below the Confirmed copy: the door-code block (`OrderQrBlock.tsx`, QR plus short door code per ticket, link "My tickets"). Then open the buyer's email and compare it with Parts F and G. The email body is written by the admin repo (`ticket-email`): not readable here, Not verified.

**B5. Free ticket**
- Tap: the free type, email, terms, **Get free ticket**.
- See: no Stripe; lands on `/tickets/thanks?o=<id>&free=1`: "Your free tickets are on their way" then the Confirmed copy once the server says paid.
- Failure: "Your free tickets could not be issued. Nothing was booked. Try again."

**B6. Cancel path**
- Tap: Buy, then Stripe's back arrow.
- See: back on the event with "Checkout cancelled. You have not been charged. You can try again below." and a
  usable form; `?tickets=cancelled` is removed from the URL after the first read.
- Failure: the notice reappears on reload; the form is empty or broken.

### Part C: Promo code (built; walked as Part E)

**C1.** Moved: see Part E. Step 0.1 holds the sources. Organiser creates the code (E1) before the buyer tries it (E2).

### Part D: Organiser sees the sale, door scan

**D1. Orders**
- Screen: P3 event page, the orders list under the ticket type.
- See: the buyer's order with name, quantity, total, date and a **Refund** button; with no orders yet:
  "No orders yet. They show here, by buyer name, the moment someone buys." (or the "Switch a ticket to Selling" /
  "An owner or manager can put a ticket on sale" variants).
- Failure: sale missing after B4 showed Confirmed; counts disagree with the buyer's tickets.

**D2. Door scan** (`/account/p3/events/<seriesId>/door`, full screen, via the **Scan tickets** row on the event page)
- Tap: **Scan tickets**, allow the camera, point at a ticket QR. Or use the code box: with `ticketDoorCode` on
  it takes the 6-character short code (Part G); with it off it takes only the long QR token (`DoorScreen.tsx`).
- See: green band **LET IN** "1 person ... enjoy the night" (or "1 person, ticket 1 of an order of N").
  Second scan of the same code: amber **ALREADY IN** with "Do not let in again.".
- Failure: **CODE NOT RECOGNISED**, **NOT FOR THIS EVENT**, **NOT VALID** (refunded) are correct for wrong input
  only; **CANNOT CHECK TICKETS** ("You're not on this event's team") for a team member is a role bug;
  **NO SIGNAL** with good signal is an RPC failure. Camera decoding of a real QR on a real phone is Part J
  (OWNER-ONLY, NOT VERIFIED): Chromium's fake camera in tests has no QR.

**D3. Refund**
- Tap: **Refund** on the order, keep "Refund all remaining" selected, read the sheet, tap the confirm button. (A part refund is Part I.)
- See: sheet "Refund <name>?" body "GBP 5 goes back. Their ticket stops working and the place reopens. Cannot be
  undone." then toast "Refund started." and the order tagged refunded.
- Then re-scan the same code: **NOT VALID** "This ticket was refunded or cancelled".
- Failure: "Payments are not switched on yet..." (edge fn `ticket-refund` missing, BLOCKER for refunds); refund
  button enabled for a contributor; ticket still scans LET IN after refund (BLOCKER).

### Part E: Promo code (flags: organiserTicketing + organiserP3 + organiserSelfServe for E1; publicTicketing for E2)

**E1. Organiser makes a code**
- Screen: P3 event page, the tickets row, then the "Promo codes" section (`promo/PromoSection.tsx`).
- Tap: **Add a promo code**, fill the sheet, save.
- See: with none yet "No promo codes yet. Tap Add a promo code to give buyers money off every ticket on this event."; after saving the code row with a state tag and an on/off switch.
- Failure: the code saves but the row has no state tag; a code on a free type changes nothing (correct: the buyer field only shows for paid types).

**E2. Buyer tries a bad code, then a good one**
- Screen: `/event/<id>` Tickets block, a PAID type picked (`promoOn` needs price above 0). A `?code=` link pre-fills the field but never applies it.
- Tap: type a wrong code in "Promo code (optional)", **Apply**. Then the good code, **Apply**, then **Buy tickets**.
- See: bad code: one of the lines in `promo.ts` ("That code isn't recognised. Check the spelling and try again."; also "That code is no longer active.", "That code has expired.", "That code has been fully used.", "That code isn't valid for this event."). Empty: "Type a code first, then tap Apply.". Good code: a "Promo code <CODE>" line with the saving, Total lower, a **Remove** button. Changing the quantity after Apply: "Your choice changed. Tap Apply to update the saving." and Buy waits. Stripe Total equals the page Total.
- Failure: Buy enabled while the note says to tap Apply; a Total that differs from Stripe; "With this code the total would be under 30p, which we can't charge. Please contact the organiser." is correct for a tiny total, not a bug.
- Then re-read the order in the organiser orders list and the report card (Part H): record what the discounted order shows. How promo orders show in Money so far is pinned by `moneySoFar.promo.test.tsx`, not walked.

### Part F: My tickets and the QR (flag: publicTicketing; signed-in buyer)

**F1. Open My tickets**
- Screen: `/account/my-tickets` (also reached from the thank-you page link "My tickets").
- See: heading "My tickets", a section "Upcoming" with the ticket just bought; **Show QR code** / **Hide QR code** per ticket draws the QR. Signed out: "Sign in to see your tickets" with a Sign in button. Nothing yet: "No tickets yet".
- Failure: "Your tickets could not be loaded" (the email still has them); "QR code unavailable for this ticket. Show your confirmation email at the door." on a fresh ticket is a bug to report; a refunded ticket still showing a live QR is a BLOCKER.
- After a door check-in (Part D): the ticket shows "Checked in" and "Already used at the door.".

### Part G: Short code at the door (flags as D2, plus VITE_ENABLE_TICKET_DOOR_CODE for typing it)

**G1.** Buyer side: the 6-character code ("Door code", shown as `K7M 2QX`) is under each QR on My tickets and on `/tickets/thanks` (W#1456, `DoorCodeLine.tsx`). Whether the ticket email also carries it comes from the admin `ticket-email` function: not readable from this repo, Not verified; read the real email and record what it shows.
**G2.** Door side: `/account/p3/events/<seriesId>/door`, code box labelled "Ticket code (6 letters and numbers, from the buyer's ticket email)", placeholder `K7M 2QX`, button **Check in**. Type the buyer's short code, once with the space and once lowercase, and record what happens.
- See: green **LET IN**; the same code again: amber **ALREADY IN**. After many wrong codes: the too-many-attempts answer ("Wait up to 15 minutes ...") and the list tab, where each "Not in" row has its own **Check in** button.
- Failure: a short code refused while the flag is on; the box rejecting a correct code; the flag off and the box still asking for a short code (flag wiring bug).

### Part H: Organiser sales report card and guest list CSV (flag: organiserTicketing; W#1445)

- Screen: P3 event page, Tickets sheet, the report card (`SalesReport.tsx`, model `salesReportModel.ts`).
- See: per type "N sold - N refunded - N left of N" and "Taken GBP - Refunded GBP - Net GBP", a Total row, "N of N checked in" once the door has been used, "N orders not paid, left out." when relevant. No sales: "No sales to report yet. Share the event so people can buy." and the download is greyed with "No paid orders yet. The guest list fills as people buy.".
- Tap: **Download guest list**. File name `guests-<event>-<date>.csv`; columns Order, Buyer name, Ticket type, Quantity, Status, Paid at, Refunded (pence); no email addresses in it (header comment of `salesReportModel.ts`). Open it on the phone and on a laptop.
- Failure: Net differs from Taken minus Refunded; the row count differs from the orders list; the CSV opens as one mangled column on the phone (record the app).

### Part I: Partial refund, then full refund (W#1458; needs the deployed `ticket-refund` and `stripe-webhook`, 0.8)

**I1. Partial**
- Tap: **Refund** on a paid order of 2 or more places, choose **Refund part of it**, type an amount below the order total in the "Amount to refund" field (max line: "Up to GBP N left to refund"), confirm (button reads the amount).
- See: body "The amount you enter goes back. Their tickets stay valid and the order stays paid. Cannot be undone."; toast "Refunded GBP X. GBP Y is left to refund. Tickets stay valid."; the order stays paid; the places left count is unchanged; the door still says LET IN for that buyer's tickets.
- Failure: the ticket scans NOT VALID after a partial (BLOCKER); the places count rises; an amount above the max accepted; the order tagged refunded after a partial.

**I2. Full**
- Tap: **Refund** again, **Refund all remaining** (or a part equal to what is left: "This gives back everything that is left on the order. Cannot be undone.").
- See: toast "Refund started.", the order tagged refunded after the webhook lands, the place reopens (the type's left count goes up), and the door says **NOT VALID** for those tickets.
- Failure: still LET IN after the full refund (BLOCKER); "Payments are not switched on yet ..." (`ticket-refund` missing).

### Part J: Real-phone door scan (OWNER-ONLY, NOT VERIFIED)

Only the owner can do this; no test or worker has. On a real iPhone (Safari) and a real Android phone (Chrome):
the camera permission prompt, the QR from My tickets (and from the email, if it has one) held on a second phone
screen at normal brightness, LET IN within a couple of seconds, ALREADY IN on the second scan, then Part G's
typed short code as the fallback. Record phone model, OS, browser, light and result. The repo only pins the jsQR
fallback and the fake-camera paths with mocks.

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

### 2.2 Promo errors (buyer field, `promo.ts`, one mapping)

Unknown, inactive, expired, used up, wrong event, no discount, under-30p total, empty, rate limited, network, timeout, ticket gone, bad quantity: each has its own plain sentence (Part E2 lists the first five). Any unknown reason falls to "That code could not be checked. Try again, or remove it to pay the full price." Tested by `promo.matrix.test.tsx`.

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
| Fee is 0 and a non-zero fee still renders from the one constant | `feeZero.matrix.test.tsx`, `bookingFee.shared.test.tsx` | The server secret `TICKET_BOOKING_FEE_PENCE` value (value not read from the repo); Stripe amount equals page Total |
| Every server reason maps to copy; own-key lookup; timeout and rate-limit paths; double-tap guard | `checkoutFixes.matrix.test.tsx`, `reviewFixes.test.tsx` | The edge function actually returning each reason |
| Checkout request body, redirect only to `checkout.stripe.com`, free order path | `ticketCheckoutModel.matrix.test.ts`, `screens.matrix.test.tsx` | A real Stripe Checkout round trip; free-order issuance on the server |
| Preview origin gate (only with VERCEL_ENV=preview plus one https origin) | `ticketCheckoutModel.matrix.test.ts` (pure function) | The alias, the build env and the edge `TICKET_PREVIEW_ORIGIN` secret being set together |
| Thank-you copy per state, polling, never "Confirmed" before `paid`, stored order id handling | `orderStatus.test.tsx`, `reviewFixes.test.tsx`; e2e `tests/e2e/ticket-thanks.spec.ts` (390x844, mocked RPC; NOT in the `test:e2e` gate list because the flag is off there) | Webhook delivery and timing; `ticket_order_public_status_v1` on prod; the ticket email arriving and its spam placement |
| Organiser status words, allowed moves, form to payload, untouched save sends nothing | `organiser/tickets/__tests__/ticketModel.matrix.test.ts`, `compact.model.test.ts`, `ticketsApi.wire.test.ts`, `p3/tickets/__tests__/model.matrix.test.ts`, `stack.draft.test.tsx`, `tickets.matrix.test.tsx` | RPC behaviour on prod (`ticket_type_upsert_v1`, `ticket_type_set_status_v1`) with real rows |
| Get paid states and Stripe return params | `p3/tickets/__tests__/getPaid.matrix.test.tsx`, `legacyRedirect.*` tests | Real Stripe Connect onboarding (edge fn `stripe-connect-onboard` may not be deployed) |
| Whole-refund sheet question and states | `p3/tickets/__tests__/tickets.matrix.test.tsx`, `organiser/tickets/__tests__/ticketModel.matrix.test.ts` | A real full refund through `ticket-refund`; the ticket going NOT VALID afterwards; the place reopening |
| Door result table, code parsing, scan debounce, camera-denied states, list states, 390x844 layout | `p3/door/__tests__/door.model.test.ts`, `door.screen.test.tsx`, `door.listShape.test.tsx`; e2e `tests/e2e/ticket-door-scanner.spec.ts` (in the `test:e2e` gate) | Real camera decode of a real QR on a phone (Chromium fake camera has no QR; iPhone Safari uses the jsQR fallback): Part J, OWNER-ONLY |
| Promo codes, buyer field | `tickets/__tests__/promo.matrix.test.tsx`, `promo.block.test.tsx` | Real `ticket-checkout` pricing with a code; Stripe Total equals page Total with a code |
| Promo codes, organiser section | `p3/tickets/__tests__/promo.matrix.test.tsx`, `promo.wire.test.ts`, `moneySoFar.promo.test.tsx`; e2e `tests/e2e/walk-p3-promo-codes.spec.ts` (needs the three organiser flags on; not in the `test:e2e` gate list) | Create, switch off and edit on real prod rows; used counts after a real payment |
| "My tickets" screen, QR, short door code | `tickets/__tests__/myTickets.matrix.test.tsx`, `myTicketsQr.test.ts`, `orderQr.test.tsx`, `ticketWhere.matrix.test.tsx` | Prod RPC with real orders; the QR scanned by a real phone camera (Part J); whether the ticket email carries the short code |
| Door short code typing and Check in rows | `p3/door/__tests__/door.shortCode.matrix.test.tsx`; e2e `tests/e2e/ticket-door-code.spec.ts` (needs `VITE_ENABLE_TICKET_DOOR_CODE`) | The flag value on the preview; rate limit behaviour on prod |
| Sales report card and guest list CSV | `p3/tickets/__tests__/salesReport.matrix.test.tsx`, `salesReport.csv.test.ts`, `salesReport.model.agree.test.ts` | The CSV opened on a real phone; real order shapes (refunded, disputed, over 100 rows) |
| Partial refund amount on the Refund sheet | `p3/tickets/__tests__/refund.partial.test.tsx` | A real partial refund through `ticket-refund` and `stripe-webhook`; the ticket staying LET IN afterwards; places count unchanged |
| Phone layout of the buyer block and organiser sheets | Design walks recorded in the handovers under `docs/handovers/` (screenshots, 390x844) | Walk on the final preview on a real phone, 320 wide too |
| `ticket-checkout` / `ticket-refund` / webhook edge functions | Contract read from deployed source (checkout v3) in `ticketing-buyer-journey.md` | Everything server side: not testable from this repo |

## 4. Sign-off

Record per step: pass / fail, phone model and browser, preview URL, time. Any BLOCKER above stops the go-live.
Part J (real-phone door scan) is OWNER-ONLY and NOT VERIFIED until the owner records it. Anything the walk finds
that is missing from the screens above is listed, not silently skipped, so the owner decides whether it gates go-live.

## 5. Before live (owner or lead; not worker tasks; no secret values here)

- Remove the `TICKET_PREVIEW_ORIGIN` Supabase secret (`docs/arcs/ticketing.md`, owner/lead task); the preview checkout gate in 0.3 then stops working, on purpose.
- Clean the test orders and test Stripe rows: the owner names exactly what to delete (the arc records "leave for now" from 2026-10-28; revisit before live). Nothing is deleted on the strength of this list.
- Live Stripe keys and the live webhook are owner-only. Confirm `TICKET_BOOKING_FEE_PENCE` is still 0 after any secret change.
- Flip the flags in the order given in `docs/scoping/go-live-flags-checklist.md`; read the Production env first (not verified here).
