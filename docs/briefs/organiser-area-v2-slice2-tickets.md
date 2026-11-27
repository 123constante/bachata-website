# Brief: organiser area v2, slice 2 (Tickets: counts for managers, money for owners, owner-only refund, GetPaid copy)

Brief-version: 2
Branch: claude/organiser-area-v2-tickets
Repo: Website (`C:\dev\Website`). Part B (RPC and payload) lives in the admin repo, `bachata-admin-11april`, as a second PR (see Boundary).
Lane: careful. Money and permission changes. Contract section 8: OWNER SIGN-OFF on the PR before merge for the refund refusal (R18) and any payload change. The standing migration approval does NOT cover these.
Parent: `C:\Users\ecual\.claude\plans\CONTRACT-organiser-arc-combined.md` (DRAFT 3, sections 2, 3, 6.4, 7, 8, 9; coverage map `C:\Users\ecual\.claude\plans\CONTRACT-organiser-arc-coverage-map.md`, rows with slice 2)
Source rows: `C:\Users\ecual\.claude\plans\CONTRACT-organiser-area-v2.md` section 6.4 (T1-T10, X5), amendments A1, A2, A16 in its section 11
Owner answers: CONTRACT-organiser-arc-combined.md section 2, "Owner answers 2026-11-09" (PQ1, PQ3) and Q14, Q15, Q16, Q28
Dispatch: NOT yet. The lead claims a `claude/organiser-area-v2-*` branch on `C:\Users\ecual\.claude\plans\PROGRAM.md` and dispatches via dispatch-one. Do not dispatch before the lead has seen the coverage map and the 25-point re-check (contract section 0) has passed.

## Goal
On Tickets, an owner sees sales, refunds and payout state, and can refund one order. A manager sees ticket COUNTS only (no money anywhere on the tab or in any reply they receive), sees no Refund button, and sees "Ask the owner" where a refund or payout action would be. Free events with RSVPs show as "Going" counts with no money. With `organiserTicketing` or `organiserP3` off, nothing changes.

## Boundary
- IN (Website, Part A): Tickets tab, order rows, Sales report card, GetPaid copy and actions for managers, buyer label, Going count line, external-link line (X5), tests and the walk.
- IN (admin repo, Part B, separate PR, same slice): the refund refusal for managers at the RPC (`not_allowed`) and removal of money fields for managers from the sales summary payload. Written as its own brief after the first task below; lead claims the branch `claude/organiser-area-v2-tickets-db`. Replay proof, independent review, prod read-before with a written prediction, read-back after apply, one log line each. Owner sign-off on the PR before merge.
- OUT: ticket tiers and checkout (website-72). Door (slice 3). To-dos and cancel refund loop (slice 4). Public event page. Contributor UI (removed, OPEN:8): none is built; contributor cells are tested only as legacy rows.
- The Website repo owns no migrations. If Part A appears to need a DB change, STOP and report to the lead.

## FIRST TASK: verify before anything else (the answer is NOT assumed)
Contract section 10 says whether Tickets already splits counts from money is NOT verified. Do this first, read-only (Supabase read-only SELECT on pg_proc and grants, `git grep` on origin/main), and write the result into INVENTORY.md:
1. Does `ticket_sales_summary_v1` return money (gross, refunded, net) to a manager? Admin migration `20270314170000_ticket_promo_codes_v1.sql` re-creates it with a gate that admits owner, member editor and manager (`_is_entity_owner_or_editor`). Read the live body on prod.
2. Can a manager read `ticket_orders` money columns (`subtotal_pence`, `booking_fee_pence`, `total_pence`, `refunded_pence`) under RLS? Read the live policies. `fetchOrders` on main selects them.
3. Which RPC does the `ticket-refund` edge function call? Its body is outside this repo and is NOT verified. The admin predicate `_ticket_can_manage_organiser_v1` (owner, manager, platform admin) is the refund predicate per migration comments; confirm on prod.
Outcome A (server already counts-only for managers): the split is client work plus tests; Part B shrinks to the refund refusal.
Outcome B (money reaches a manager by RPC or RLS): Part B must remove the money fields for managers. That is a permission change with owner sign-off.
If the outcome contradicts a "What main lacks" bullet, stop and report before building.

## INVENTORY first (rule 1)
Before any code change, write `INVENTORY.md` at the repo root of the branch with three parts and file:line for each item:
- Admin: the refund and summary callers in the admin repo that Part B touches (migration file:line, function name).
- Current Website: each file under "What main lacks", with the line that renders the thing the bullet describes.
- Public: nothing is changed on the public event page; record that it is out of scope.
Include the first-task result (both outcomes, with the live read's row counts only, no personal data).
End INVENTORY.md with a coverage count: cells in "Tests" and how many have a file:line anchor. Any cell without an anchor is a STOP.

## What main lacks
Each bullet is checked against origin/main at draft time. `extends:` marks a change to a file that already exists on main. Other bullets name a NEW grep token that the change adds, which must be absent from main.

- extends: The Refund button renders for every owner and manager on each refundable order row (`manager && refundable(...)`); it must render for the owner only -- src/modules/organiser/p3/tickets/TicketsEntry.tsx
- A manager's refundable order row has no "Ask the owner" note; the note on main is the generic role copy -- grep: tix-refund-ask-owner
- extends: A manager with payouts not connected is offered a Connect action (`canGo = manager && state !== 'connected'`) instead of "Ask the owner to set up payouts" -- src/modules/organiser/p3/tickets/GetPaid.tsx
- The manager payouts copy "Ask the owner to set up payouts" does not exist on main -- grep: Ask the owner to set up payouts
- The owner-only refusal copy for a refund attempt by a manager does not exist -- grep: NOT_OWNER_REFUND
- extends: The order line shows the money total (`orderLine` renders `totalPence`) for every role, with no counts-only line for a manager -- src/modules/organiser/tickets/ticketModel.ts
- No counts-only Tickets view for managers exists (no money on any line) -- grep: tix-counts-only
- extends: The Sales report card (Taken, Refunded, Net) opens for every role with no role check in the component -- src/modules/organiser/p3/tickets/SalesReport.tsx
- A buyer label that is first name plus short code, used by the orders list and the refund sheet alike, does not exist; the label on main is the full buyer name -- grep: buyerFirstAndCode
- A free-event "Going" count line on Tickets does not exist -- grep: tix-going-count
- No Tickets line says that an event sells on an external link (ticket_url, 72 series) rather than Stripe -- grep: tix-external-link
- extends: The refund call maps no reply to a manager-refused message; a not_allowed reply has no copy -- src/modules/organiser/tickets/ticketsApi.ts

Evidence for the bullets above (read on origin/main 893163504392, 2026-11-09): TicketsEntry.tsx:284 renders Refund for `manager`; TicketsEntry.tsx:443 renders the Sales report with no role check; GetPaid.tsx:142 `canGo`; ticketModel.ts:55 `canManage` (owner or manager); ticketModel.ts:57 NOT_MANAGER_REFUND text; ticketModel.ts:815 `orderLine`; ticketsApi.ts:152 reads money columns of ticket_orders; ticketsApi.ts:269 refundOrder invokes `ticket-refund`. None of this proves what the server returns. That is the first task.

## Files
src/modules/organiser/p3/tickets/TicketsEntry.tsx
src/modules/organiser/p3/tickets/GetPaid.tsx
src/modules/organiser/p3/tickets/SalesReport.tsx
src/modules/organiser/p3/tickets/RefundSheet.tsx
src/modules/organiser/tickets/ticketModel.ts
src/modules/organiser/tickets/ticketsApi.ts
src/modules/organiser/tickets/__tests__/ticketsMoney.matrix.test.ts (new)
src/modules/organiser/p3/tickets/__tests__/tickets.roles.matrix.test.tsx (new)
src/modules/organiser/p3/tickets/__tests__/tickets.walk.test.tsx (new)
.github/workflows (read only; each CI job step is run locally)

Ten distinct paths in total: the size gate limit. Do not add a path.

## Design rules
- Owner: sees sales, refunds, payout state, buyer first name plus short code, and the Refund button on an order that can be refunded. Refund is the one money write on this tab (Q15).
- Manager: sees ticket COUNTS (sold, left, Going). No money on any line, in the UI or in any reply. No Refund button; the row says "Ask the owner" (PQ1). GetPaid shows "Ask the owner to set up payouts" and no payout amounts (PQ1). Manager adds and edits ticket types stays as on main.
- Contributor (P11): removed (OPEN:8). Legacy rows get the manager view with no cancel and no refund (A1). Test them as legacy rows only. Build no contributor option.
- Buyers: first name plus short code, never an email, in the UI and in the payload (Q14, A2). One shared mapping feeds the orders list and the refund sheet. Tests read that mapping; do not hard-code first-name-only strings in a test.
- Free events with RSVPs: a "Going" count, no money (Q16). Source: `event_attendance` (7 prod rows).
- External link (X5): a 72-series event says it sells on an external link; no Stripe controls on that event's Tickets view.
- Money is shown only with the owner's money context: no amount in a manager's empty state, error or toast.
- A paused or sold-out ticket type must never be sellable (website-72 boundary).
- Every new element sits behind `organiserTicketing` (Tickets, doorFlags.ts scope) and `organiserP3` (area and shell, AnimatedRoutes gate). Flag off = today's Tickets, no new testid rendered (A8).
- Tap targets 44 px; px sizes (defect 8). Explicit px for tap targets.
- No copy that names a control not on screen. A disabled control says why.
- Every empty state says what the person can do.
- Copy uses HTML entities for punctuation (no pasted Unicode).

## Tests (table-driven; red first against current code)
One test per R or R* cell, named in the coverage map (ORG-6.4-rNN-PN). Red first against main, then green.

| Row | Journey (contract 6.4) | P1 owner | P4 manager | P11 legacy contributor (A1) | Shapes |
|---|---|---|---|---|---|
| 6.4-r01 | Read Tickets: sales, refunds, payout state (T1) | R: sales, refunds, payout state | N/A (counts only, see r02) | R*: counts only, no money, no refund | T, S+, RF, PAY |
| 6.4-r02 | Counts only for managers; no money on tab or in any reply (T6, Q15) | N/A | R*: counts only; includes a direct RPC call | R* (A1) | T, S+ |
| 6.4-r03 | PAY none / half-set: payouts state, one action (T2, T8) | R: one Connect action | R*: "Ask the owner to set up payouts", no button, no amounts | R* (as P4) | PAY none, PAY half-set |
| 6.4-r04 | T, S0 zero state (T3), E0 state (T5) | R | R* | R* | the 2 paused types |
| 6.4-r05 | Free event RSVP shown as Going, no money (T4, Q16) | R | R* | R* | F with RSVPs (7 rows) |
| 6.4-r06 | Buyer list: first name plus code, never emails, UI and payload (T7, Q14) | R | R* | R* | S+ |
| 6.4-r07 | Refund one order unchanged (T9) | R: refund works as today | R*: no Refund button; "Ask the owner"; direct RPC refused with not_allowed (PQ1) | R* (as P4; OPEN:8) | RF, partial and full refund |
| 6.4-r08 | Five tabs fit at 390x844, no sideways scroll (T10) | R | R | R | n/a |
| 6.4-r09 | External ticket link only (72 series): Tickets says which (X5) | R | R* | R* | ticket_url set, no ticket types |

Count: 25 cells on the coverage map with slice 2 (6.4 only): 10 R and 15 R*. By person: P1 8, P4 8, P11 9. The map IDs are `6.4-rNN-PN`; the map is the authority if they disagree.

Cell values, for the test table: R = required test and walk on prod-shaped data; R* = required on a seeded preview account, named in the PR; N/A = cannot occur for that person.

Refusal tests (direct RPC, not only the UI): a manager's refund call returns `not_allowed` and changes no row; a manager's sales summary and order payload carry no money fields (or, if Outcome A, a test proves the server already refuses). A test that passes only through the UI does not count.

Stale-state tests: after a refund answer lands, the Refund button is gone and the order is not refundable again. A Refund pressed twice sends one request.

Shapes (fixtures and seeded accounts): zero types; one paused type; one on-sale type; a ticketed event with sales; partial refund; full refund; free event with RSVPs; event with ticket_url and no types; manager on the same page; manager with no seat; legacy contributor row.

## Walks (390x844; prod counts in the preview database, never a prod sign-in)
Prod shape counts (contract section 3, 2026-11-09, re-read read-only in the first task): ticketed series 1 (live), ticket types 2 (both paused), orders 3 (1 paid, 1 partial refund, 1 full refund), PAY connected 1 account, PAY half-set 1, PAY none for the rest, free events with RSVPs 7 rows, ticket_url on 72 series. Build the same counts in the preview database. Do not sign in to prod.
1. Owner, ticketed event with sales: order rows, buyer first name and code, sales report money, refund on the paid order (R, r01 r06 r07).
2. Owner, full refund flow on the preview order: confirm, row updates, no second refund (r07).
3. Manager, same event: counts only; no Refund button; "Ask the owner" on a refundable row; no money in the report (r02, r07).
4. Manager, payouts not connected: "Ask the owner to set up payouts"; no Connect button (r03).
5. Zero state and paused types (r04).
6. Free event with RSVPs: Going counts; no money (r05).
7. 72-series event: external link line; no Stripe controls (r09).
8. Five tabs fit; no sideways scroll; taps at least 44 px (r08).
9. Flag off (both flags): Tickets as on main; no new testid.
Walk method: the 390x844 preview method in the memory note `preview_walk_390_method` (gesture-opened popup). Seeded owner and manager accounts are created in the preview database only and signed in on the preview host by their email link. Do not self-grant admin.

## Gates
- First task result in INVENTORY.md; coverage count at the end.
- Red first, then green. Every CI job step of the PR run locally (read the workflow files under `.github/workflows`), including the lint chain and the unit tests (`npm run test:unit`).
- Walks 1-9 at 390x844, screenshots attached to the PR. The PR body says which accounts are seeded (R*).
- Design record `docs/design/<pr>.md` linked in the PR body (UI PR). The lead picks the look; the owner is asked product questions only.
- Independent review by a different worker before the owner sees anything. Money and permission change: the review worker uses the reviewer model in the routing table (Fable for money and permission reviews, contract section 8).
- Part B (admin RPC and payload) applied and read back on prod before this PR merges. Refund refusal must be live at the RPC first.
- OWNER SIGN-OFF on the Website PR and on the Part B PR before merge (R18, PQ1). Not under the standing migration approval.
- One push and one CI run for the slice.
- Stop and report if any cell needs a DB change in the Website repo, or if the first task contradicts a "What main lacks" bullet.

## Verified / Not verified (in the PR body)
Verified on origin/main 893163504392 (2026-11-09 23:05 UTC): the Refund button condition at TicketsEntry.tsx:284; the NOT_MANAGER_REFUND text at ticketModel.ts:57; the Sales report render at TicketsEntry.tsx:443 with no role check; the `canGo` line at GetPaid.tsx:142; `orderLine` with `totalPence` at ticketModel.ts:815; the money columns in the `ticket_orders` select at ticketsApi.ts:152; `refundOrder` invoking `ticket-refund` at ticketsApi.ts:269; `ticket_sales_summary_v1` gate in the admin repo migration `20270314170000_ticket_promo_codes_v1.sql`; the refund predicate `_ticket_can_manage_organiser_v1` (owner, manager, platform admin).
Not verified: whether the server returns money to a manager (first task); the RLS of `ticket_orders` for managers; the body of `ticket-refund` and the RPC it calls; the `event_attendance` shape for Going; the prod flag values of `organiserTicketing` and `organiserP3`; the full list of Tickets tabs; all walks; P4 and P11 shapes beyond seeded accounts.

Owner answers 2026-11-09 (DRAFT 4, binding; the contract DRAFT 4 governs):
- Refund on cancel is automatic for EVERY organiser and every cancel path (no flag-off exception).
- Tickets admit only on the night they were bought for, including one occurrence of a recurring series (careful lane; owner sign-off on the PR).
- Buyers are shown as first name plus short code. Full names are not shown to organisers or door staff.
- Privacy floor stays 5 for the Stats city view.
