# #1520 fix round 1: manager copy was dead in production, tests used owner fixtures

Brief-version: 1
Repo: Website. Branch `claude/organiser-area-v2-tickets` (PR #1520, head 7debc56; push onto it, no new PR). Lane: careful (money display + roles). Opus builds. ONE push. Independent review verdict HOLD: `docs/reviews/1520-r1.md` on branch `claude/review-organiser-tickets-1520`. Read it first; it has file:line, proof and fix for each finding. Part B (admin, server-side refusal) is a separate PR and is NOT yours.

## Do (red test first)
1. F1 blocker: a manager's read is counts-only so `totalPence` is 0 and `refundable(o)` is false: the "Ask the owner to refund this order." note (TicketsEntry.tsx ~:298) and the legacy note (~:334) never render. Gate them on status alone (`refundableByStatus`, status === 'paid'); the owner's button keeps `refundable`. Make the roles test honest: build non-owner rows through `parseOrderRow` from count-shaped rows (or strip pence in the `useSeriesOrders` mock when `money` is false) so fixtures match the real read. Confirm the old test shape fails first.
2. F2: in the manager and contributor rows of getPaid and roles tests assert `tix-money`, `tix-setup`, `tix-money-error`, `tix-money-refused` are absent, with a summary that carries sales (SHAPES.selling) so the block WOULD render for an owner; confirm removing `owner &&` at GetPaid.tsx ~:194 now fails.
3. F3: add to the PR body NOT verified that the client still calls `ticket_sales_summary_v1` for a manager (pence in the response body and cache) until Part B; add a client-side defence: a manager's summary parse drops all `*_pence` fields before caching, with a test.
4. F4: use the single `shortRef` mapping (8 chars) for the order label in the list, refund sheet and toast; one mapping, tested.
5. F5: render the ask-the-owner note inside `.p3-grow` under the tags (not a flex sibling) so it does not squeeze the buyer column at 390. F6: make `SalesReport` `money` required. F7: delete dead `NOT_MANAGER_STRIPE`; check the `not_authorised` copy says owner-only consistently.
6. Update the PR body Verified / Not verified. Keep flags off = no change.

## Files
src/modules/organiser/p3/tickets/__tests__/tickets.managerReal.matrix.test.tsx
docs/handover/organiser-area-v2-tickets-fix1.md

Existing files you edit: `src/modules/organiser/p3/tickets/TicketsEntry.tsx`, `GetPaid.tsx`, `ticketModel.ts`, `ticketsApi.ts`, `SalesReport.tsx`, `salesReportModel.ts` (only if needed for shortRef), `src/modules/organiser/p3/tickets/__tests__/tickets.roles.matrix.test.tsx`, `getPaid.matrix.test.tsx`, `harness.tsx`, `fixtures.ts`.
