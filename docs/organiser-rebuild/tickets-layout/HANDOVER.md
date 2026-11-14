# Handover: tickets layout (Option A)

Done: Tickets is inline on the event page (stats row, notes, get-paid banner, types, Add a ticket, promo, orders preview). The only sheet left is the orders view (`tix-orders-sheet`, See all). The inline section carries `tix-tall` so older tests find it; `tix-row` is now a heading, not a button. Stats: sold of capacity, plus takings after refunds (`showMoney`) or order count. No checked-in number: the summary carries none.
Tests: `tickets.layout.matrix.test.tsx` added; `stack.draft` and `typeSheet.connectInline` adjusted for the removed base sheet. 1027+45 organiser ticket tests green.
Left: 390x844 browser walk with flags on; prod shape survey; `check:bundle-budget` main vs branch; e2e specs that click `tix-row` or look for `tix-tall` as a sheet (walk-p3-promo-codes, p3-toast-geometry) were not run; `npm run pre-ship`.
tsc run on the branch head: 0 errors in branch files. Coverage: 15 of 17 inventory rows placed.

## Continuation worker (dt_25fbf453d04e)
Done: step 1 (tsc: 0 errors; `test:unit`: 15 failures, all live-DB contract tests `eventViewCompat`, `occurrenceProgram`, `publicEventPageLineup` plus `integrityCouldNotRun`, none in files this branch touches); step 2 (matrix: added owner with `moneyVisible` false x every shape, 57 tests green; `showMoney` untouched); step 3 partly (removed the now-pointless `tix-row` clicks in 6 e2e specs).
E2E run locally with both flags on (never committed): 9 passed, 16 failed. Same specs on `origin/main`: promo "list" test and sales-report "f: contributor" ALSO fail there, so they are not this branch.
Branch-only failures to fix next:
- `walk-p3-promo-codes` "a locked code": Save changes bottom is 909 > 844 (edit sheet no longer fits the 390x844 viewport; passes on main).
- `walk-ticket-sales-report` a-e: `tix-report-money` / `tix-report-total-money` not found. The spec's `ticket_sales_summary_v1` mock returns `{ ok: true, ticket_types: [] }` with no `moneyVisible`, so `showMoney` is false. Probably the fixture, not the gate: update the mock to return `moneyVisible: true`; do NOT loosen `showMoney`.
- `p3-gate-overlays` (2 tests) and promo row count (6 vs 4: the `^promo-row-` regex now also matches child testids): not checked against main.
Left: steps 4 (bundle budget), 5 (prod shape survey), 6 (walk), 7 (INVENTORY file:line + 6 rows), 8 (`pre-ship`), 9 (PR body).

## Round 3 (opus, dt_d17c279f5c7b)
Fixed (branch-only reds):
- `walk-p3-promo-codes` "a locked code": cause was NOT the sheet layout. With Tickets inline there is no `.p3-scrim` ancestor, so `PromoSection` portalled its sheet into bare `document.body`, outside `.p3-theme`: no sheet CSS, the scrim drew `position: static` below the fold (bottom 909). Now the host falls back to the nearest `.p3-theme` (`PromoSection.tsx:58-67`). 4/4 locked tests pass (390x844, 320x568, light, dark).
- `p3-gate-overlays` (2): the page never settled because the inline Tickets now reads `ticket_promo_list_v1` at load and the spec did not mock it. Mocked it like the other ticketing reads. 2/2 pass.
- `walk-ticket-sales-report` a-e: these fail on `origin/main` too (same not-found). Mock now sends `money_visible` as prod does (true for an owner seat only; `showMoney` untouched), and expected strings follow `formatPence` (whole pounds drop `.00`, the documented one format). a-e pass.
Left alone (also red on `origin/main`): promo "list" (`^promo-row-` matches child testids, 6 vs 4; with the regex tightened the next red is the spec's own scroll baseline, taken before it scrolls the section into view; opening the sheet itself does not scroll: before/after both 1301) and sales-report "f: contributor" (expects money lines a contributor never gets).
Bundle budget: identical on main and branch (e.g. event 379.6 KB / 381, dancer-app 379.8 KB / 381; all ratchets ok).
Survey (prod, read-only counts): 19 ticket types on 3 series (max 12 per series, 17 on sale, 2 paused); 6 orders on 2 series (max 4 per series, 0 series over 100); 2 paid, 3 expired, 1 refunded; 1 part-refunded; 0 disputed.
Walk: 390x844, both flags on locally, route-mocked fake, as owner, manager and contributor, prod-shape fixture and a 12-type fixture: no sideways scroll, no enabled button under 40px; money stat for owner only. Screenshots kept in the session scratchpad, not committed (a docs path outside the brief list).
Not done: screenshots in the PR body (no upload path from this sandbox); a real signed-in walk (fake only).
pre-ship (round 3): every check passes except three that are red on `origin/main` too: `check:no-social-word` (`src/modules/tickets/__tests__/priceSteps.matrix.test.tsx:32`, not this branch), `test:unit` (the 15 live-DB contract tests), and the typecheck count ratchet (131 on branch, 131 on `origin/main` with `tsconfig.app.json`, so the baseline of 106 is stale; this branch adds 0). Because of those, pre-ship skipped its `test:e2e` step; the specs above were run by hand. `npx tsc --noEmit -p .`: 0 errors.
Next steps: owner phone check with both flags on; a separate PR for the main-wide reds (promo "list" spec regex and its scroll baseline, sales-report "f" contributor expectations, the "Social" label in priceSteps.matrix, the typecheck baseline).
tsc run on the final commit: 0 errors in branch files.
