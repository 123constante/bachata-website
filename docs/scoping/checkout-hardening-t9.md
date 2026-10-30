# T9 scoping: checkout hardening (2026-10-30)

Read-only scoping of item T9 in `docs/scoping/ticket-followups-2026-10-30.md` (branch
`claude/scope-ticket-followups`). No source was changed. Sources read:

- Website (this repo, `main` at a1d0fa6): `src/modules/tickets/ticketCheckoutModel.ts`,
  `TicketsBlock.tsx`, `ticketCheckoutApi.ts`, `orderStorage.ts`;
  `docs/handover/ticketing-checkout.md`, `docs/handover/ticketing-checkout-fixes.md`.
- Admin (`123constante/bachata-admin`, shallow clone at 95c2f22), prefixed `admin:` below:
  `supabase/functions/ticket-checkout/index.ts`, `supabase/functions/_shared/ticketingHandlers.ts`,
  `supabase/functions/_shared/ticketing.ts`, and the migrations
  `20270302020000_ticketing_p1_schema_v1.sql` (P1), `20270304170000_ticketing_p2_hardening_v1.sql`
  (P2), `20270306000000_ticketing_s1c_public_id_rate_fold_v1.sql` (S1c),
  `20270306190000_ticket_order_public_status_v1.sql` (STATUS).

Migration files were read from the repo; the live database was not queried (see Not verified).

## How one checkout works today (shared facts)

1. Website POSTs `{ ticket_type_id, quantity, buyer_email, buyer_name?, success_url, cancel_url }`
   with `fetch` and a 20 s abort (`ticketCheckoutModel.ts:187-194`, `ticketCheckoutApi.ts:49,71-75`).
   No idempotency header or field, no occurrence id.
2. Edge function `handleTicketCheckout` (`admin: ticketingHandlers.ts:158`):
   - `ticket_checkout_rate_check_v1` (`:190`): 5 allowed attempts per email per hour, 30 per IP
     per hour, and at most 20 admissions in `pending` orders per email per ticket type
     (`admin: S1c:62-91`). Every allowed attempt inserts a `ticket_checkout_attempts` row.
   - `ticket_checkout_reserve_v1` (`:209`; body `admin: P2:78-148`): locks the type, checks status
     and the sales window against the DB `now()` (`P2:110-111`), adds to `reserved_count`, inserts
     a `pending` order.
   - Creates a Stripe Checkout Session with Stripe `Idempotency-Key: checkout-<order.id>`
     (`:254`) and `expires_at = now + 32 min` (`admin: ticketing.ts:44,260`), then attaches the
     session id (`:265`; attach only succeeds when the order is pending and has no session yet,
     `admin: P1:243-246`).
3. A pending order is released by `ticket_order_close_unpaid_v1` (`admin: P1:260-290`), called by
   the `checkout.session.expired` webhook (`admin: ticketing.ts:416-422,534-535`) or the 5-minute
   sweeper: no session after 10 min, or a session after 37 min (`admin: P2:502-522`).

---

## T9.1 A cancelled Stripe session holds tickets (and the rate allowance) for 32 minutes

**Today.** `cancel_url` is the event page plus `?tickets=cancelled`
(`ticketCheckoutModel.ts:196-201`, sent at `TicketsBlock.tsx:126-127`). On landing, the block shows
"Checkout cancelled" (`TicketsBlock.tsx:160-163`) and calls `clearOrderId()`, which throws away
the only client-side copy of the order id (`TicketsBlock.tsx:100-108`; the id lives in
`sessionStorage`, `orderStorage.ts:10,18`). Nothing tells the server. The order stays `pending`
until Stripe expires the session (32 min) and the webhook closes it, or the sweeper does (37 min).
The client already warns about this (`ticketCheckoutModel.ts:243-244`, appended to
`rate_limited` copy at `:277`).

What is held:
- Capacity: `reserved_count` stays up, and a type that hit capacity stays `sold_out`
  (`admin: P2:130-133`).
- The "20 admissions in pending orders per email per type" limit (`admin: S1c:86-91`).
- NOT held by this item: the 5-per-email-per-hour attempt count (`admin: S1c:74-78`). That counts
  attempts, not orders, so closing the order on cancel would not give those back.

**Failing input.** A type with capacity 4 and 4 remaining. Buyer picks 4, reaches Stripe, taps
"Back". The event page says "Checkout cancelled", but the type shows Sold out to everyone for up
to 32-37 minutes. A second buyer who would have paid is turned away. Same buyer: picks 20 of a
large type, cancels, tries 1 again -> `rate_limited` (`unpaid`) for up to 32-37 min.

**Smallest fix.**
1. Website: on landing with `?tickets=cancelled`, read the order id (`readOrderId()`) BEFORE
   `clearOrderId()`, and fire one POST with it to the server (fire-and-forget; the copy does not
   change if it fails, the 32 min expiry is the fallback).
2. Edge function (new `ticket-checkout-cancel`, or an `action: "cancel"` branch of
   `ticket-checkout`): accept `{ order_id }`, load the order; only if `status = 'pending'` and a
   session is attached, call Stripe `POST /v1/checkout/sessions/<id>/expire` on the connected
   account. The expire call already exists in the handler (`admin: ticketingHandlers.ts:272`).
   Then either let the `checkout.session.expired` webhook close the order (no new DB code), or
   call `ticket_order_close_unpaid_v1(order, session, 'expired')` directly. Expiring on Stripe
   first matters: closing only the DB order would leave a payable Stripe page behind the
   browser's Back button (a late `completed` would then be marked paid with capacity already
   released; the sweeper comment calls that "oversold logged", `admin: P2:506-507`).

**DB / edge change.** Edge function: yes. DB: no new SQL needed if the existing close RPC and the
webhook are reused. Possibly a narrow lookup RPC if the edge function has no existing read of an
order by id (not checked).

**Size.** S-M (website S, edge function S-M with tests).

---

## T9.2 No idempotency key on `ticket-checkout`

**Today.** The website gives up after 20 s (`ticketCheckoutApi.ts:49-56,75`) and shows
"took too long ... Try again" (`ticketCheckoutModel.ts:270-271`). `inFlight` only blocks a second
tap while the first request is open (`TicketsBlock.tsx:75,121-123`), so after a timeout the
retry is a brand-new request. The edge function has no request key: each call runs rate check,
reserve and a new order (`admin: ticketingHandlers.ts:190,209`). The Stripe key
`checkout-<order.id>` (`:254`) dedupes only per order, so it does not help across two orders.

**Failing input.** Buyer taps Buy for 3 tickets. The edge function reserves and creates the
session, but the reply arrives after 20 s (slow mobile network). The page shows "took too long";
buyer taps again and pays on the second order. The first order holds 3 tickets for 37 min
(session attached; sweeper `admin: P2:521-522`) or 10 min (no session). Both attempts count
toward the 5-per-hour limit, and both orders count toward the 20-pending limit.

**Smallest fix.**
1. Website: create one key per Buy press (`crypto.randomUUID()` when the form is submitted), keep
   it in component state across "Try again" while type, quantity and email are unchanged, send it
   as `idempotency_key` in the body.
2. DB (admin migration): add `ticket_orders.idempotency_key uuid` with a UNIQUE index; a new
   `ticket_checkout_reserve_v2` that, when the key already exists, returns the existing order if
   it is still `pending` and matches type, quantity and folded email (else a refusal such as
   `idempotency_mismatch`). The rate check must not count a replay as a new attempt (either check
   the key first in the edge function, or teach `ticket_checkout_rate_check_v1` about it).
3. Edge function: pass the key; for a replayed order with a session already attached, return the
   existing session URL. Note the attach RPC refuses an order that already has a session
   (`admin: P1:243-246`), so a replay must skip attach, or fetch the session from Stripe (the same
   Stripe idempotency key `checkout-<order.id>` returns the same session within Stripe's 24 h key
   window).

**DB / edge change.** Both: a migration (column, unique index, reserve v2) and the edge function.

**Size.** M.

---

## T9.3 Series-wide ticket types on a weekly series carry no date

**Today.** A type with `occurrence_id IS NULL` is series-wide (`admin: P1:51`;
`ticketCheckoutModel.ts:32-33`) and is offered on every night's page
(`typesForNight`, `ticketCheckoutModel.ts:104-106`). The page knows the night (`occurrenceId`
prop, `TicketsBlock.tsx:36-37`), but the checkout body has no occurrence field
(`ticketCheckoutModel.ts:187-194`), the edge function reads none (`admin:
ticketingHandlers.ts:174-180`), and `ticket_orders` has no occurrence column (`admin: P1:70-92`,
`P2:43-51`). The public status read takes the date only from the TYPE's occurrence
(`admin: STATUS:90,96,101,106`), so a series-wide order has `event_date` null. Capacity is one
counter per type, shared across all nights (`admin: P1:55-56`).

**Failing input.** Weekly series, one series-wide type "Entry GBP 10", capacity 100. Buyer opens
the 7 Nov night (`?occurrenceId=<7 Nov>`) and buys 2. The order, tickets and thank-you page carry
no date. Door staff on 14 Nov cannot tell whether the ticket was meant for 7 Nov. A sell-out on
7 Nov (100 sold) also makes every later night show Sold out.

**Smallest fix.** Depends on the owner's answer (Q1):
- (a) "Any night" is intended: website copy only, e.g. label series-wide rows "Valid any night"
  in `TicketsBlock.tsx` and in the thank-you text. No DB / edge change. Size S.
- (b) Per-night only, simplest form: forbid series-wide types on a recurring series in the admin
  type upsert RPC (`ticket_type_upsert_v1`, `admin: P2:578-690`), so organisers must pick a night. DB change (RPC).
  Existing series-wide types would need a decision. Size M.
- (c) Series-wide types sold per night: add `occurrence_id` to the body and to `ticket_orders`,
  validate it in reserve (in the series, scheduled, not past), and keep capacity per night (a new
  per-occurrence counter). DB, edge and website change. Size L.

**DB / edge change.** (a) none; (b) DB; (c) DB + edge + website.

---

## T9.4 "Not yet" / "closed" use the phone's clock

**Today.** `now` is `new Date()` on each render (`TicketsBlock.tsx:61`). `availability`
compares `sales_open_at` / `sales_close_at` with it (`ticketCheckoutModel.ts:95-101`); the
stepper max and the disabled reason follow (`:110-111,171-176`). The server checks the same
window with the DB clock (`admin: P2:110-111`) and refuses with `outside_sales_window`, which
the client already explains (`ticketCheckoutModel.ts:256`). Also: nothing re-renders when a
window opens or closes while the page is idle.

**Failing input.**
- Phone 10 min fast, sales open 20:00, real time 19:55: row shows buyable, Buy is refused
  `outside_sales_window`.
- Phone 10 min slow, real time 20:01: row says "On sale <date>" and is disabled although the
  server would sell.
- Page opened at 19:59 and left alone: still "On sale ..." at 20:01 until something re-renders.

**Smallest fix.** Website plus one DB read change. Return the server time with the type list
(e.g. a `server_now timestamptz` column; `ticket_types_public_v1` returns a fixed TABLE
(`admin: S1c:106-112`), so adding a column means a new `ticket_types_public_v2` or DROP +
CREATE). The client keeps `offset = server_now - Date.now()` and uses `new Date(Date.now() +
offset)`, plus one timer to re-render at the next open/close boundary. Website-only fallback
with no DB change: on `outside_sales_window`, already re-reading the list (`TicketsBlock.tsx:
141-145`) is the safety net, so the only harm is a wrong label; the owner may accept that.

**DB / edge change.** DB: small (public read v2) for the full fix; none for the fallback.

**Size.** S.

---

## Proposed build order

1. T9.1 cancel close (S-M, edge function only, no migration): biggest buyer-visible win and
   reuses existing code paths.
2. T9.4 clock (S): independent; can ride with T9.1 if the owner wants one website PR.
3. T9.2 idempotency (M): migration + edge + website. Do after T9.1 so the replay rules and the
   cancel path are designed together (a replayed key for a cancelled order must not revive it).
4. T9.3 after the owner answers Q1; (a) can ship any time, (b)/(c) are a separate arc.

Per the follow-ups doc, T9 collides with T4 (phone walk on a preview origin): test the current
flow for real first.

## Questions only the owner can answer

1. Weekly series: is a series-wide ticket "any night" (one shared capacity), or must every
   ticket be for one night? If per night, should organisers be forced to pick a night (b) or
   should the buyer's night be recorded per order (c)?
2. Cancel close: is it acceptable that anyone holding the order id (only the buyer's tab has it)
   can cancel that pending order? Or should cancel need the Stripe session id too?
3. Should a cancelled checkout also give back one of the 5-per-hour attempts, or keep that limit
   strict?
4. Clock: is a wrong "On sale <date>" label acceptable (fallback, no DB change), or is the
   server-time read wanted?
5. Idempotency: should a retry with a changed quantity reuse or replace the first pending order?

## Not found

- No cancel endpoint, cancel RPC or cancel webhook path in the admin repo besides Stripe's own
  expiry and the sweeper.
- No occurrence id anywhere in the checkout request, handler or `ticket_orders`.
- No idempotency key between website and edge function (Stripe keys exist only edge -> Stripe).

## Not verified

- Live database: not queried. That the deployed functions and RPCs match these migration files
  and this admin commit (95c2f22) is not verified.
- Whether `ticket-email` prints a date for series-wide orders: not read.
- Whether Stripe substitutes `{CHECKOUT_SESSION_ID}` in `cancel_url` (would let the cancel call
  use the session id instead of the order id): not checked.
- Whether the edge layer already has a read of an order by id usable by a cancel function: not
  checked (`admin: ticketingEdge.ts` not read in full).
- Side note, not part of T9: `admin: ticket-checkout/index.ts:17-18` says the booking fee
  defaults to 0, while `docs/handover/ticketing-checkout.md:28-29` says default 50. Not resolved
  here (it is T5).
- No sizes were measured; S/M/L are estimates from the code read.
