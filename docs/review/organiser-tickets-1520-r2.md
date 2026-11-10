# Review 1520-r2 (delta): PR #1520 organiser tickets, slice 2 Part A, fix round 1

Target: **PR #1520**, **head 4de9a894** on `claude/organiser-area-v2-tickets` (`git ls-remote` 2026-11-10; GitHub API
head sha `4de9a894747c2ea2f446075213626978f0e9e8e1`), round-1 head `7debc56`. Delta reviewed: `git diff 7debc56 4de9a894`
(15 files, 374 / 37; all under `src/modules/organiser/p3/tickets`, `src/modules/organiser/tickets` and `docs/handover/`).
Brief: `docs/briefs/review-organiser-tickets-1520-r2.md` on `brief/review-organiser-tickets-1520-r2` (sha 3a21901).
Round-1 report: `docs/reviews/1520-r1.md` (HOLD: F1 blocker, F2-F7). Fix brief: `docs/briefs/organiser-area-v2-tickets-fix1.md`.
Independent reviewer (not round 1, not the builder); read-only review branch, nothing pushed to the PR branch, no PR comment.
Runs: scratch `git worktree` at `4de9a894` with `node_modules` symlinked, removed afterwards. No prod read this round.

## Verdict: PASS (Part A). Merge still gated on Part B being live and read back on prod.

Every round-1 finding is fixed at the head and each fix is held by a test that goes red when the fix is reverted.
The one blocker (F1) is closed in the real read shape: the manager's "Ask the owner to refund this order." note now
renders on `parseOrderRow` output of an `ORDER_SELECT_COUNTS`-shaped row (no pence key), and the pence-gated mutant is red.
No regression in the tickets and organiser suites; owner paths unchanged; flag gating untouched by the delta.

The merge condition from round 1 stands and the PR body says so: until Part B (admin repo) lands, a manager can still
refund through `ticket-refund` and still receives every `*_pence` field in the `ticket_sales_summary_v1` response body and
money columns from `ticket_orders` by RLS. The client now drops the summary pence before the react-query cache; it cannot
stop the server sending them.

## Checks (brief order)

### 1. F1: manager sees the ask-the-owner note on the REAL read shape -- PASS

- Gate: `TicketsEntry.tsx:301` `manager && !owner && refundableByStatus(o)`; legacy note `:338`
  `!manager && shown.some(refundableByStatus)`. `refundableByStatus` (`ticketModel.ts:592`) is `o.status === 'paid'`.
  The owner's Refund button (`:305`) keeps `refundable(withPendingRefund(...))` (pence).
- Round-1 proof shape at the new head: `tickets.managerReal.matrix.test.tsx` builds raw rows with exactly the
  `ORDER_SELECT_COUNTS` columns (`countsRow`), through `parseOrderRow` (paid, paid again, refunded with null buyer,
  disputed, expired), asserts every parsed pence is 0, `refundable()` false on every row, and that a manager gets
  `tix-refund-ask-owner` on each paid row and nothing else; a contributor gets `tix-refund-reason` once. GREEN at head.
  `tickets.roles.matrix.test.tsx` now runs on the same shape: the harness `useSeriesOrders` mock hands a `money: false`
  caller `countsOnlyOrder` rows (`harness.tsx:12-13`, `parseOrderRow` of a row with no pence column).
- Mutant M1 (`refundableByStatus(o)` -> `refundable(o)` on the note): **RED**, 4 cells
  (managerReal manager x3, roles "manager > Refund never shows (r07)").
- Mutant M1b (legacy note back to `shown.some(refundable)`): **RED**, 4 cells (managerReal contributor, roles
  contributor r07, `tickets.matrix` contributor, `refund.partial` non-manager reason).

### 2. F2: `owner &&` at GetPaid MoneySoFar -- PASS

- `GetPaid.tsx:195` `{owner && types && types.length > 0 && <MoneySoFar/>}`. New describe in `getPaid.matrix.test.tsx`
  with `SHAPES.selling.sales` (owner control row draws `tix-money` and `tix-setup`); manager and contributor x
  none/started/connected assert no `tix-money`, `tix-setup`, `tix-money-error`, `tix-money-refused`, no pound sign.
- Mutant M2 (drop `owner &&`): **RED**, 6 cells (was GREEN at 7debc56 per round 1).

### 3. F3: manager summary parse drops `*_pence` before caching -- PASS

- `ticketsApi.ts:69-72` `parseSummary(data, { money })`: with `money === false` every key matching `/_pence$/` is
  filtered from each raw row before mapping, so `grossPence`, `discountsPence`, `bookingFeesPence`, `refundedPence`
  AND `pricePence` parse to 0 (`num(undefined)` -> 0; checked the parse body). `fetchSalesSummary(id, { money })`
  requires the flag. `useSummary(id, money)` (`data.ts:54`) requires it and keys the cache
  `[...ticketKeys.summary(id), 'money' | 'counts']`. Callers: `TicketsEntry.tsx:163` `canRefund(role)`,
  `GetPaid.tsx:127` and `:276` `isOwner(role)`. `refresh()` at `TicketsEntry.tsx:213` invalidates by the prefix key,
  which matches both tails (react-query partial match), so a write still refreshes either role's summary.
- Tests: managerReal "a non-owner summary keeps no pence": `parseSummary` with and without money on a raw reply that
  carries pence; and `useSummary` through the REAL `data.ts` with `supabase.rpc` spied, asserting the cache holds one
  entry under `[..., 'counts']` with no non-zero pence (and `[..., 'money']` with pence for the owner). Roles and
  getPaid assert the screens pass `money === owner` (`q.summaryMoney`).
- Mutants: M3 (parse keeps pence for everyone): **RED** 2 cells. M3b (TicketsEntry passes `true` for every role):
  **RED** 4 cells. M3c (one cache key for both roles): **RED** 2 cells.
- PR body: NOT verified says the client still CALLS `ticket_sales_summary_v1` for a manager, pence are in that
  response body, the parse drops them before the cache, and `ticket_orders` RLS still lets a manager read money
  columns and full `buyer_name`, until Part B. Present, as asked.
- Side effect worth knowing (not a finding): `price_pence` is also stripped for a non-owner, so the summary's
  `pricePence` is 0 for a manager. No screen reads price from the summary: type rows read `t.pricePence` from
  `useSeriesTypes` (`TicketsEntry.tsx:602`), the tile reads counts only. Fine today; a future consumer of
  `TypeSales.pricePence` on a manager path would show "Free".
- Extra fix in the delta (not in round 1): Home `TicketsSoldTile` showed "Tickets sold · £gross" to a manager; now the
  amount is owner-only (`GetPaid.tsx:275-284`), tested in `getPaid.matrix` (manager tile = `34Tickets sold`). Correct and
  necessary, because a counts-only summary would otherwise have shown £0.00.

### 4. F4-F7 -- PASS

- F4: ONE mapping. `shortRef` (`ticketModel.ts:600`, first 8 letters/digits of the id, upper case) is read by
  `buyerFirstAndCode` (list `TicketsEntry.tsx:291`, Refund sheet title via `refundQuestion` `ticketModel.ts:616`, toast
  `whose` at `RefundSheet.tsx:107`) and re-exported by `salesReportModel.ts:120` for the CSV. `orderShortCode` (4 chars)
  is gone (`git grep` at head: no hit outside tests of its absence). Tests: managerReal "one order code" asserts
  `reportShortRef === shortRef` by identity, the label and sheet title; `ticketsMoney.matrix` label `3F2A9C10`;
  `stack.draft` toasts use `buyerFirstAndCode` (`who()`). Mutants: M4 (back to 4 chars) **RED** 9 cells; M4c (sheet
  title with its own 6-char code) **RED** 2 cells. (A first M4b using the raw id's first 8 chars was equivalent on the
  fixture ids, whose first 8 characters carry no dash, so it was GREEN; not a survivor, an equivalent mutant.)
- F5: the `<p data-testid="tix-refund-ask-owner">` is inside `.p3-grow` under `.p3-row-tags` (`TicketsEntry.tsx:299-303`),
  no longer a flex sibling; managerReal asserts parent class and previous sibling. Markup only; not walked (below).
- F6: `SalesReport` `money: boolean` required (`SalesReport.tsx:18,26`); the one caller passes `money={owner}`
  (`TicketsEntry.tsx:471`); `salesReport.matrix` passes `money`; tsc 0 errors.
- F7: `NOT_MANAGER_STRIPE` deleted (`git grep` at head: no hit). New `refundReasonMessage` (`ticketModel.ts:749`) maps a
  refund `not_authorised` to `NOT_OWNER_REFUND`; `RefundSheet.tsx:121` uses it. Ticket-type writes keep `NOT_MANAGER`
  ("owner or manager"), which is right there. No test pins `refundReasonMessage('not_authorised')` directly; the
  mapping is one line and the reply is reachable only for an owner whose seat went mid-session. Not a blocker.

### 5. No regression -- PASS

- `npx vitest run src/modules/organiser src/modules/tickets` at `4de9a894`: **337 files, 13912 passed, 4 skipped, 0 failed**.
- Owner paths unchanged: `tickets.roles.matrix` owner cells assert amounts on order lines, `tix-refund` on paid rows,
  `tix-report-total-money` and `tix-report-download` present (`:52-84`); `getPaid.matrix` owner control row draws
  `tix-money` and `tix-setup`; both GREEN at head. The owner's Refund gate and `fetchOrders` default select are untouched
  by the delta.
- Flags off = no change: the delta touches no file outside `p3/tickets`, `organiser/tickets` and `docs/`; the mounts
  (`EventPage.tsx` under `flags.organiserTicketing`, `OrganiserRoutes.tsx` P3 area) are as round 1 read them.
- `npx tsc --noEmit -p .` at `4de9a894`: 0 errors. `npm run check:mojibake` (this branch): 2661 files, clean.
- PR check runs on `4de9a894` (GitHub API, 17:05 UTC): unit x3, integrity, contract-check, live-db-gate, build-smoke,
  phone-qa (1)(2)(3), phone-qa-section, real-data-verified, bundle-budget, wallclock-brand, bom-check, masking-check,
  notification-check, dancer-area-isolation, route, decide, open-pr: success; seo/og/lighthouse/synthetic/doc-weight:
  skipped; **e2e-smoke: still in_progress** when this report was written.

### 6. Could not verify

- No 390x844 browser walk: F5 is checked by markup position in jsdom only. No preview deploy, no seeded owner or
  manager account in this sandbox.
- Part B is not live: the server-side refusal (`ticket-refund` for a manager), the manager payload of
  `ticket_sales_summary_v1`, and `ticket_orders` RLS were not re-read this round; round 1's prod reads are the record.
  The merge gate is unchanged: not before Part B is live and read back on prod.
- No prod read this round (no new shape question arose from the delta).
- `e2e-smoke` on the head had not finished at report time (every other check success or skipped).
- Whole-suite `npm run test:unit`, the lint chain and the e2e gates were not run here; CI on the head is the evidence.
- No real Stripe refund; no signed-in manager session.

## Mutant table (scratch worktree at `4de9a894`; specs: `p3/tickets/__tests__` + `organiser/tickets/__tests__`, 2281 tests)

| Mutant | Change | Result |
|---|---|---|
| M1 | `TicketsEntry.tsx:301` note gate `refundableByStatus(o)` -> `refundable(o)` | RED, 4 |
| M1b | `TicketsEntry.tsx:338` legacy note `shown.some(refundable)` | RED, 4 |
| M2 | `GetPaid.tsx:195` drop `owner &&` before `<MoneySoFar>` | RED, 6 (was GREEN at 7debc56) |
| M3 | `ticketsApi.ts:72` parse keeps pence for everyone | RED, 2 |
| M3b | `TicketsEntry.tsx:163` `useSummary(org.id, true)` | RED, 4 |
| M3c | `data.ts:56` one cache key for both roles | RED, 2 |
| M4 | `shortRef` 8 -> 4 chars | RED, 9 |
| M4b | sheet title from raw `id.slice(0, 8)` | GREEN, equivalent on fixture ids (no dash in first 8) |
| M4c | sheet title from its own 6-char code | RED, 2 |

## Line

PASS for Part A at head 4de9a894. Round-1 F1-F7 are fixed with tests that bite. Keep the merge gate: Part B live and read
back on prod first (manager refund refused server-side; summary pence not sent to a manager), then a short re-review of
#1520 with the 390x844 walks 1-9.
