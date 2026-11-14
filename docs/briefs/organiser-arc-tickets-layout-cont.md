# Brief: organiser arc slice 8 -- Tickets layout, CONTINUATION (finish the checks)

Brief-version: 1
Lane: normal (one worker, no DB change). Branch: `claude/organiser-arc-tickets-layout` (EXISTS: check it
out, do not recreate it). PR #1668 is already open: push to the same branch, open no second PR.
Class: BUILD-visual. Flags `organiserP3` and `organiserTicketing` stay OFF; never switch a flag on.

The first worker (ticket dt_4d53f0ce657d) built the layout and stopped at its context limit. This
is a normal continuation, not a fix round. The parent brief is
`docs/briefs/organiser-arc-tickets-layout.md` on `brief/organiser-arc-tickets-layout`: its hard
limits ("Do NOT touch", "The money rule stays exactly as it is", "Standing rules") all still bind.
Read `docs/organiser-rebuild/tickets-layout/HANDOVER.md` and `INVENTORY.md` on the branch first.

## What main lacks

- extends: the checks left undone on the open Tickets layout PR -- docs/organiser-rebuild/tickets-layout/HANDOVER.md

## Files

- src/modules/organiser/p3/tickets/TicketsEntry.tsx
- src/modules/organiser/p3/theme/p3.css
- src/modules/organiser/p3/tickets/__tests__/tickets.layout.matrix.test.tsx
- src/modules/organiser/p3/tickets/__tests__/
- tests/e2e/
- docs/organiser-rebuild/tickets-layout/INVENTORY.md
- docs/organiser-rebuild/tickets-layout/HANDOVER.md

## What the first worker said is left (quoted from its handover)

"Left: 390x844 browser walk with flags on; prod shape survey; `check:bundle-budget` main vs branch;
e2e specs that click `tix-row` or look for `tix-tall` as a sheet (walk-p3-promo-codes,
p3-toast-geometry) were not run; `npm run pre-ship`."

## Do, in this order (cheapest first; push after step 3, then again at the end)

1. `npm run test:unit`, `npm run lint`, `npx tsc --noEmit`. Fix only what this branch broke.
2. Matrix test audit. `tickets.layout.matrix.test.tsx` must cover roles owner / manager /
   contributor x shapes empty, no Stripe, Stripe waiting, normal, owner with `moneyVisible` false,
   huge (orders over the 100-row cap), refunded and part-refunded, loading, error. Per cell it must
   assert: page order; which stats show; that NO amount, NO buyer name and NO Refund button renders
   when `showMoney` is false; every empty/loading/error state has an action. Add the missing cells.
   `showMoney` stays the ONE gate: do not add a second copy and do not loosen it.
3. E2E: `tix-row` is now a heading and `tix-tall` is inline, not a sheet. Grep `tests/e2e/` for
   `tix-row` and `tix-tall`; update every spec that clicks the row or waits for the sheet
   (`walk-p3-promo-codes`, `p3-toast-geometry` at least) and run them (`npm run test:e2e:p3`, or
   the named specs). Keep each spec's intent; change only how it reaches the content.
4. `npm run check:bundle-budget` on main and on the branch; both numbers go in the PR body. The
   lazy imports must still be lazy (zero added first-load bytes).
5. Shape survey: read-only SELECT counts on prod (`stsdtacfauprzrdebmzg`) of ticket types per
   series, orders per series (incl. any over 100) and refunded / part-refunded states. Counts
   only, no personal data, never any write.
6. Walk at 390x844 with both flags on LOCALLY only (env/local override, never a committed or
   remote flag change) as owner, manager and contributor; screenshots in the PR. If sign-in blocks
   the walk, do not self-grant any role: write "walk not done: <reason>" under Not verified.
7. INVENTORY.md: add file:line to each row, and add rows for `GetPaid`, `PromoSection`,
   `SalesReport`, `RefundSheet`, `TypeSheet` and the public buyer ticket page. Update the coverage
   count.
8. `npm run pre-ship`.
9. PR #1668 body from the repo template: "Verified on real data" block with the survey counts,
   both bundle numbers, the coverage count, and an honest "Not verified".

Never add `run-ci` yourself. If any step needs a file outside the list, stop and say so in the
handover. If context runs short, finish the current step, push, and write what is left.
