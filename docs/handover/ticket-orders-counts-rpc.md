# Handover: ticket-orders-counts-rpc (PR #1683)

## Done
- `fetchOrders` counts path (`money: false` + `organiserId`) reads `ticket_order_statuses_for_organiser_v1`, falling back to the table on PGRST202 / 42883. Refusal or any other error throws.
- Tests in `src/modules/organiser/tickets/__tests__/fetchOrders.rpc.test.ts` cover the RPC path, both fallbacks, refusal, a refunded order the server reports as paid, and a counts select that asks for no pence or buyer columns.
- The only caller (`useSeriesOrders` from `TicketsEntry.tsx`) passes `org.id`. No other direct ticket_orders / tickets reads were found.
- tsc run on 6aab586: 0 errors in branch files.

## Left / next
- After admin #1384 is applied, check a manager seat's ticket screen against the live function. Until then prod has neither function and uses the table fallback.
