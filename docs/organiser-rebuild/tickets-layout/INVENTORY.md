# Tickets layout inventory (slice 8, Option A)

Source: `src/modules/organiser/p3/tickets/TicketsEntry.tsx` (the admin repo is not in this checkout: admin-only fields are GAP).

| # | Item | Where (TicketsEntry.tsx) | Placed in Option A order |
|---|------|--------------------------|--------------------------|
| 1 | Heading row: "Tickets", detail line, status chip (`tix-row`, `tix-row-detail`, `tix-row-chip`) | `tix-inline` section top | Yes, heading (no longer a button) |
| 2 | Event date and buyer rules (`tix-event-rules`) | list view | Yes, after stats and notes |
| 3 | Read-only role note `NOT_MANAGER` (`tix-readonly`) | list view | Yes (step 2) |
| 4 | External ticket link line (`tix-external-link`) | list view | Yes |
| 5 | Going count line (`tix-going-count`) | list view | Yes |
| 6 | Stripe return banner and its actions (`tix-return-*`) | list view | Yes (step 3, get-paid state) |
| 7 | Ticket type rows `TypeRow`: name, price, sold of cap, switch, paused note, connect block | `tix-types` | Yes (step 4) |
| 8 | Type takings, only when `showMoney` | `TypeRow` | Yes, unchanged gate |
| 9 | Tap a type to open `TypeSheet` | `openEditor` | Yes, still a portalled sheet |
| 10 | Add a ticket and reason (`tix-add`, `tix-add-reason`) | footer, now inline | Yes (step 5) |
| 11 | Promo section (lazy `PromoSection`) | list view | Yes (step 6) |
| 12 | Orders preview, See all, Refund, part-refund note, owner/manager notes | `tix-orders` | Yes (step 7); See all still opens the sheet (`tix-orders-view`, lazy `SalesReport`) |
| 13 | Empty / loading / error states with retry | `body` | Yes (step 8) |
| 14 | Stats row: sold of capacity, takings (money) or order count | new, from summary already loaded | Yes (step 1) |
| 15 | Counts-only note `COUNTS_ONLY_NOTE` | orders card; also top note | Yes |
| 16 | Checked in count | no data in the summary on main | GAP: not shown (two numbers) |
| 17 | Design-only fields without data on main | design html | GAP |

Coverage: 15 of 17 inventory rows placed; rows 16 and 17 are GAPs named above.
