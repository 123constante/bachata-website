# Tickets layout inventory (slice 8, Option A)

Source: `src/modules/organiser/p3/tickets/` (the admin repo is not in this checkout: admin-only fields are GAP).
Line numbers are at branch head after round 3; `TE` = `src/modules/organiser/p3/tickets/TicketsEntry.tsx`.

| # | Item | Where (file:line) | Placed in Option A order |
|---|------|-------------------|--------------------------|
| 1 | Heading row: "Tickets", detail line, status chip (`tix-row`, `tix-row-detail`, `tix-row-chip`) | TE:456 (`tix-tall` section top) | Yes, heading (no longer a button) |
| 2 | Event date and buyer rules (`tix-event-rules`) | TE:468 | Yes, after stats and notes |
| 3 | Read-only role note `NOT_MANAGER` (`tix-readonly`) | TE:450 | Yes (step 2) |
| 4 | External ticket link line (`tix-external-link`) | TE:471 | Yes |
| 5 | Going count line (`tix-going-count`) | TE:472 | Yes |
| 6 | Stripe return banner and its actions (`tix-return-*`) | TE:474 | Yes (step 3, get-paid state) |
| 7 | Ticket type rows `TypeRow`: name, price, sold of cap, switch, paused note, connect block | TE:387 (`tix-types`), TE:611 (`TypeRow`) | Yes (step 4) |
| 8 | Type takings, only when `showMoney` | TE:171 (the one gate), `TypeRow` TE:611 | Yes, unchanged gate |
| 9 | Tap a type to open `TypeSheet` | TE:252 (`openEditor`), TE:523 | Yes, still a portalled sheet |
| 10 | Add a ticket and reason (`tix-add`, `tix-add-reason`) | TE:441, TE:444 | Yes (step 5) |
| 11 | Promo section (lazy `PromoSection`) | TE:499 | Yes (step 6) |
| 12 | Orders preview, See all, Refund, part-refund note, owner/manager notes | TE:411 (`tix-orders`), TE:356 (`tix-see-all`), TE:512 (`tix-orders-sheet`) | Yes (step 7); See all still opens the sheet with lazy `SalesReport` |
| 13 | Empty / loading / error states with retry | TE:362-374 (`body`) | Yes (step 8) |
| 14 | Stats row: sold of capacity, takings (money) or order count | TE:417 (`tix-stats`), TE:423 (`tix-stat-takings`) | Yes (step 1) |
| 15 | Counts-only note `COUNTS_ONLY_NOTE` | TE:451 (top); orders card | Yes |
| 16 | Checked in count | no data in the summary on main | GAP: not shown (two numbers) |
| 17 | Design-only fields without data on main | design html | GAP |
| 18 | `GetPaid` (Home prompt, You row, get-paid screen, `MoneySoFar` owner-only) | `src/modules/organiser/p3/tickets/GetPaid.tsx:45,117,202,221,272` | Unchanged by Option A; reached from Home and You, not the event page |
| 19 | `PromoSection` sheet host (create/edit sheet) | `src/modules/organiser/p3/tickets/promo/PromoSection.tsx:58-67,48` | Yes; round 3: inline, the sheet portals into the nearest `.p3-theme` (was bare `body`, unstyled) |
| 20 | `SalesReport` (per type and total; money lines only with `money={showMoney}`) | `src/modules/organiser/p3/tickets/SalesReport.tsx:12`; TE:517 | Yes, inside the See all orders sheet |
| 21 | `RefundSheet` (owner refund, full or part) | `src/modules/organiser/p3/tickets/RefundSheet.tsx:32`; TE:556 | Yes, a sheet over the orders preview or the orders sheet |
| 22 | `TypeSheet` (add or edit a ticket type) | `src/modules/organiser/p3/tickets/TypeSheet.tsx:114`; TE:523 | Yes, unchanged sheet |
| 23 | Public buyer ticket page | `src/modules/tickets/EventTicketsPage.tsx:102` | Out of scope: not touched by this branch (flag `publicTicketing`) |

Coverage: 21 of 23 inventory rows placed; rows 16 and 17 are GAPs named above.
