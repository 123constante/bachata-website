# Handover: #1520 fix round 1 (review 1520-r1)

Brief: `docs/briefs/organiser-area-v2-tickets-fix1.md` on `brief/organiser-area-v2-tickets` (sha 4e98e77).
Review: `docs/reviews/1520-r1.md` on `claude/review-organiser-tickets-1520`. Branch `claude/organiser-area-v2-tickets`,
PR #1520 (no new PR). Ticket `dt_d848038bb09e`. Part B (admin, server-side refusal) is NOT in this round.

## Done

| Finding | Fix | Test (red first on 7debc56) |
|---|---|---|
| F1 blocker | `refundableByStatus` (`status === 'paid'`) in `ticketModel.ts` gates the manager's `tix-refund-ask-owner` and the legacy `tix-refund-reason` note (`TicketsEntry.tsx`). The owner's Refund keeps `refundable` (pence). | Harness `useSeriesOrders` mock now hands a non-owner `parseOrderRow` of a count-shaped row (`countsOnlyOrder`), so `tickets.roles.matrix` runs on the real read. New `tickets.managerReal.matrix.test.tsx` builds rows from `ORDER_SELECT_COUNTS` itself. Mutant "gate back on `refundable`": roles test RED (manager and contributor r07). |
| F2 | (code already right) | `getPaid.matrix`: owner control row draws `tix-money` + `tix-setup` from `SHAPES.selling` sales; manager and contributor x none/started/connected assert no `tix-money`, `tix-setup`, `tix-money-error`, `tix-money-refused`, no pound sign. Mutant "drop `owner &&` before `<MoneySoFar>`": RED (6 cells). |
| F3 | `parseSummary(data, { money })` drops every `*_pence` key when `money` is false; `fetchSalesSummary(id, { money })`; `useSummary(id, money)` with `money` REQUIRED and its own `'money' | 'counts'` key tail. Callers: TicketsEntry (`canRefund`), GetPaid body and Home tile (`isOwner`). | managerReal: parse test, and `useSummary` through the real `data.ts` with `supabase.rpc` spied: the cache holds no non-zero pence for `money: false`, under `[..., 'counts']`. Roles / getPaid assert the screens pass `money = owner`. |
| F3 extra | Home `TicketsSoldTile` showed `Tickets sold · £gross` to a manager (not in the review). Now the amount is owner-only; a manager sees the count. Without this the counts-only summary would have shown £0.00. | `getPaid.matrix` tile test, manager row. |
| F4 | One order code: `shortRef` (8 letters/digits) lives in `ticketModel.ts`; `buyerFirstAndCode` (list, Refund sheet title, its toast "X's order") reads it; `salesReportModel.ts` re-exports the same function for the CSV. `orderShortCode` (4 chars) deleted. | managerReal "one order code"; `ticketsMoney.matrix` label now `3F2A9C10`. |
| F5 | The ask-the-owner `<p>` is inside `.p3-grow`, under `.p3-row-tags`. | managerReal checks parent and previous sibling. |
| F6 | `SalesReport` `money` is required (no default). | tsc; `salesReport.matrix` passes `money`. |
| F7 | `NOT_MANAGER_STRIPE` deleted (test uses `PAYOUTS_ASK_OWNER`). New `refundReasonMessage`: a ticket-refund `not_authorised` says "Ask the owner to refund this order." (RefundSheet). Ticket-type writes keep `NOT_MANAGER` (owner or manager may change tickets, which is correct there). | tsc; existing refund tests. |

## Checks

- tsc (`npx tsc --noEmit -p .`): 0 errors.
- `npm run check:mojibake`: clean. eslint on touched files: 0 errors (2 old warnings in GetPaid.tsx).
- vitest `src/modules/organiser/p3/tickets`, `src/modules/organiser/tickets`, `src/modules/organiser/p3/screens`: 70 files, 4289 pass.
- `npm run lint` chain and full `npm run test:unit`: see the PR body for this round's result.

## Not verified

- 390x844 browser walk (F5 is a markup move, checked in jsdom only).
- No signed-in manager on prod. Part B: the manager can still refund through `ticket-refund` and still RECEIVES pence in the
  `ticket_sales_summary_v1` response body and from `ticket_orders` by RLS (the client now drops them before caching; it cannot
  stop the server sending them). `buyer_name` (full) is still selected for every role.
- No independent `/code-review` round on this diff (self-review only).

## Next

- Part B (admin repo) must be live and read back on prod before #1520 merges.
- Then a re-review of #1520 and the phone walks 1-9.
