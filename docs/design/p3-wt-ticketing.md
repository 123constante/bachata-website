# Design record: P3 W-T ticketing re-skin (Phase A, design only)

Flags: `organiserP3` + `organiserTicketing` (both OFF in prod). Branch `claude/p3-wt-ticketing`. Brief: `brief/p3-wt-ticketing`.

## Brief (Design Gate stage 1)
- **Who:** an owner or manager of an organiser page, on a phone (390x844), inside the P3 area.
- **One job:** sell tickets for one event: get paid (Stripe), add a ticket in three steps, switch it Selling / Paused, see orders, refund one.
- **Where:** a Tickets entry on each P3 event page; a Get paid prompt on Home while selling is possible but payments are not set up; a full Get paid screen under You.
- **Feel:** the P3 shell (cream / terracotta tokens from `p3/theme/p3.css`, bottom tabs, sheets). The old black / orange ticketing theme is dropped. No new token file.
- **Done means:** nothing the shipped `/account/tickets` screens show or do is lost (inventory below), every greyed control says why, the add-ticket draft survives a re-render, and the Refund button never hides the order's state.

## Mockups (stage 2): `mockups/p3-wt-ticketing/`

Open in a browser; each file has a Light / dark button. Every frame is 390x844.

| File | Approach | Event page entry | Ticket list | Orders | Add / Refund |
|---|---|---|---|---|---|
| `A-tickets-page.html` | **A, Tickets page** | Tickets row under Status (word, detail, chip, &rsaquo;) | its own page `/account/p3/events/:id/tickets`, segment Tickets / Orders | second segment | sheets over the page |
| `B-inline-on-event.html` | **B, Inline** | a Tickets section ON the event page (types + switches + Add a ticket) | inline | `Orders N &rsaquo;` link to `/events/:id/orders` | sheets over the page |
| `C-tickets-sheet.html` | **C, Sheet** | same Tickets row as A | one full-height sheet: types, then the latest 2 orders, "See all" | a sheet view with Back | open inside the sheet |

Shared by all three: Home Get paid prompt (not connected / started / gone once connected), You list with a Get paid row, You &rsaquo; Get paid (not connected, back from Stripe, Stripe link ran out, connected with Sold / Sales, payments not switched on, contributor, loading / error), add-ticket steps 1-3 (with errors, the paid-but-not-connected block, edit with price locked, Close sales for good confirm, a server refusal), Refund sheet (with refusal) and the Refund started toast.

Recommendation for the owner's pick: **A**. It is the shipped screen's structure moved under the event, so Phase B reuses the most tested code; B makes the event page long once there are 3+ ticket types, and C stacks sheets on sheets (focus return and Back get harder).

## Inventory of the shipped screens (nothing dropped)

| Shipped (`src/modules/organiser/tickets`) | Where it goes in P3 |
|---|---|
| Tickets home: page name line, "Paid out via Stripe" tag | You &rsaquo; Get paid status card |
| Next step card: connect / add / sell, "Selling free tickets? Add one now" | Home Get paid prompt (connect only); add / sell are on the event's Tickets entry (the "No tickets" chip and the Not on sale switch say it) |
| Back from Stripe notes (`?stripe=return` / `refresh`) | You &rsaquo; Get paid, top note; Stripe's return URL moves there |
| Setup bar (3 steps) | You &rsaquo; Get paid |
| Sold / Sales cards + "Ticket money before Stripe's fees" + waiting / refunded / disputed line | You &rsaquo; Get paid "Money so far" (Home shows a tile only once anything sold) |
| PaymentsLink (Connect / Finish connecting under the numbers) | the Get paid button itself |
| `NOT_SWITCHED_ON`, `NOT_MANAGER*` lines | same copy, same places |
| Home event cards with chip No tickets / Selling / Sold out / Not selling and "N left of M" | the event page Tickets row (chip + detail) |
| No organiser page / no live events empty states | P3 already gates on an organiser page; "no live event" = the Tickets entry's "Put this event live before adding tickets." |
| Event tickets: rules line (date, 50p fee, 20 per order), read-only note | top of the ticket list |
| Type row: name, price &middot; sold &middot; left, Selling switch (Selling / Paused / Not on sale / Sold out), Closed tag, switch reason, move error | unchanged |
| Add a ticket bar + its reason | bottom of the list |
| Orders: buyer, "qty &times; each &middot; day", type name when 2+, Paid / Refunded / Disputed, Refund, not-manager refund note, both empty texts, loading, error | unchanged, except Refund no longer REPLACES the Paid tag (defect fix) |
| TypeSheet: 3 steps, Buyer pays box, chips, review rows, Put on sale + reason, Save as draft, edit Save changes from any step, price lock, edit lock, Close sales for good confirm, server error | unchanged in content |
| RefundSheet: title, body, Refund &pound;N, Keep the order, refusal note | unchanged, plus an order summary (which order) |

## Copy changes proposed
- `moveBlock` / `organiser_not_onboarded`: "Connect payments on your Tickets home..." becomes "Connect payments in You &rsaquo; Get paid before selling paid tickets." (the Tickets home goes away).
- Home prompt title "Get paid for tickets" (the shipped connect title names an event; Home has no one event).

## Defects to fold in (Phase B)
- Add-ticket sheet reset once before saving (at the review step, not reproduced twice): the draft is held by the parent, keyed by the open sheet, not by the sheet's own state; a table-driven test holds the draft across a re-render and a refetch.
- Refund label placement: the state tag is always shown; Refund is a separate button.

## Out of scope
The buyer thanks page "confirmed" state (needs a new DB read). Backend, edge functions, `ticketModel.ts` / `ticketsApi.ts` contracts and their matrix tests are reused unchanged (copy constants aside, on the owner's OK).

## Not verified (Phase A)
- No prod shape survey yet (Phase B: 0 / 1 Stripe row, 0 / 2 types, paused, paid / free / refunded orders, past event). Sample data in the mockups is invented.
- Contrast and tap sizes in the mockups are by construction (P3 tokens, 44px controls), not measured. No real phone.
