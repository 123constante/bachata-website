# ticket-sales-report-web (Website, BUILD-visual, ticketing arc)

Brief-version: 2
Lane: normal (no database change). Model: Sonnet (screen over existing reads, red-first matrix). Branch: `claude/ticket-sales-report-web` (inside the claimed `claude/ticket-*` family). One PR, push once, no run-ci. Flag: ships under the existing `organiserTicketing` flag (OFF on prod); add no new flag.
Serves: arc ticketing "reports" (docs/scoping/ticket-followups-2026-10-30.md T10 area; `docs/organiser-ticketing-journey.md`).

## What main lacks
- The P3 Tickets sheet shows types, the latest two orders and "See all" (`src/modules/organiser/p3/tickets/TicketsEntry.tsx:109,126,218-236`) and a Money so far line. It has NO per-event sales report and NO way to take the guest list out (git grep csv|download in `p3/tickets` and `p3/door` returns nothing). -- src/modules/organiser/p3/tickets/salesReportModel.ts
- extends: Reads already exist and need no migration: `fetchOrders` (`src/modules/organiser/tickets/ticketsApi.ts:147`, buyer_name, quantity, totals, refunded_pence, status, paid_at; no email by design), `fetchSeriesTypes` (:115), `ticket_door_list_v1` via `src/modules/organiser/p3/door/data.ts:100` (checked-in state per ticket). -- src/modules/organiser/tickets/ticketsApi.ts

## Step 0 INVENTORY (before building)
`docs/design/ticket-sales-report/INVENTORY.md`: every place the current Website and the admin app show ticket sales, orders or a guest list (file:line), the fields each shows, and the fields you will show; end with a COVERAGE COUNT. Confirm what `ticket_door_list_v1` returns per row (first_name only?) by reading admin `supabase/migrations/20270314140000_ticket_door_short_code_v1.sql` on main.

## Build
- In the orders view (`view === 'orders'`) add a "Sales report" card at 390x844: per ticket type sold / refunded / remaining (capacity), gross paid, refunded pence, net; totals row; checked-in count if the door list loads (otherwise omit that line, no error).
- A "Download guest list" button: CSV built in the browser from loaded orders (columns: order short ref, buyer name, ticket type, quantity, status, paid at, refunded pence). Never email, never Stripe ids. Strip CSV-injection (cells starting = + - @ get a leading apostrophe). File name `guests-<event-slug>-<date>.csv`.
- One shared mapping for status words (reuse the orders list mapping; do not copy). Disabled button says why (no paid orders yet). Empty state says what the organiser can do (share the event / add a ticket type). Pending/expired orders are excluded from totals and counted as "not paid".
- Contributor role sees the report but not refund controls (same as the orders list today).

## Tests (red first)
Table-driven: status (pending, paid, refunded, partially refunded, expired, disputed) x role (owner, manager, contributor) x shape (no orders, 1 order, 100+ orders paged, free ticket 0p, promo applied, series with several types). Assert: totals equal the sum of rows, CSV row count equals paid+refunded order count, no email column, injection cells escaped, copy never points at a missing control, untouched view sends nothing. Zero bytes to dancer first load: `npm run check:bundle-budget` on main and branch; lazy-load the card; do not edit `perf-budgets.json` or `vite.config.ts`.

## Rules
Merge origin/main before pushing. Per-job CI table and a Verified / Not verified block in the PR body (label exactly "- Shapes surveyed:", Phone QA names 390x844). Walk pictures under `docs/walk/ticket-sales-report/` on prod-shaped data (Bachata Playground test event). Supabase read-only. Never merge or approve. HTML entities in JSX. Design record `docs/design/ticket-sales-report.md`. Handover `docs/handover/ticket-sales-report-web.md`.

## Done looks like
Owner on a phone opens an event with orders, sees correct totals, taps Download and gets a CSV that opens in a spreadsheet with the right rows; every shape in the matrix passes; bundle budget unchanged.

## Files
- `src/modules/organiser/p3/tickets/TicketsEntry.tsx` (orders view, :218-236) plus a new lazy `src/modules/organiser/p3/tickets/SalesReport.tsx` and pure `salesReportModel.ts` (totals + CSV builder).
- Read only: `src/modules/organiser/tickets/ticketsApi.ts` (:115,:147), `src/modules/organiser/p3/door/data.ts` (:100).
- Tests under `src/modules/organiser/p3/tickets/__tests__/` (`salesReport.matrix.test.tsx`, `salesReport.csv.test.ts`).
