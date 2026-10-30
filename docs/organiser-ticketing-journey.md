# Organiser ticketing: journey map (S3)

> **Retired 2026-10-30 (T6).** The `/account/tickets` screens below were deleted once the P3 walk passed. That path is now only a redirect to P3 (`src/modules/organiser/tickets/legacyRedirect.ts`): Stripe returns go to You > Get paid with `o` and `stripe` kept; an event screen goes to its P3 event page. `ticketModel.ts` and `ticketsApi.ts` stay; P3 uses them.

Flag: `organiserTicketing` (`VITE_ENABLE_ORGANISER_TICKETING=true`), OFF by default.
While off there is NO route: `/account/tickets/*` falls through to the site's NotFound,
exactly like `/account/p3/*` while `organiserP3` is off. It also needs
`organiserSelfServe` on, like every organiser route.

Area: `src/modules/organiser/tickets/` (its own lazy chunk), drawn with the organiser
area's own frame and primitives (`OrganiserShell`, `Card`, `SummaryRow`, `StatusTag`,
`SheetView`, `Field`, `PrimaryButton` / `GhostButton`, `EmptyState` / `ErrorState`).
No new visual language: Design Gate stages 1-3 are satisfied by reuse.

Backend it reads and writes (all live on prod, admin #1063 + #1070):

| Need | Path | Who may |
|---|---|---|
| Which pages and events I run, and my role | `organiser_home_v1` (same cache entry as the organiser area) | member |
| Get paid status | `organiser_stripe_accounts` row (RLS: owner/manager/contributor read) | member reads |
| Start Stripe onboarding | edge fn `stripe-connect-onboard` (NOT deployed yet: 404/503 `not_configured` = "payments not switched on yet") | owner/manager |
| Ticket types of an event, with sales windows | `ticket_types` rows (RLS member read) | member reads |
| Sales counts and sums | `ticket_sales_summary_v1(p_organiser_id)` | member |
| Create / edit a ticket type | `ticket_type_upsert_v1(p_payload)` | owner/manager |
| Put on sale / pause / mark sold out / close | `ticket_type_set_status_v1(p_id, p_status)` | owner/manager |
| Paid orders of a ticket type (refund list) | `ticket_orders` rows (RLS member read) | member reads |
| Refund an order | edge fn `ticket-refund` (NOT deployed yet, same treatment) | owner/manager only (Q15) |

## Screens (each walked at 390x844)

1. **Tickets home** `/account/tickets?o=<page>`
   - Page name, then the **Get paid** card, then **Sales** (counts and sums), then
     **Your events** (live events of this page, each with its ticket-type count).
   - Get paid states: not connected / details started but not finished / connected
     (charges on) / payments not switched on yet (edge fn 404/503) / cannot read.
     A free ticket type never needs Stripe (Q1); the card says so.
   - Empty states: no page -> "Set up your organiser page first" with a link to the
     organiser area; no live events -> "Put an event live first" with a link to Events.
   - A contributor (read-only member) sees everything with every write control
     disabled and the reason "Only an owner or manager can ...".
2. **One event's tickets** `/account/tickets/events/:seriesId?o=<page>`
   - Each ticket type: name, price ("Free" or GBP), sold / capacity, status tag, sales
     window, and its allowed status moves as buttons (the server's machine, mirrored in
     `ticketModel.NEXT_STATUS`). "Put on sale" on a paid type without a connected
     Stripe account is disabled with the reason.
   - "Add a ticket type" opens the editor sheet.
   - Empty state: "No tickets yet. Add a ticket type to start selling." + the add button.
3. **Ticket type editor** (sheet on screen 2)
   - Name, Free / Paid, price (GBP, pence on the wire), capacity, sales open / close
     (London wall clock), one-date-only picker is NOT offered in S3 (occurrence stays
     whatever it was; null for new types).
   - Price is locked with a reason once the type has orders (server: `has_orders`).
     A closed type cannot be edited (server: `closed`), so the sheet opens read-only.
   - Saving an untouched form sends nothing (`buildUpsert` returns null).
   - Buyers pay the ticket price only: the 50p booking fee (Q9) was removed by the owner order of
     2026-10-29 (`BOOKING_FEE_PENCE = 0`); max 20 tickets per order (Q2).
4. **Orders and refund** (section on screen 2, per paid ticket type with orders)
   - Paid orders list: buyer name, quantity, total, date. Refund button opens a confirm
     sheet: "Refund GBP x to <buyer>?" (it adds "booking fee included" only for an order that carried a fee).
     Owner/manager only; a contributor sees it disabled with the reason. Refunded and
     disputed orders show their tag and no button.

## Status words (one mapping, `ticketModel.STATUS_LABEL`)

draft = "Not on sale yet", on_sale = "On sale", paused = "Paused", sold_out = "Sold out",
closed = "Closed". Transitions: draft->on_sale/closed, on_sale->paused/sold_out/closed,
paused->on_sale/closed, sold_out->on_sale/closed.

## Shape survey (prod, 2026-10-27, read-only, counts only)

- `ticket_types`: 0 rows. `ticket_orders`: 0. `tickets`: 0. `organiser_stripe_accounts`: 0.
- Organiser memberships: 15 owner, 46 manager (no contributor rows today, still handled).
- Live series per organiser: max 7. Organisers per user: max 50 (the page picker matters).
- Series lifecycle: 69 live, 21 ended, 2 paused, 4 draft, 653 archived (only live series
  may get a new ticket type: server `series_not_live_or_not_organisers`).

Because every ticketing table is empty, the screen x shape matrix is fed with
fixtures built from the RPC bodies read live (every status x orders present/absent x
connected/not connected x role), see `src/modules/organiser/tickets/__tests__/`.
