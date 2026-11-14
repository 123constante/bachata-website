# Handover: tickets layout (Option A)

Done: Tickets is inline on the event page (stats row, notes, get-paid banner, types, Add a ticket, promo, orders preview). The only sheet left is the orders view (`tix-orders-sheet`, See all). The inline section carries `tix-tall` so older tests find it; `tix-row` is now a heading, not a button. Stats: sold of capacity, plus takings after refunds (`showMoney`) or order count. No checked-in number: the summary carries none.
Tests: `tickets.layout.matrix.test.tsx` added; `stack.draft` and `typeSheet.connectInline` adjusted for the removed base sheet. 1027+45 organiser ticket tests green.
Left: 390x844 browser walk with flags on; prod shape survey; `check:bundle-budget` main vs branch; e2e specs that click `tix-row` or look for `tix-tall` as a sheet (walk-p3-promo-codes, p3-toast-geometry) were not run; `npm run pre-ship`.
