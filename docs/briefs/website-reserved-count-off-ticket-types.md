# Brief: Website stops reading ticket_types.reserved_count directly

Repo: bachata-website. Branch: claude/reserved-count-off-types. Lane: careful (money-adjacent read). One PR, no flag (pure read-source swap; user-visible numbers must not change).

## Why
Admin review 1793 residual R3: `ticket_types.reserved_count` is selectable by `authenticated` and DROPS when an order is refunded, so a door/manager seat (no money role) can see that a refund happened. `ticket_sales_summary_v1(p_organiser_id)` already compensates for non-money seats (it adds refunded_qty back unless the caller can handle money). Once the Website no longer selects the column, the admin repo revokes it (separate PR, NOT yours, ships after this deploys).

## Do
1. `src/modules/organiser/tickets/ticketsApi.ts`: remove `reserved_count` from `TYPE_COLS` (line ~129). `parseTypeRow` must no longer read it from the row: `TicketType.reserved` is filled by the caller (see 2).
2. `src/modules/organiser/p3/tickets/data.ts` `useSeriesTypes`: after fetching types, take `reserved` per type id from `fetchSalesSummary(organiserId, { money })` rows (`parseSummary` already maps `reserved_count` from the RPC JSON, which is the compensated value). Reuse the existing summary query key/cache so there is no extra request when the summary is already loaded. If the summary is not ok, errors, or lacks the type, FAIL CLOSED: do not guess 0 where it gates a decision (capacity floor, on-sale check in `ticketModel.ts` ~323 and ~519, `TypeSheet.tsx` 160/178): keep the form's save disabled with the plain message "Ticket numbers are still loading. Try again in a moment." until the summary is ok.
3. Other readers of `reserved` stay as they are (`model.ts:162`, `salesReportModel.ts:47`, `ticketModel.ts:832`): they get the value via the TicketType.
4. Tests: update `ticketsApi.wire.test.ts` etc. so `ticket_types` selects never contain `reserved_count` (assert on the select string). Add a matrix test: money seat vs non-money seat, summary ok / not ok / type missing; `TypeSheet` save disabled while summary pending. Run the existing ticket tests.
5. grep the whole repo (src, tests, e2e) for any other `.from('ticket_types')` that selects `reserved_count` or `*`: list them in the handover; change only ticketing ones.

## Do NOT
Touch the admin repo, the DB, flags, or the Stripe/edge code. No new RPC. No pack.

## Done when
PR open (bot-authored), CI green at head, 390x844 walk of the ticket type list and TypeSheet with real-shaped data (remaining counts identical before/after), handover with Verified / Not verified and the grep list from step 5.
