# INVENTORY -- my-tickets-screen

Written before any code (brief `docs/briefs/my-tickets-screen.md`, v2). Every field, state and
option a buyer's ticket has today, where it lives, and whether `/account/my-tickets` shows it.

**Source (1), the admin app:** `123constante/bachata-admin-11april` was NOT reachable from this
session (add_repo: "you don't have access"). In its place, the admin-owned prod schema
(read-only `information_schema` + `pg_get_functiondef`, project `stsdtacfauprzrdebmzg`,
2026-11-04) is cited as `db:<table>.<column>` / `db:my_tickets_v1`. The admin ticket VIEWS
(file:line) are therefore **Not inventoried** -- a follow-up with admin access should add them.

## Prod shape survey (counts only, SELECT only, 2026-11-04)

| Fact | Count |
|---|---|
| tickets / orders | 8 / 6 |
| order status | paid 1, refunded 3, expired 2 |
| ticket status | valid 3, void 5, used 0 |
| checked in (`checked_in_at` set) | 1 |
| ticket types / series-wide (`occurrence_id` null) | 2 / 2 |
| max tickets in one order / one buyer | 3 / 6 |
| buyers with an account / orders with no buyer_user_id | 1 / 2 |
| qr_token length / non-hex | 64-64 / 0 |
| occurrence resolved null / past / upcoming | 0 / 0 / 8 |

So prod today never hits: `occurrence_date` null, past tickets, `truncated` (cap is 500 rows,
`db:my_tickets_v1` `LIMIT 501`). Those are covered by the vitest matrix at synthetic shapes.

## Rows

| # | Field / state | Where it exists (file:line) | Page shows it? |
|---|---|---|---|
| 1 | Event title | `db:my_tickets_v1` `event_title` (= `event_series_p5.name`); thanks page `ticketCheckoutModel.ts:319` | YES, card heading |
| 2 | Night date | `db:my_tickets_v1` `occurrence_date`; thanks page `ticketCheckoutModel.ts:320` | YES, "Fri 7 Nov" |
| 3 | Series-wide ticket with no scheduled night (date null) | `db:my_tickets_v1` LEFT JOIN LATERAL; type `occurrence_id` null `ticketCheckoutModel.ts:33` | YES, "Date to be confirmed", listed under Upcoming |
| 4 | Start time | `db:my_tickets_v1` `start_time` "HH24:MI" | YES, "21:00" (see GAP g4) |
| 5 | Ticket type name | `db:ticket_types.name`; door `door/model.ts:23` | YES |
| 6 | QR token (secret) | `db:tickets.qr_token` (64 hex, all rows); door `door/model.ts:153` `parseCode` | YES, as a QR of the bare token; never logged / in a URL |
| 7 | Checked in | `db:tickets.checked_in_at` or status `used`; door `door/model.ts:26`, result `already_in` `door/model.ts:17` | YES, "Checked in at <time>", QR behind "Show anyway" |
| 8 | Checked-in time | `db:tickets.checked_in_at`; door `londonClock` `door/model.ts:57` | YES, same `londonClock` (one mapping) |
| 9 | Checked in by (staff) | `db:tickets.checked_in_by`; door `door/model.ts:27` | NO -- GAP g1 (staff data, not the buyer's) |
| 10 | Order id | `db:ticket_orders.id`; thanks `TicketThanksPage.tsx:95` (first 8 chars) | YES, "Order <8 chars>" -- same slice as the thanks page |
| 11 | Several tickets in one order | `db:tickets.order_id` (max 3 per order on prod) | YES, "Ticket 2 of 3" in the order |
| 12 | Upcoming vs past | `db:my_tickets_v1` ORDER BY (London today) | YES, two sections, London day rule |
| 13 | Truncated list (over 500) | `db:my_tickets_v1` `truncated`, `total_count` | YES, "Showing 500 of 600" note |
| 14 | Order status paid only | `db:ticket_orders.status` (RPC filters `paid`) | YES (implicitly; only paid arrive) |
| 15 | Refunded / expired orders | `db:ticket_orders.status`, `refunded_at` | NO -- GAP g2 (RPC excludes them) |
| 16 | Void tickets | `db:tickets.status` void (RPC excludes) | NO -- GAP g2 |
| 17 | Short door code (6 chars) | `db:tickets.short_code`; door `door/model.ts:185` | NO -- GAP g3 (RPC does not return it) |
| 18 | Venue | public event page ticket block `TicketsBlock.tsx:52` (series context) | NO -- GAP g5 (RPC has no venue); card links to the event page |
| 19 | Link to the event | `event_series_id` from `db:my_tickets_v1` | YES, "Event page" link `/event/<series id>` |
| 20 | Price paid / booking fee | `db:ticket_orders.unit_price_pence`, `booking_fee_pence`; block `TicketsBlock.tsx:191` | NO -- GAP g6 |
| 21 | Buyer name / email | `db:ticket_orders.buyer_name`, `buyer_email` | NO -- GAP g7 (signed-in user knows it; personal data) |
| 22 | Email delivery status | `db:ticket_orders.email_status` | NO -- GAP g8 |
| 23 | Ticket type on sale / sold out / remaining | block `ticketCheckoutModel.ts:28,96`, `TicketsBlock.tsx:258` | NO -- not a property of a bought ticket (n/a) |
| 24 | Signed out | `db:my_tickets_v1` raises 42501 | YES, "Sign in" link back here |
| 25 | RPC error / not applied | `ticketCheckoutApi.ts:30` pattern | YES, "Try again" button |
| 26 | Loading (slow) | -- | YES, skeleton + "Loading your tickets&hellip;" |
| 27 | No tickets | -- | YES, "Find an event" link |
| 28 | Flag off | `featureFlags.publicTicketing`; `flagOff.test.ts` | YES, route is not mounted, redirect to `/` |

## GAPs

- g1 checked-in-by staff name: deliberately hidden.
- g2 refunded/expired orders and void tickets: the RPC returns paid, non-void only; a refunded buyer sees the ticket vanish with no "Refunded" line. Needs an RPC change (admin repo).
- g3 short door code: on `tickets` but not in `my_tickets_v1`; the door can take it typed. Needs an RPC change.
- g4 start time: the RPC converts `materialised_start_utc AT TIME ZONE 'UTC'`, so a materialised night in BST shows the UTC clock (one hour early in summer). Flag to admin; the page prints what the RPC sends.
- g5 venue, g6 price/fee, g7 buyer name/email, g8 email status: not in the RPC.
- Admin ticket views (source 1, file:line): not inventoried (no repo access).

**Coverage: 19 of 28 inventory rows covered by the page; GAPs: g1 checked-in-by, g2 refunded/expired/void, g3 short code, g4 UTC start time (shown, maybe wrong), g5 venue, g6 price/fee, g7 buyer name/email, g8 email status; row 23 n/a.**
