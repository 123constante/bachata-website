# Brief: manager order counts must read through ticket_order_statuses_for_organiser_v1 (blocks admin #1384 apply)

Repo 123constante/bachata-website. Branch claude/ticket-orders-counts-rpc (new, from main). Normal lane, no DB change. One PR.

## Why (the failure this prevents)
Admin PR #1384 (not applied yet) revokes SELECT on ticket_orders.status (and all money columns) from `authenticated`.
src/modules/organiser/tickets/ticketsApi.ts `fetchOrders(typeIds, { money: false })` reads the TABLE with
`ORDER_SELECT_COUNTS = 'id, ticket_type_id, quantity, status, paid_at'`. After the apply that select fails with 42501
for every manager / contributor seat, so their ticket screen breaks. The money path was already moved to
`ticket_orders_for_organiser_v1` with a table fallback (#1680); do the same for the counts path.

## The new server reader (exists only after the apply)
`ticket_order_statuses_for_organiser_v1(p_organiser_id uuid) returns jsonb`, EXECUTE for authenticated.
- refused: `{ ok: false, reason: 'not_authorised' }`
- ok: `{ ok: true, orders: [{ id, ticket_type_id, occurrence_id, quantity, line_count, status, email_status,
  dispute_status, created_at, paid_at }] }`, every order of the organiser, newest first. No money keys. A non-money
  seat reads status 'paid' for a refunded order (owner decision: refunds are hidden from managers).

## Build
1. In `fetchOrders`: when `opts.money === false` and `opts.organiserId` is set, call the rpc above first. On
   `ok: true` filter to `typeIds` and map with the existing `parseOrderRow` (pence parse to 0, as today). When the
   function is missing (error code PGRST202 or 42883) fall through to the existing table read, exactly like the money
   branch above it. Any other error or `ok: false`: throw, as the money branch does.
2. Find EVERY caller of `fetchOrders` (and any wrapper/hook) and make sure the counts callers pass `organiserId`.
   List them in the PR body. If a caller has no organiser id available, say so under Not verified; do not guess.
3. grep src for any other direct read of `ticket_orders` or `tickets` tables (`.from('ticket_orders')`,
   `.from('tickets')`) or of a column the migration revokes (status, refunded_at, *_pence, buyer_email, buyer_name on
   ticket_orders; status on tickets). Report each; fix only the ones that break for a non-money seat.
4. Tests beside src/modules/organiser/tickets/__tests__/fetchOrders.rpc.test.ts: counts rpc path used when organiserId
   given; table fallback on PGRST202 and on 42883; refusal throws; a refunded-as-paid row parses as paid; no *_pence
   requested or shown on the counts path.

## Rules
- No UI change, no copy change, no flag. Do not touch types.ts by hand (use an untyped rpc cast like the money branch).
- Run the unit tests for the touched module and tsc; say exactly what ran. PR body: Verified / Not verified.
- Open the PR as the bot. Do not merge.
