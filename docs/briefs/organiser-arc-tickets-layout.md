# Brief: organiser arc slice 8 -- Tickets layout (Option A, one page per event)

Brief-version: 2
Lane: normal (one worker, no DB change). Branch: `claude/organiser-arc-tickets-layout`. One PR.
Class: BUILD-visual. Layout only. Flags `organiserP3` and `organiserTicketing` stay OFF; never switch a flag on.

## Goal

Today the organiser's event page shows Tickets as ONE collapsed status row (`tix-row`) that opens a
full-screen `StackSheet` holding the ticket list, promo section, orders and sales report. The owner
chose design Option A: the Tickets content sits INLINE on the page, in one glanceable order, with no
extra tap to see it. Re-order what exists; invent no new data, no new money path.

## What main lacks

- extends: inline Option A page order for Tickets -- grep: tix-row
- extends: three-number stats row above the ticket types (sold of capacity, takings or order count, checked in) -- src/modules/organiser/p3/tickets/TicketsEntry.tsx
- extends: matrix test for the inline layout across roles and shapes -- src/modules/organiser/p3/tickets/__tests__/tickets.matrix.test.tsx

## Files

- src/modules/organiser/p3/tickets/TicketsEntry.tsx
- src/modules/organiser/p3/tickets/StackSheet.tsx
- src/modules/organiser/p3/theme/p3.css
- src/modules/organiser/p3/tickets/__tests__/tickets.matrix.test.tsx
- src/modules/organiser/p3/tickets/__tests__/tickets.layout.matrix.test.tsx
- src/modules/organiser/p3/tickets/__tests__/layout.cascade.test.ts
- src/modules/organiser/p3/tickets/__tests__/fixtures.ts
- src/modules/organiser/p3/tickets/__tests__/harness.tsx
- src/modules/organiser/p3/screens/EventPage.tsx
- tests/e2e/
- docs/organiser-rebuild/tickets-layout/INVENTORY.md

## Inventory first (before any layout change)

Write `docs/organiser-rebuild/tickets-layout/INVENTORY.md` BEFORE drawing or building. List every
field, state and option the Tickets surface shows today, each with file:line cited, from three
places: the admin app (read what is checked into this repo's docs and types only; the admin repo is
not in your checkout, so mark anything you cannot see as GAP), the current Website
(`TicketsEntry.tsx`, the sheet views, `GetPaid`, `PromoSection`, `SalesReport`, `RefundSheet`,
`TypeSheet`) and the public page (the buyer ticket page). List every GAP (shown today but with no
place in the Option A order, or in the design but with no data on main). End the file, and the PR
body, with a coverage count: N of M inventory rows placed, the rest named.

Touch other test files under `src/modules/organiser/p3/tickets/__tests__/` only to follow moved
test ids. If the job seems to need any file outside this list, stop and say so in the handover.

## Do NOT touch (hard limits)

- `data.ts`, `model.ts`, `salesReportModel.ts`, `gateCopy.ts`, `paths.ts`, `connectReturn.ts`,
  `RefundSheet.tsx`, `TypeSheet.tsx`, `PriceSteps.tsx`, `GetPaid.tsx`, `SalesReport.tsx`, `promo/**`
  (import and place them; do not edit them).
- Anything under `src/modules/organiser/p3/door/**`. Another session owns it.
- No RPC, RLS, migration, edge function, refund, price, promo or payout logic change.
- `perf-budgets.json`, `vite.config.ts`, `scripts/**`, `.github/**`, the density-excluded calendar files.

## The money rule stays exactly as it is

`const showMoney = canRefund(org.role) && summary.data?.moneyVisible === true;` is the ONE gate.
Do not add a second copy, do not loosen it, do not derive money visibility any other way. Every
money-shaped thing on the page (takings, amounts, buyer name on an order row, the Refund button)
keeps reading that one value through the existing helpers (`orderTitleFor` etc.). The notes
`NOT_OWNER_REFUND`, `NOT_MANAGER_REFUND` and `COUNTS_ONLY_NOTE` keep their text and their conditions.
The server is the real gate; the UI only mirrors it. Money rows are placed, not redesigned.

## Page order (top to bottom, inside the existing `TicketsEntry` mount at `EventPage.tsx`)

Design reference: `docs/design/profile-dash/organiser-tickets-option-a.html` (31 KB: NEVER read it
whole; read `docs/design/profile-dash/INDEX.md`, then helpers at lines 170-229 and `render()` from
line 278 with offset/limit). The look follows the existing `p3.css` tokens; do not port the design's CSS.

1. Stats row: three big numbers. (a) sold of capacity; (b) takings after refunds ONLY when
   `showMoney`, otherwise the order count; (c) checked in -- only if the summary data already
   carries it; if it does not, show two numbers and say so in the handover (no new query).
2. Money note banner when amounts are hidden (the existing `COUNTS_ONLY_NOTE` / role notes).
3. Get-paid / Stripe state (existing `GetPaid` component and gate copy), where it shows today.
4. Ticket type rows (existing `TypeRow`): name, price, sold of cap, tag; takings only when
   `showMoney`; tappable to the existing `TypeSheet` under today's role rule.
5. "Add a ticket" (`tix-add`) under today's role rule.
6. Promo section (existing lazy `PromoSection`), unchanged conditions.
7. Orders: the first rows inline (reuse the existing order row markup and `tix-see-all`), Refund
   button only where it shows today. "See all" may keep opening the existing sheet view
   (`tix-orders-view`) with the lazy `SalesReport`.
8. Empty state: one sentence plus the next-step button for people who can add; a read-only line
   for contributors. Loading and error states each keep an action (retry).

Keep every existing `data-testid`. If a test id must move, keep the name. `tix-row` may remain as
the section heading element so EventPage and old tests still find it; it no longer has to be a button.
The lazy imports stay lazy (zero added bytes to first load: run `npm run check:bundle-budget` on
main and on the branch and put both numbers in the PR).

## Standing rules for this repo

- Source files over 2 KB go through `scripts/safe-edit.py` / `scripts/safe-write.py` (the hook prints the call).
- HTML entities in JSX (`&middot;`, `&hellip;`, `&pound;`), never raw Unicode punctuation.
- The site sets `html` font-size to about 13.5px on phones: tap targets use explicit px (44px min, `--tap`).
- Sheets and toasts stay portalled; opening one must not scroll the page.
- No `!important` (`layout.cascade.test.ts` checks `p3.css`).
- No copy that points at a control that is not on screen. A control that cannot work is disabled with a reason.
- Push ONCE when the slice is coherent and tests ran. Never add `run-ci` yourself.

## Checks before the PR

1. Matrix vitest `tickets.layout.matrix.test.tsx`: roles owner / manager / contributor x shapes
   empty, no Stripe, Stripe waiting, normal, owner with `moneyVisible` false, huge (orders over the
   100-row cap), refunded and part-refunded orders, loading, error. Assert per cell: page order,
   which stats show, that NO amount, buyer name or Refund button renders when `showMoney` is false,
   and that every empty/loading/error state has an action. Reuse `fixtures.ts` and `harness.tsx`.
2. All existing tickets tests green (`npm run test:unit`), plus `npm run lint` and `npm run pre-ship`.
3. Shape survey: read-only SELECT counts on prod (`stsdtacfauprzrdebmzg`) of the ticket shapes the
   page meets (types per series, orders per series incl. over 100, refunded states). Counts only,
   no personal data, never any write.
4. Walk at 390x844 with both flags on LOCALLY only, as owner, manager and contributor; screenshots in the PR.
5. PR body from the repo template with the "Verified on real data" block and an honest "Not verified".

Stopping rule: one review, one fix round, then the orchestrator walk.
