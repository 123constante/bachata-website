# Handover: Website stops reading ticket_types.reserved_count

Brief: `brief/reserved-count-off-types:docs/briefs/website-reserved-count-off-ticket-types.md`
(admin review 1793 residual R3). Branch `claude/reserved-count-off-types`.

## Done
- `ticketsApi.ts`: `TYPE_COLS` (now exported) no longer selects `reserved_count`. `parseTypeRow`
  never reads it: a type starts `reserved: 0, reservedKnown: false`. New `withReserved(types, summary)`
  fills `reserved` from `ticket_sales_summary_v1` rows (the compensated value) and sets
  `reservedKnown: true`; summary missing / not ok / without the type leaves it unknown (fail closed).
- `ticketModel.ts`: `TicketType.reservedKnown`; `RESERVED_LOADING` = "Ticket numbers are still
  loading. Try again in a moment."; `moveBlock(..., 'on_sale')` returns it while unknown (pausing and
  closing do not wait).
- `p3/tickets/data.ts`: `useSeriesTypes(organiserId, seriesId, money, enabled)` reads the same summary
  query as `useSummary(organiserId, money)` (same key: no extra request) and reports the types loaded
  only once the summary has settled. `useSummary` gained an optional `enabled`.
- `TicketsEntry.tsx`: passes `canRefund(org.role)` (the same money flag as its own summary read).
- `TypeSheet.tsx`: on a saved type whose count is unknown, Save changes is disabled with the reason
  shown (`tix-reserved-pending`), and `submit` returns early. New tickets never wait.
- Tests: `tickets/__tests__/reservedFromSummary.matrix.test.tsx` (select string never has
  `reserved_count` or `*`; money seat x non-money seat x summary ok / not ok / missing / type missing;
  the hook waits on the summary and shares its request) and
  `p3/tickets/__tests__/reservedPending.matrix.test.tsx` (sheet save disabled while pending; Selling
  switch waits). Fixtures gain `reservedKnown: true` (the loaded shape).
- Walk specs (`walk-ticket-sales-report`, `-s1-pause-add`, `-t3-price-steps`, `-t5-course-presets`,
  `walk-p3-promo-codes`): the summary mock now lists the same types, as the live RPC does.

## Step 5 grep: other `ticket_types` reads
- `ticketsApi.ts` `fetchSeriesTypes` (`TYPE_COLS`) -- changed.
- `ticketsApi.ts` `fetchCourseDates`: `select('kind, valid_from, valid_to')` -- no `reserved_count`, untouched.
- No `.from('ticket_types')` selecting `*` anywhere in src / tests / e2e / scripts / api.
- `reserved_count` otherwise appears only in summary-JSON fixtures (the RPC's key) and the generated
  `src/integrations/supabase/types.ts` (left alone; regenerated from the DB by the admin side).

## Behaviour note (for the admin revoke PR)
`ticket_sales_summary_v1` returns `t.reserved_count` unchanged for a money seat (owner/admin), so owner
numbers are byte-identical. For a non-money seat it adds `refunded_qty` back, so a manager's "left" and
capacity floor are higher by the refunded tickets than before -- the intended hiding of refunds, and
conservative (the floor can only be stricter than the server's).

## Next
- Admin repo revokes `ticket_types.reserved_count` from `authenticated` after this deploys (not here).
