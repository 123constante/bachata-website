# Brief: organiser arc slice 8 -- Tickets layout, ROUND 3 (fix branch-only e2e reds, finish the checks)

Brief-version: 1
Lane: normal (one worker, no DB change). Branch: `claude/organiser-arc-tickets-layout` (EXISTS: check it
out, do not recreate it). PR #1668 is already open: push to the same branch, open no second PR.
Class: BUILD-visual. Flags `organiserP3` and `organiserTicketing` stay OFF; never switch a flag on remotely.

Rounds 1 and 2 (sonnet) built the layout and cleared tsc and the matrix. This is the one opus
escalation. The parent brief `docs/briefs/organiser-arc-tickets-layout.md` and
`docs/briefs/organiser-arc-tickets-layout-cont.md` (both on `brief/organiser-arc-tickets-layout`) still
bind: "Do NOT touch", the money rule, standing rules. Read
`docs/organiser-rebuild/tickets-layout/HANDOVER.md` and `INVENTORY.md` on the branch first.

## What main lacks

- extends: the checks and e2e fixes left on the open Tickets layout PR -- docs/organiser-rebuild/tickets-layout/HANDOVER.md

## Files

- src/modules/organiser/p3/tickets/
- src/modules/organiser/p3/theme/p3.css
- tests/e2e/
- docs/organiser-rebuild/tickets-layout/INVENTORY.md
- docs/organiser-rebuild/tickets-layout/HANDOVER.md

## Fix first (branch-only e2e reds; run each spec on origin/main first to confirm it is branch-only)

1. `walk-p3-promo-codes` "a locked code": Save changes bottom is 909 > 844 at 390x844. The promo edit
   sheet no longer fits. Fix the sheet layout (scrollable body, sticky footer inside the viewport), not the spec.
2. `walk-ticket-sales-report` a-e: the spec's `ticket_sales_summary_v1` mock returns
   `{ ok: true, ticket_types: [] }` with no `moneyVisible`. Fix the MOCK to return `moneyVisible: true`.
   NEVER loosen `showMoney`; it stays the one gate.
3. `p3-gate-overlays` (2 tests) and the promo row count (6 vs 4: the `^promo-row-` regex now also matches
   child testids). Compare with main. If branch-only, fix the cause (tighten the regex to the row itself
   or fix the markup), keeping each spec's intent.
4. Specs that also fail on main (promo "list", sales-report "f: contributor"): leave alone, list in the PR body.

## Then, in order

5. `npm run check:bundle-budget` on main and on the branch; both numbers in the PR body. Lazy imports stay lazy.
6. Shape survey: read-only SELECT counts on prod (`stsdtacfauprzrdebmzg`): ticket types per series, orders
   per series (incl. over 100), refunded / part-refunded. Counts only, no personal data, never a write.
7. Walk at 390x844 with both flags on LOCALLY only as owner, manager and contributor; screenshots in the PR.
   If sign-in blocks it, never self-grant a role: write "walk not done: <reason>" under Not verified.
8. INVENTORY.md: file:line on each row; add rows for `GetPaid`, `PromoSection`, `SalesReport`,
   `RefundSheet`, `TypeSheet`, public buyer ticket page. Update the coverage count.
9. `npm run pre-ship`.
10. PR #1668 body from the repo template: "Verified on real data" block with survey counts, both bundle
    numbers, coverage count, honest "Not verified".

15 `test:unit` failures are live-DB contract tests (no DB in the sandbox), not this branch.
Never add `run-ci` yourself. Push after step 3 and again at the end. If a step needs a file outside the
list, stop and say so in the handover. If context runs short, finish the step, push, write what is left.
