# Brief: Organiser Event Editor v2, slice S2 (tickets and money)

Class: BUILD-visual, money. Lane: CAREFUL, hard-tier. Branch: `claude/editor-v2-s2`. One PR.
Merge gate: an independent Fable review (`dispatch --review-of`) must PASS at the exact head. No self-merge on green.

## Goal (3 lines)
1. Behind the same `VITE_ENABLE_ORGANISER_EDITOR_V2` flag, fill the S1 Tickets frame, the night Tickets card and a new Tickets screen with the v8 ticket design.
2. The organiser picks how dancers pay (Sell here with Stripe, at the door, or a link), adds tickets with early bird prices, and adds a ticket for one night only.
3. Sold and money numbers say what they count. Flag OFF, or any format other than recurring / one_off, means zero change.

## Depends on
S1 merged on main (v2 event page, night screen, save bar, `p3/v2/` model). Rebase on it. Do not rebuild S1 parts.

## Read first
- Prototype scratchpad `event-editor-v2.html`: screen `tickets` (renderTickets ~line 282), the event-page Tickets section, the night Tickets card. Sheets: Stripe sign-up, Switch how dancers pay?, How dancers pay, the ticket sheet. Grep first, Read by offset (62 KB).
- `~/.claude/plans/DESIGN-REGISTRY.md` rows 61-70 (owner picks win). Critique findings 1, 2, 4, 5, 9, 13 (scratchpad `editor-v2-v7-critique-round2.md`).

## Files
- New: `p3/v2/TicketsV2.tsx` (screen), `p3/v2/TicketSheetV2.tsx`, `p3/v2/PaySheetV2.tsx`, `p3/v2/ticketsModel.ts` (pure: validation, early-bird order, sold lines, pay-switch warning), tests in `p3/v2/__tests__/`.
- Edit: `p3/v2/EventPageV2.tsx` (Tickets section), `p3/v2/NightV2.tsx` (Tickets card), `p3/v2/editorModel.ts` (ticket writes in the save plan), `p3/shell/P3Routes.tsx` (`events/:seriesId/tickets`, v2 only).
- e2e: extend `e2e/organiser-editor-v2.spec.ts`.
- Do NOT edit `p3/tickets/*`, `tickets/ticketsApi.ts`, `R4Tickets.tsx`, `GetPaid.tsx` or `r4MoneyApi`. Import them.

## Server contract (prod checked 2026-11-20; NO schema change needed)
- Ticket create / edit: `ticket_type_upsert_v1(p_payload jsonb)`. It accepts `occurrence_id` on create (a one-night ticket) and checks the date belongs to the series. Once a type has orders, price, occurrence and kind are locked (`has_orders`). Capacity is checked per night against `ticket_night_counts.reserved_count`; the error is `capacity_below_reserved` with `reserved_count`. Price 0 is allowed unless price steps exist. Money changes need owner or admin (`_ticket_can_handle_money_v1`).
- Early bird: `ticket_price_step_set_v1(p_ticket_type_id, p_step_id, p_effective_from timestamptz, p_price_pence)`. One `effective_from` per step for every night, which matches "Early bird prices end on the same date for every night."
- Sold numbers: `ticket_sales_by_night_v1(p_event_series_id, p_occurrence_id default null)` and `fetchNightMoney` (`r4MoneyApi`).
- Stripe: edge `stripe-connect-onboard` through `invokeEdge` in `tickets/ticketsApi.ts` (strict on money paths). Payment codes: `events/paymentModel.ts` (`parsePayment`, `paymentCommand`).
- Prod shape: 23 ticket types, 4 per-night, across 4 series. 0 price steps. 4 Stripe accounts. `payment_methods`: 764 null, door 2, ticket_link 2, door+bank_transfer 1. Flags organiserTicketing, organiserCancelRefund on in prod.

## Screen contents (owner copy, verbatim)
Event page Tickets section:
- Not connected: big "Sell tickets here", pitch "Connect Stripe and get paid in seconds. No commission from Bachata Calendar."
- Connected: "Manage tickets" with "N tickets &middot; X sold for upcoming dates, &pound;Y". Label the period (finding 4).
- Line: "Not selling here? Pay at the door or add a link instead." Chosen: "Dancers pay at the door. Change" / "Dancers buy at <link>. Change".
- Stripe skipped: "Dancers can't buy yet. Connect Stripe or choose pay at the door."
- Stripe pending: "Connected. Stripe is still checking it."
Tickets screen (`tickets`):
- Empty: "No tickets yet. Add your first ticket." Else "Tap a ticket to change it." Each card lists every date as "X of Q". "Add a ticket". The price sits on its own line under the name (finding 11a).
Ticket sheet:
- Ticket name (required). "Free ticket" switch. Price, or "Price after early bird". "How many available each night" (one-night ticket: "How many available", at least 1), with "N already sold".
- "Add an early bird price". "Early bird prices end on the same date for every night." "Sales stay open until the night ends." (open item 3). Warning: "Check the prices: early bird prices usually go up over time and stay below &pound;X." Refuse an early bird date in the past.
- "Remove this ticket", disabled when sold, with "Tickets are already sold, so this ticket cannot be removed."
- Error: "How many available cannot be lower than N, the number already sold." N is the best-selling night, not the first one.
Night Tickets card:
- Per ticket: the price on that night and "Sold for this night: N of Q".
- Ticket link row, or greyed "Not in use" with "Choose add a link on the event page first."
- "Add a ticket for this night only", or greyed. Not connected: "Connect Stripe and tap Sell tickets here on the event page first." Connected: "Tap Sell tickets here on the event page first." (finding 13).
- A one-night ticket with sales stays readable and openable. Grey only the title; the helper line stays full strength.
- Not selling here: hide price rows (finding 2).
Pay switch sheet: "N tickets already sold here. Buyers keep their tickets. New buyers will not be able to buy here." Buttons Switch / Keep selling.
S1 cancel sheet, add the line: "<N> tickets sold. We will email buyers. Refunds are sorted separately." Show it only when N > 0 (open item 2).

## Rules
- Before leaving for Stripe, open the S1 unsaved sheet if the bar holds changes. Keep the draft with `keepDraft` across the redirect (finding 5).
- Ticket writes ride the save bar, after event and night writes. Cancel stays outside the bar. Partial failure names "Tickets".
- Map server errors to the copy above (`capacity_below_reserved`, `has_orders`, not owner/admin). Never show raw codes.
- Pence in, pence out. Format with the existing money helpers. No float sums.
- Hide money (sold &pound;) from roles without `_ticket_can_handle_money_v1` rights. Use today's R4 role check.
- 44px tap targets in px. JSX entities only, no raw Unicode punctuation.

## Flag behaviour
- OFF: no new route. `TicketsEntry`, `R4Tickets`, `GetPaid`, `/prices` unchanged. Unit test asserts it.
- ON: S1's placeholder slot is replaced. Other formats keep today's screens.

## NOT in scope
- Refund flow, refund reminder cron, buyer email sending (`TICKET_STATUS_EMAILS` is ops), door scanner, guest list.
- Display price list (`passes`) for door / link events: open item 1.
- Any DDL, RPC change or admin repo change. No change to Stripe edge functions.
- Festivals, courses, multi-day events.

## Acceptance
- Unit tests for `ticketsModel`: name and quantity required, the free-ticket rule, early bird order and past-date refusal, best-night capacity check, the pay-switch count, the sold line period.
- `npm run test:unit`, `npm run lint`, `npm run pre-ship` green. Run `/code-review` once on the money and guard code.
- Walk at 390x844 on prod-shaped data. Cover: an event with a one-night ticket that has sales; a door event; a link event; not connected; connected but pending; a ticket name over 40 chars with an early bird. Use read-only prod counts only, no personal data, never a write. Use test-mode Stripe on the walk host.
- Keep-list check (blocks merge): today's TicketsEntry rows, R4Tickets totals, the GetPaid entry, the refund block on the night, door and who-is-in links. Each is drawn, listed, or marked knowingly removed in the PR body.
- Independent Fable review PASS at head before merge. PR body has "Verified on real data" and before/after phone shots.

## Decisions (owner clicks 2026-11-20; registry row 'EVENT EDITOR v2 RECON ANSWERS' is binding)
1. Door / other-site events: keep today's simple price list (Entry GBP10 ...), no tickets UI. Selling-here events use tickets.
2. Buyer-emailed line only when TICKET_STATUS_EMAILS is on (still OFF in prod; do not promise emails otherwise).
3. Sales stay open until the night ends.
4. Free ticket: 'Free ticket' switch; blank price shows 'Add a price'.
