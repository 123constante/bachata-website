# Review: S4 buyer checkout (PR #1063, branch `claude/ticketing-checkout`)

Independent review, reviewer branch `claude/ticketing-checkout-review`. Brief:
`briefs/ticketing-checkout-review.md` (branch `brief/ticketing-checkout-review`).
Reviewed head: `52b2d15` (`origin/claude/ticketing-checkout`, 16 files, +1413).
Line numbers below are from that head.

**Verdict: nothing blocking.** The money path is right: the client's totals equal what
the server charges, no price or fee is taken from the client, the quantity cap and the
redirect-origin allow-list match the deployed function, and nothing logs or puts an email
or name in a URL. Eight should-fix items (one needs the DB side), the rest nits.

## How the server was verified (read-only, no call)

The brief says not to call `ticket-checkout`; its deployed source was READ instead
(`get_edge_function`, version 3, `verify_jwt: true`), together with the three RPCs it
calls (`pg_get_functiondef`, prod project `stsdtacfauprzrdebmzg`):

- `ticket_checkout_reserve_v1`: `v_sub := price_pence * quantity`;
  `v_fee := CASE WHEN v_sub = 0 THEN 0 ELSE p_booking_fee_per_ticket_pence * quantity END`;
  `total = v_sub + v_fee`; quantity 1..20; email checked; `sold_out` when
  `reserved_count + quantity > capacity`; `organiser_not_onboarded` only for paid types.
- `_shared/ticketing.ts`: `MAX_QUANTITY = 20`, `DEFAULT_BOOKING_FEE_PENCE_PER_TICKET = 50`
  (overridable by env `TICKET_BOOKING_FEE_PENCE`), `SITE_ORIGINS` = the same two
  `bachatacalendar.co.uk` origins as the client's `CHECKOUT_ORIGINS`, redirect URLs must be
  https on those (or `TICKET_PREVIEW_ORIGIN`, unset). Stripe line items: ticket x quantity
  plus one "Booking fee" line of `booking_fee_pence`; `application_fee_amount` = the same.
- `ticket_types_public_v1`: `price_pence integer NOT NULL`, `remaining = greatest(capacity -
  reserved_count, 0)`, only `on_sale`/`sold_out` of a `live` series, keyed on
  `event_series_p5.id` (the handover's DB note 1 is confirmed).

So for a paid type the buyer pays `price x qty + 50 x qty`, a free type pays nothing, and
`totals()` in `ticketCheckoutModel.ts:113-118` computes exactly that. The client's
`isEmail` is the function's regex and length cap. The client body carries no price.

The builder's unit suite (193 tests, 3 files) was run on a checkout of `52b2d15`: all
pass.

## Findings (ordered: should-fix first, then nits)

### 1. should-fix (DB side) -- the 50p fee is pinned in three client places while the server's fee is an env value

`src/modules/tickets/ticketCheckoutModel.ts:10` (`BOOKING_FEE_PENCE = 50`),
`src/modules/tickets/TicketsBlock.tsx:252` ("+ 50p booking fee per ticket"),
`src/modules/tickets/legalCopy.ts:14` ("50p per ticket"). The function reads
`TICKET_BOOKING_FEE_PENCE` (`bookingFeeFromConfig`) and its reply carries no total, so the
client cannot check what Stripe will charge.

Failing scenario: the owner sets `TICKET_BOOKING_FEE_PENCE=75` on the function. Every
total on the event page and the terms of sale say 50p; Stripe's page shows a 75p booking
fee line. The buyer sees a different total at Stripe from the one they agreed to.

Fix (admin repo): add `booking_fee_pence` to the `ticket_types_public_v1` row (or to the
checkout reply) and have the client render that, falling back to refusing Buy when it is
absent. Until then, record in the admin repo that the env must stay unset / 50, and keep
the Website constant. Not a Website change on its own.

### 2. should-fix -- the thank-you page asserts "Payment received" with no evidence of a payment

`src/modules/tickets/TicketThanksPage.tsx:45` renders `copy.title`;
`src/modules/tickets/ticketCheckoutModel.ts:244` makes that "Payment received, your tickets
are being emailed" for every non-free visit, with or without an order id. The body already
hedges when there is no id ("If you completed payment..."), the heading does not.

Failing scenario: a buyer presses Back from Stripe without paying, later taps a history
entry for `/tickets/thanks` (storage cleared, no `?o=`): the page's heading says payment
was received. Same for anyone who types the URL.

Fix: when `hasOrder` is false, title "Thanks for your order" (or "Your ticket order") and
keep the hedged body. Pair with finding 7 so a garbled `?o=` does not count as an order.

### 3. should-fix -- no timeout on the checkout POST: a stalled network leaves "Working on it..." forever

`src/modules/tickets/ticketCheckoutApi.ts:41-49`: `fetch` with no `signal`; `TicketsBlock.tsx:115`
sets `submitting` and `disabledReason` (`ticketCheckoutModel.ts:144`) keeps Buy disabled
with "Working on it..." until the promise settles. A 2G phone or a dropped connection that
does not error can hold the request for minutes with no way forward on screen.

Fix: `signal: AbortSignal.timeout(20_000)` on both sends; an `AbortError`/`TimeoutError`
lands in the existing `catch` as `reason: 'network'` ("Could not reach the ticket service.
Check your connection and try again."). Retrying is safe: the server-side order, if one
was created, expires on its own and the rate check allows the retry.

### 4. should-fix -- on a preview or localhost the origin reason is shown last, after the buyer has typed their email and ticked the terms

`src/modules/tickets/ticketCheckoutModel.ts:139-143`: the checks run quantity, email,
email format, terms, THEN origin. The screen matrix test at
`__tests__/screens.matrix.test.tsx:150-156` pins the reason only after `fillAndBuy()`.

Failing scenario (390x844, Vercel preview with the flag on): the buyer picks a type, types
their email, ticks the box, and only then reads "Checkout only works on
bachatacalendar.co.uk, not on this preview." The form asked for work it could never use.

Fix: move the origin check to directly after `if (!f.type)` so the reason shows before any
field is filled, and update the matrix test. (Also hide the email/name inputs in that
state if you want; the reason alone is enough.)

### 5. should-fix -- no `<form>`: the phone keyboard's Go/Return key does nothing and `required` is inert

`src/modules/tickets/TicketsBlock.tsx:262-283, 315-324`: inputs sit in plain `<label>`s and
Buy is `type="button"`. The `required` on the email input (`:266`) never fires without a
form, and Return on the email field does not submit.

Fix: wrap the quantity..Buy section in `<form onSubmit={(e) => { e.preventDefault();
void onBuy(); }} noValidate>` and make Buy `type="submit"`. `onBuy` already guards on
`reason`, so Return while disabled is a no-op.

### 6. should-fix -- rate-limit copy hides the real cause after a cancelled checkout

Server: `ticket_checkout_rate_check_v1` refuses when the buyer's PENDING orders for a type
plus the new quantity exceed 20; a cancelled or abandoned Stripe session stays `pending`
(and its `reserved_count` stays taken) until the session expires, 32 minutes
(`CHECKOUT_EXPIRES_AFTER_SECONDS`). The 429 message the client shows verbatim
(`ticketCheckoutModel.ts:224`) is "Too many ticket requests. Please wait a while and try
again."

Failing scenario: a buyer picks 10, cancels at Stripe, picks 10 again, cancels again, then
tries 1: refused as rate-limited for up to half an hour, and meanwhile the row shows 20
fewer "left" to everyone. The copy says nothing about why.

Fix (client, copy only; the function does not send `limit`): for `rate_limited`, append
"If you cancelled a checkout just now, those tickets are held for about 30 minutes." The
held-stock behaviour itself is a server design point for the orchestrator (close the
pending order when `cancel_url` is hit, or shorten the expiry).

### 7. should-fix -- `?o=` is trusted verbatim: any string becomes the order reference and counts as an order

`src/modules/tickets/TicketThanksPage.tsx:20` (`params.get('o') ?? stored`), `:32`
(`Boolean(orderId)` -> confident copy), `:49` (`orderId.slice(0, 8)` rendered).

Failing scenario: `/tickets/thanks?o=hello` shows "Order reference: hello" and "Your
tickets will arrive by email in a few minutes." `?o=` (empty) gives `''`, which `??` does
not fall through, so the stored id is used only via the effect's `!params.get('o')` path,
not the render's: first paint shows no reference, the next shows it.

Fix: `const fromUrl = params.get('o'); const orderId = fromUrl && UUID.test(fromUrl) ?
fromUrl : stored;` with the same UUID regex the function uses, and treat anything else as
"no order".

### 8. should-fix -- server reasons the client does not map

`src/modules/tickets/ticketCheckoutModel.ts:207-220` covers 12 reasons. The deployed
function and RPCs can also send: `invalid_quantity`, `invalid_email`, `invalid_fee`
(reserve, 409), `refused` (reserve `ok:false` with no reason), `free_issue_failed`,
`not_free`, `not_pending`, `stale` (free issue, 409), `method_not_allowed` (405). All fall
to the generic "Your tickets could not be booked. You have not been charged. Try again."
(`:225`), which is true. But `invalid_email` should be `fix_form`, and `stale` /
`not_pending` on a free order mean the server already closed that order as failed, so
"Try again" is right while "Pick another ticket" would mislead. Add `invalid_quantity` and
`invalid_email` as `fix_form`; the rest can stay on the fallback.

### 9. nit -- cancel return keeps the unpaid order id in sessionStorage

`src/modules/tickets/TicketsBlock.tsx:64, 94-100` read and strip `?tickets=cancelled` but
never `clearOrderId()`. Only surfaces if `/tickets/thanks` is later opened without `?o=` in
the same tab (then shows the cancelled order's reference). Call `clearOrderId()` where
`cancelled` is first read.

### 10. nit -- the redirect URL is any https URL

`src/modules/tickets/ticketCheckoutModel.ts:192` accepts `checkout_url` matching
`^https://`. The function is ours, so this is defence in depth only: pin to
`^https://checkout\.stripe\.com/`.

### 11. nit -- `free=1` is trusted from the URL

`TicketThanksPage.tsx:31`. Cosmetic: anyone can show themselves the free-ticket wording.
Nothing is issued by it. Leave or fold into finding 7.

### 12. nit -- "/privacy" is plain text inside the terms

`src/modules/tickets/legalCopy.ts:25` says "See our privacy policy at /privacy"; the block
renders it as a string (`TicketsBlock.tsx:309`). Render the path as a `<Link to="/privacy">`.

### 13. nit -- `/tickets/thanks` answers 200 with the client NotFound while the flag is off

`src/components/catchallClientPaths.ts:43` lists the path unconditionally; the catchall
gate (`app/catchallGate.ts`) then serves 200 and the client renders NotFound (a soft 404).
Same as the S3 `/account/tickets/*` precedent the handover cites. Acceptable; noting that
"no route is mounted" holds while "the URL 404s" does not.

### 14. nit -- the DRAFT legal copy ships in the built chunk while the flag is off

`legalCopy.ts` is imported by `TicketsBlock.tsx:23`, so `dist/assets/TicketsBlock-*.js`
(with the DRAFT terms as string literals) is built and deployed; it is never requested or
rendered while `flags.publicTicketing` is false (BentoPage's lazy import only fires on
render, `BentoPage.tsx:106, 760`). The brief's bar ("not shown to real users") is met;
"not on the CDN" is not. Fine as is.

### 15. nit -- "not yet" / "closed" use the phone's clock

`ticketCheckoutModel.ts:84-87`. A phone with a wrong clock hides Buy ("Sales closed") or
shows it and then gets `outside_sales_window` (which is mapped). Rare; the server is the
authority either way.

### 16. nit -- after a refusal focus stays on the disabled Buy

`TicketsBlock.tsx:194-209`: `role="alert"` announces to screen readers; a sighted keyboard
user is left on a disabled button above/below the alert. Move focus to the alert's way-
forward control.

### 17. nit -- double-tap on Buy relies on React 18's synchronous flush of discrete events

`TicketsBlock.tsx:113-116`: `setSubmitting(true)` before the `await`, and React 18 flushes a
click handler's state before the next click is dispatched, so a second tap sees a disabled
button. Correct today; a `useRef` guard would make it not depend on that.

### 18. nit -- the thanks route is not wrapped in `PageTransition`

`src/components/AnimatedRoutes.tsx:226` unlike every neighbour. Harmless; the flagOff test
pins this exact markup, so changing it means changing the test.

## Checked and found correct

- **Money**: see the server section. `formatPence` renders whole pounds without pence and
  otherwise two decimals; the fee line and total are computed from the one `totals()`.
  Free type: no fee line, "Free" total, "Get free ticket" (`ticketCheckoutModel.ts:148`).
- **Quantity**: `maxQuantity` = `min(20, remaining)`, 0 when not buyable; the stepper only
  moves from the clamped `qty`, `-` disabled at 1, `+` at max; the note says "Only N left."
  only when remaining is the binding cap (`TicketsBlock.tsx:239-243`).
- **Origins**: `checkoutOriginOk` is the function's `SITE_ORIGINS`; `onBuy` is guarded by
  the same `reason`, so a preview never POSTs (test pins it).
- **PII**: no `console.*` in the module; email and name travel only in the JSON body;
  `?o=` carries the order id only.
- **Hand-off**: `saveOrderId` before `window.location.assign`; sessionStorage survives the
  cross-origin round trip in the same tab; the thanks page moves it into `?o=` (replace)
  then clears it, so a refresh keeps the reference and a later visit does not show an old
  one. Storage blocked: every call is try/catch, page still renders.
- **bfcache / Back from Stripe**: `pageshow` with `persisted` resets `submitting`
  (`TicketsBlock.tsx:86-92`). A non-bfcache Back reloads with fresh state.
- **Cancel return**: `cancel_url` = same path + the current search (`?occurrenceId=...`)
  + `tickets=cancelled`; the block reads it once into state and strips it with `replace`.
  `AnimatedRoutes.tsx:99-111` keys `<Routes>` on `pathname` only, so that replace does not
  remount the block and the notice stays (the test at `screens.matrix.test.tsx:216-230`
  pins the URL after the strip).
- **401 as guest**: a stale session token is refused by the verify_jwt gateway before the
  function runs (no order exists); one retry with the publishable key; a second 401 maps to
  `unauthorised` with "refresh and try again". Precondition the owner should know: the
  gateway needs a JWT bearer, so `VITE_SUPABASE_PUBLISHABLE_KEY` on prod must stay the
  legacy anon JWT (as the raffle and account functions already rely on); an
  `sb_publishable_...` key would 401 every guest.
- **Offline**: `fetch` throws -> `network` reason with "Check your connection". The types
  RPC failing hides the block (journey doc says so).
- **Flag off**: `flags.publicTicketing` is `=== 'true'` on its own env var; the route is
  `{flag ? <Route/> : null}` with a module-level `lazyWithRetry` that is never rendered;
  BentoPage's `import('@/modules/tickets/TicketsBlock')` sits inside `lazyWithRetry` and
  is requested only when the guarded JSX renders. `flagOff.test.ts` pins all of it.
- **Shapes**: BentoPage gate (`BentoPage.tsx:760`) = ready, not past/ended, occurrence not
  cancelled, not paused: the same suppression as the sticky bar's ticket link. 0 types ->
  `null`; sold out only -> rows say "Sold out" + "No tickets can be bought right now";
  not open yet -> "On sale Fri 20 Nov 19:00"; closed -> "Sales closed"; per-night types
  only on their own night (`typesForNight`), series-wide on every night (handover note 2,
  a product decision). Draft/archived/ended series: the RPC returns no rows. Mixed
  free + paid: totals follow the picked type.
- **Mobile**: every control has an explicit px height >= 44 (rows `min-h-[44px]`, stepper
  44x44, inputs 44, checkbox label 44, terms toggle 44, Buy 48, alert control 44, thanks
  link 44); inputs are 16px (no iOS zoom), black on the UA's white field (no
  `color-scheme: dark` anywhere, so the field stays white); names `truncate`, price
  `shrink-0`, so no sideways scroll; every input has a label; Buy's reason is
  `aria-describedby`; disabled rows keep their label.
- **Legal copy**: `legalCopy.ts:1-7` is headed DRAFT with `LEGAL_COPY_STATUS = 'DRAFT'`;
  it renders only inside `TicketsBlock`, which only mounts behind the flag. The 14-day
  cancellation statement is correct for a dated event (CCR 2013 reg 28(1)(h)). The refund
  and fee sentences are the owner's call, as the handover says.
- **Round-2 commit `71019a0`** (read line by line): the `picked`/`selected` fallback drops a
  pick that is no longer buyable; the quantity-sync effect was replaced by a derived
  `qty`, which is simpler and right; the `pageshow` reset, the cancel-param strip, the
  `cancelReturnPath` keeping `?occurrenceId`, the alert moved above the form, the
  organiser-side refusal disabling Buy with its own reason, the `orderStorage` extraction,
  and the one-shot 401 retry are all correct. No regression found; findings 3, 4, 7, 9
  above are things it did not touch.

## Verified / Not verified

Verified:
- Deployed `ticket-checkout` source (v3) and the three RPCs read in full (read-only).
- `ticket_types` column types (`price_pence integer NOT NULL`, `occurrence_id uuid NULL`).
- Builder's unit suite on `52b2d15`: 193/193 pass locally.
- Route keying, catchall gate, CSS colour scheme, redirect config read.

Not verified:
- No browser walk by this reviewer; tap sizes and scroll are from the source only.
- No real or test-mode checkout.
- The prod value of `VITE_SUPABASE_PUBLISHABLE_KEY` (JWT vs `sb_publishable_`) was not
  read.
