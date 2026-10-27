# Handover: organiser ticketing screens (Website), PR #1060

Branch `claude/ticketing-organiser-ui`. Flag `organiserTicketing` stays OFF.
Journey map and first shape survey: [`docs/organiser-ticketing-journey.md`](../organiser-ticketing-journey.md).
Design record (S3b): [`docs/design/1060.md`](../design/1060.md).

## S3b redesign (brief `briefs/ticketing-organiser-redesign.md`, blob b5e3618; ticket dt_57ce27a0ca93)

Owner picked mockup **B, Compact** (<https://claude.ai/artifact/7NicJi37hDk21cUSG239ZD>). Presentation and
flow changed; every S3 rule kept (roles, locked price, untouched save sends nothing, error states,
Stripe not set up / not switched on, whole-order refund).

### Done
- `ticketModel.ts`: new shared helpers, each the one source for its fact: `buyerTotal` (ticket + 50p =
  total; free = "Free, no fee"), `paidOf` / `formPence`, `leftOf` / `countsLine`, `SWITCH_LABEL` /
  `switchMove`, `eventSaleOf` / `EVENT_SALE` / `eventLeftLine`, `setupSteps` / `setupLine`, `nextStep`,
  `dayWord` / `orderLine` (full month names, area rule G1), `STEP_FIELDS` / `stepErrors`, `eventStartOf`,
  `reviewRows`, `buyerNameOf`; `refundQuestion` now returns the brief's words plus the confirm label;
  `STRIPE_COPY` rewritten for the Next step card.
- `ticketsApi.ts`: `writeResult` also keeps the new ticket's id from `ticket_type_upsert_v1`'s existing
  `ticket_type` echo (no RPC or edge contract change).
- Screens: `TicketsHome` (Next step card, setup bar, Sold / Sales, compact event cards with Add tickets,
  "Paid out via Stripe" chip), `SeriesTickets` (ticket rows with the Selling switch, orders by buyer name,
  `?add=1` opens the add sheet), `TypeSheet` (three steps: name + price with live Buyer pays; places and
  sales window chips; review with sticky Put on sale / Save as draft; edits reuse it, Close sales for
  good with a confirm on the review step), `RefundSheet` (brief copy, destructive Refund &pound;N).
  `parts.tsx` holds `NextStepCard`, `SetupBar`, `NumberCards`, `EventCard`, `SellingSwitch`.
- Tests: `screens.matrix.test.tsx` rewritten (64: every screen x 12 shapes + flows),
  `compact.model.test.ts` new, `ticketModel.matrix.test.ts` copy updated. focusReturn list unchanged (no
  new sheet files; both sheets keep `returnFocusRef`).

### Notes for the orchestrator / data owner
1. Buyer name: `ticket_orders.buyer_name` exists (nullable) and is already read; a null shows "Buyer".
   Nothing needed unless checkout does not fill it.
2. Manual "Mark sold out" is no longer offered (sold out happens at capacity). Say if it should come back.
3. "Event start" as the close default is offered only for one-offs (a series has no single start).
4. The S3 notes still hold: edge-function contracts ASSUMED (`stripe-connect-onboard`, `ticket-refund`);
   `organiser_home_v1` never returns `contributor`; no `orders_expired` count; `types.ts` lacks ticketing.

### Left / next steps
- Code review (two rounds for user-facing changes) was NOT run in this session: no reviewer here.
- Flip the flag on a preview for the owner's phone test.
- Entry link to `/account/tickets` from the organiser area (still deliberately absent while the flag is off).
- Partial refunds and a per-date ticket picker remain out of scope.

### Verified / Not verified (S3b)
Verified:
- Shape survey on prod (read-only, counts): 0 ticket_types, 0 ticket_orders (0 without buyer_name),
  0 organiser_stripe_accounts; 69 live series, 11 one-offs. Upsert RPC returns the row (id) read live.
- Unit: tickets suite + focusReturn + organiser module 5814 pass. Full `test:unit`: 16242 pass, 15 fail,
  the same 15 the S3 handover recorded on main (integrityCouldNotRun x5, live event contract tests x10).
- Mutation: two planted bugs each turned the screen matrix red.
- Lint chain: every link green except `check:integrity` exit 126 (exec bit in this checkout; the script
  itself passes when run with bash; CI chmods). eslint on the module: 0 errors.
- typecheck: same error count as main (113), none in the ticketing files. Build pass; bundle budget,
  first-load requests, chunk cycles pass (TicketRoutes stays a lazy chunk).
- Browser walk 390x844 and 360x640 (fake Supabase + ticket rows shaped like the live RPCs): 10 screens,
  no sideways scroll, no control under 44px in the area, no page errors. Screenshots (390) in
  `docs/handover/ticketing-organiser-ui/` (taken before the full-month-name fix: "20 Oct" there).

Not verified:
- Real Stripe onboarding, real refunds, real checkout (edge functions not deployed; contracts assumed).
- Real Supabase auth and RLS reads with a real organiser login; a contributor login.
- `check:doc-weight` (needs a live preview; the workflow skips `claude/` branches) and the prod-DB contract
  steps of db-contract-check.
- Desktop widths. Light theme (the organiser area is dark only).
- Code review rounds.

## S3 (first build) history
S3 built the four plain screens, the wire and the model (commits aab1501..135b5fb); its review round 1
(10 findings) was fixed in 82d8355. Details of that round live in git history.
