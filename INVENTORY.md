# INVENTORY: organiser area v2, slice 2 (Tickets: counts for managers, money for owners)

Brief: `docs/briefs/organiser-area-v2-slice2-tickets.md` on `brief/organiser-area-v2-tickets` (sha 62feb0c). Branch: `claude/organiser-area-v2-tickets`, cut from `origin/main` a5b7d98 (2026-11-10).

## 1. First task: what the server gives a manager (read-only, prod `stsdtacfauprzrdebmzg`, 2026-11-10)

All reads were SELECTs on `pg_proc`, `pg_policies`, `information_schema` grants, plus row counts, and one read of the deployed `ticket-refund` edge function's source (`get_edge_function`, read-only). No writes. No personal data.

| Question | Live answer | Evidence |
|---|---|---|
| 1. Does `ticket_sales_summary_v1(p_organiser_id)` return money to a manager? | **YES.** Gate: `is_admin() OR _is_entity_owner_or_editor('organiser', id, uid)`. Live `_is_entity_owner_or_editor` = `_is_entity_member(..., ARRAY['owner','manager','contributor'])`. Per type it returns `gross_pence`, `discounts_pence`, `booking_fees_pence`, `refunded_pence` to owner, manager **and contributor**. EXECUTE: `authenticated`, `service_role`. | `pg_get_functiondef` of both functions |
| 2. Can a manager read `ticket_orders` money columns under RLS? | **YES.** One SELECT policy, `ticket_orders_member_or_buyer_read` (role `authenticated`): `is_admin() OR buyer_user_id = auth.uid() OR _is_entity_owner_or_editor('organiser', organiser_id, auth.uid())`. `authenticated` holds SELECT on `subtotal_pence`, `booking_fee_pence`, `total_pence`, `refunded_pence`, **and on `buyer_email` and `buyer_name`** (full name). | `pg_policies`, `information_schema.column_privileges` |
| 3. What does `ticket-refund` call, and who may refund? | The refund gate is **not an RPC**. Edge function `ticket-refund` (v21, `verify_jwt=true`) runs `handleTicketRefund` (`functions/_shared/ticketingHandlers.ts:556`), which checks `deps.canManageOrganiser(userId, order.organiser_id)` at `:601` and answers `{ok:false, reason:'not_authorised'}` 403 otherwise. `canManageOrganiser` (`functions/_shared/ticketingEdge.ts:84`) reads `entity_members` with `member_role=in.(owner,manager)` or `admin_users`. **A manager can refund today.** Whole refunds then call `ticket_order_mark_refunded_v1` (`:620`); that RPC and `ticket_order_charge_refunded_v1` have no caller check and are EXECUTE for `service_role` only. `_ticket_can_manage_organiser_v1` (owner, manager via `_organiser_seat_kind_p5`, admin) exists on prod but the refund path does not call it. | edge function source; `has_function_privilege` |

**Outcome B.** Money reaches a manager (and a legacy contributor) by RPC *and* by RLS, and a manager can refund through the edge function. Part B (admin repo) must:
- refuse a manager's refund in `canManageOrganiser` / `handleTicketRefund` (edge function, not an RPC), with the reply word `not_allowed` (the client now maps it, `ticketModel.ts:662`);
- drop the `*_pence` fields from `ticket_sales_summary_v1` for anyone but the owner;
- close the `ticket_orders` money columns (and `buyer_email`, full `buyer_name`, Q14/A2) to non-owners: RLS cannot hide columns per row, so this needs a view/RPC or column revoke plus an owner-only RPC. **Permission change: owner sign-off.**

Does Outcome B contradict a "What main lacks" bullet? **No.** Every bullet is about Website client code and still held on main a5b7d98 (line numbers moved slightly from the brief's 893163504392 read; current main lines below). Two brief facts did not hold and are recorded, not acted on: (a) the refund predicate is the edge function's `canManageOrganiser`, not `_ticket_can_manage_organiser_v1`; a manager refusal today would come back as `not_authorised`, not `not_allowed`; (b) prod shapes drifted (below).

### Prod shape counts (2026-11-10, counts only)

| Shape | Brief (2026-11-09) | Live 2026-11-10 |
|---|---|---|
| ticket types | 2 (both paused) | **5**: 3 `on_sale`, 2 `paused` |
| orders | 3 (1 paid, 1 partial, 1 full refund) | **5**: 2 `paid` (1 of them partly refunded), 1 `refunded`, **2 `expired`** |
| `event_attendance` rows (Going) | 7 | 7 |
| ticket_url | "72 series" on `event_series` | column is on `event_series_p5` (`ticket_url`, `default_ticket_url`) and `event_occurrence_override_p5`; `event_series.ticket_url` does not exist. Count not re-read. |

## 2. Admin (Part B touches; admin repo not readable from this session)

- `functions/ticket-refund/index.ts:12` (comment "owner or manager ... may refund") and `functions/_shared/ticketingHandlers.ts:601` (the gate), `functions/_shared/ticketingEdge.ts:84-96` (`canManageOrganiser`, `member_role=in.(owner,manager)`). Line numbers are the deployed v21 source.
- `supabase/migrations/20270314170000_ticket_promo_codes_v1.sql`: `ticket_sales_summary_v1` (gate `_is_entity_owner_or_editor`). File:line not read (repo access denied to this session).
- `ticket_orders_member_or_buyer_read` policy and the column grants: migration file not identified (repo access denied).

## 3. Current Website (main a5b7d98) and what this branch changes

| Bullet | main | branch |
|---|---|---|
| Refund for owner and manager | `TicketsEntry.tsx:285` `manager && refundable(...)` | `TicketsEntry.tsx:293` `owner && refundable(...)`; sheet only for owner `:493` |
| No "Ask the owner" note | `TicketsEntry.tsx:318` generic `NOT_MANAGER_REFUND` | `TicketsEntry.tsx:290-291` `tix-refund-ask-owner` per refundable row (manager); `NOT_MANAGER_REFUND` text now "Ask the owner to refund an order." (`ticketModel.ts`) |
| GetPaid Connect for a manager | `GetPaid.tsx:142` `canGo = manager && ...` | `GetPaid.tsx:145` `canGo = owner && ...`; button, Open Stripe link, setup steps, MoneySoFar and sales errors owner-only; `:154` `PAYOUTS_ASK_OWNER` |
| "Ask the owner to set up payouts" absent | absent | `ticketModel.ts:61` |
| NOT_OWNER_REFUND absent | absent | `ticketModel.ts:73`; `not_allowed` maps to it `ticketModel.ts:662` (also added to `DEFINITE_REFUND_REASONS`) |
| Order line shows money for every role | `ticketModel.ts:821` `orderLine` | `ticketModel.ts:866` `orderLineFor(role, ...)`: `orderCountLine` for anyone but the owner; used at `TicketsEntry.tsx:283` |
| No counts-only view | absent | `TicketsEntry.tsx:327` `tix-counts-only` |
| Sales report money for every role | `SalesReport.tsx:66,84` | `money` prop (`SalesReport.tsx:18`), `TicketsEntry.tsx:453` passes `money={owner}`; amounts and the CSV download (refunded pence, full names) hidden |
| Buyer label is full name | `TicketsEntry.tsx:276`, `RefundSheet.tsx:107`, `ticketModel.ts:531` `buyerNameOf` | `ticketModel.ts:550` `buyerFirstAndCode` used by the orders list `TicketsEntry.tsx:281`, `refundQuestion`, and `RefundSheet.tsx:107` |
| Going count line | absent | `TicketsEntry.tsx` `tix-going-count` from `ticketModel.ts` `goingCountLine`; data `data.ts` `useSeriesGoing` (`get_my_series_going_v1`, owner/manager; `event_attendance` is self-only under RLS, read 2026-11-10) |
| External-link line | absent | `TicketsEntry.tsx` `tix-external-link` from `ticketModel.ts` `externalTicketLine`; data `data.ts` `useSeriesTicketLink` (workspace `default_ticket_url`, else a date's link). Prod 2026-11-10: `event_series_p5` 766 rows, 72 with `ticket_url`, 103 with `default_ticket_url` |
| Refund reply has no manager-refused copy | `ticketsApi.ts:269` | mapping lives in `ticketModel.ts:662` (`reasonMessage`, which the refund sheet already uses); `ticketsApi.ts:148` adds `ORDER_SELECT_COUNTS` and `fetchOrders(typeIds, { money:false })` |

Flags: every change sits inside `TicketsEntry` (rendered only under `flags.organiserTicketing`, `EventPage.tsx:326`, inside the `organiserP3` area) and GetPaid (P3 You area). Flag off = no change.

## 4. Public

Nothing on the public event page is changed. Out of scope.

## 5. Tests and coverage

New: `src/modules/organiser/tickets/__tests__/ticketsMoney.matrix.test.ts` (28 tests), `src/modules/organiser/p3/tickets/__tests__/tickets.roles.matrix.test.tsx` (15). Extended: `getPaid.matrix.test.tsx` (manager rows). Updated to the new behaviour: `stack.draft.test.tsx`, `ticketModel.matrix.test.ts` (buyer label read from the mapping, refundBlock owner-only). Red first: on main's source the 3 new/extended files fail 42 of 71.

| Cell | Anchor |
|---|---|
| 6.4-r01-P1 | `tickets.roles.matrix.test.tsx:50,71` (owner) ; `ticketsMoney.matrix.test.ts:53` |
| 6.4-r01-P11 | `tickets.roles.matrix.test.tsx:50,71` (contributor) |
| 6.4-r02-P4 | `tickets.roles.matrix.test.tsx:50,71,79` ; `ticketsMoney.matrix.test.ts:53,97` (client select). Direct-RPC part: NO anchor (Part B) |
| 6.4-r02-P11 | `tickets.roles.matrix.test.tsx:50,79` |
| 6.4-r03-P1 | `getPaid.matrix.test.tsx:24-26` (owner rows) |
| 6.4-r03-P4 | `getPaid.matrix.test.tsx:30-31` |
| 6.4-r03-P11 | `getPaid.matrix.test.tsx:28` |
| 6.4-r04-P1/P4/P11 | `tickets.goingLink.matrix.test.tsx` CASES rows 9-10 (zero state, two paused types) x 3 roles |
| 6.4-r05-P1/P4/P11 | `tickets.goingLink.matrix.test.tsx` CASES rows 1-5, 8 x 3 roles |
| 6.4-r06-P1/P4/P11 | `tickets.roles.matrix.test.tsx:59` ; `ticketsMoney.matrix.test.ts:64-78` |
| 6.4-r07-P1 | `tickets.roles.matrix.test.tsx:63,86` |
| 6.4-r07-P4 | `tickets.roles.matrix.test.tsx:63` ; `ticketsMoney.matrix.test.ts:89`. Direct refusal: NO anchor (Part B) |
| 6.4-r07-P11 | `tickets.roles.matrix.test.tsx:63` |
| 6.4-r08-P1/P4/P11 | NO anchor (walk) |
| 6.4-r09-P1/P4/P11 | `tickets.goingLink.matrix.test.tsx` CASES rows 6-8 x 3 roles |

**Coverage count: 25 cells (r01 and r02 have 2 each, the other seven rows 3 each). 13 have a file:line anchor (r01 x2, r02 x2, r03 x3, r06 x3, r07 x3); 12 have none (r04 x3, r05 x3, r08 x3, r09 x3). r02-P4 and r07-P4 are anchored for the client half only; their direct-server refusal waits on Part B.** The 12 unanchored cells are a STOP: the slice is PARTIAL.

## 6. Handover (PARTIAL)

Done: first task (Outcome B, written above); client split for refund, order lines, sales report, GetPaid, buyer label, `not_allowed` copy; counts-only orders select in the API (exported, tested); tests red-first then green; `tsc` clean.

Left, in order:
1. **Part B brief** (admin repo, lead claims `claude/organiser-area-v2-tickets-db`): the three server items in section 1. The refund refusal is in the edge function. Owner sign-off.
2. Wire `fetchOrders(..., { money: owner })` through `src/modules/organiser/p3/tickets/data.ts` `useSeriesOrders`: that file is an 11th path (size gate: 10), so not done. Until then the client still asks a manager's orders read for pence columns (never shown).
3. r05 Going count (`tix-going-count`) and r09 external-link line (`tix-external-link`): need a data source (`event_attendance` under RLS for a manager is not read; `ticket_url` is on `event_series_p5`, and `HomeSeriesFull` carries neither). Likely a new read: decide whether that is a client read or a Part B RPC field.
4. r04 zero/paused cells for P4/P11, r08 five-tab fit, `tickets.walk.test.tsx`, and walks 1-9 at 390x844 on a seeded preview DB (no preview DB access from this session).
5. The Sales report CSV for the owner still carries full buyer names (`salesReportModel.ts:109`): Q14 says full names are not shown to organisers. Outside the 10 paths.
6. Path count: the branch touches 12 paths (brief limit 10): +`INVENTORY.md`, and existing tests `stack.draft.test.tsx` / `ticketModel.matrix.test.ts` had to follow the label and refund-role change. `tickets.walk.test.tsx` was not created.
7. Design record `docs/design/<pr>.md`, independent Fable review, owner sign-off.

## 7. Continuation 1 (brief `-cont1.md`, 2026-11-10)

Done: Going count (r05) and external-link line (r09) built, screen x role (owner, manager, legacy contributor) x shape in `src/modules/organiser/p3/tickets/__tests__/tickets.goingLink.matrix.test.tsx` (35 tests; red first on the old screen: 14 failed). r04 zero / paused cells added there. Left item 2 done: `useSeriesOrders` passes `money: owner`, so a manager's orders read asks for no pence columns (test: `orders read asks for money only for the owner`). Design record `docs/design/1520.md`.

**Coverage now: 25 cells; 22 anchored, 3 without (r08 x3: five tabs at 390x844 is a walk, not run). r02-P4 and r07-P4 direct-server refusal still waits on Part B.**

Paths added beyond the brief's list: `src/modules/organiser/p3/tickets/data.ts` (the two reads and the orders money flag) and `__tests__/harness.tsx` (mocks for them). Reason: every Tickets screen test mocks `../data`; reading the RPCs straight from `TicketsEntry` would hit Supabase in ~15 test files.

Left: walks 1-9 at 390x844 (`scripts/preview-deploy.mjs` named by the brief does not exist in the repo; no seeded preview DB from this session); Part B (admin repo); independent Fable review; owner sign-off; Sales report CSV full names (`salesReportModel.ts:109`).
