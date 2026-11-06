# Ticket sales report: inventory

Where the Website shows ticket sales, orders or a guest list (main, 2026-11-06):

| Place | Fields shown |
|---|---|
| `p3/tickets/TicketsEntry.tsx` orders card (`ordersCard`, `orderRows`) | buyer name, qty x each price, paid day, type name (if several), status tag, Refund button (manager) |
| `p3/tickets/TicketsEntry.tsx` type rows (`TypeRow`, `ticketsRowOf`) | type, price, sold / left of capacity, status |
| `p3/door/DoorScreen.tsx` + `door/data.ts:46,81` (`ticket_door_list_v1`) | per ticket: first name, quantity, type name, checked-in time; in / total counts |
| `tickets/ticketsApi.ts` `fetchOrders` | id, type, buyer_name, quantity, subtotal, fee, total, refunded_pence, status, paid_at (no email, no Stripe ids) |

Nothing downloads a guest list (git grep csv/download in p3/tickets and p3/door: none).

Fields the new report shows: per type sold / refunded tickets / left of capacity, paid, refunded, net pence, totals, not-paid order count, checked in (door list, when it loads). CSV columns: Order (8-char short ref), Buyer name, Ticket type, Quantity, Status (orderTag label), Paid at, Refunded (pence).

The admin migration `20270314140000_ticket_door_short_code_v1.sql` is not readable from this session (admin repo not attached). The door row fields above come from this repo's `parseDoorList`; the report uses only `result`, `in_count`, `total_count`.

COVERAGE COUNT: 4 places inventoried, 4 read; 0 changed except the orders view (+1 card).
