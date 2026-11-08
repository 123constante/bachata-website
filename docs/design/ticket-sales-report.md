# Ticket sales report (design record)

Flag: existing `organiserTicketing`. No migration, no new read.
- Card sits under the orders list in the Tickets sheet's orders view (`view === 'orders'`), lazy chunk `SalesReport.tsx`. Pure maths in `salesReportModel.ts`.
- Counted orders = the orders list's SHOWN_ORDER (paid, refunded, disputed). Pending / expired are "not paid", in no total. Disputed counts as sold (money held, ticket stands). A part-refunded paid order stays sold; its refunded pence shows in Refunded and Net.
- Remaining = capacity - reserved (server truth), floor 0.
- CSV: browser-built, BOM + CRLF, no email, no Stripe ids; cells starting = + - @ tab CR get a leading apostrophe. Status word is the shared `orderTag` label.
- Download disabled with a reason when no counted orders. Empty state says share the event / add a ticket type.
- Contributor sees the report; the card has no refund control.
- Limit: the card only mounts on the orders view, reached by See all (shown when more than 2 orders). With 1-2 orders the latest-orders preview is the whole list and the report is not offered. Follow-up: add a "Sales report" link for small lists.
