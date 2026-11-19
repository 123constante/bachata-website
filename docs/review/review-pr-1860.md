# Review: PR #1860, R4 cancel refund slice C (hard tier, money UI)

head c1b1f85d0b92cfe4840c1b5cf0315f7c3358db6d
Branch `claude/r4-cancel-refund-c`, 4 commits on top of `e2ccb2c` (main). Read-only review; nothing on the PR branch was changed. Reviewer branch: `claude/review-r4-refund-c` (this doc only). Ticket dt_b0e1dfd568f3.

## Verdict: PASS WITH NITS

## Hard-tier: PASS

Money path holds: the flag gates every new render and read, the server is the only permission authority, one press is one edge call, nothing is ever called refunded without the server saying so, and no table is written from the client.

## Files changed (15, all read)

- `src/lib/featureFlags.ts` -- new flag `organiserCancelRefund` (line 94), default OFF.
- `src/modules/organiser/p3/door/refundData.ts` -- new: summary read, `ticket-refund-night` call, per-order via existing `refundOrder`.
- `src/modules/organiser/p3/r4/R4Night.tsx` -- +7: maps recent cancelled nights to `R4NightRefund` (lines 67, 142).
- `src/modules/organiser/p3/r4/R4NightRefund.tsx` -- new: block + confirm sheet.
- `src/modules/organiser/p3/r4/r4RefundModel.ts` -- new: which nights, copy, block shape, result text.
- `src/modules/organiser/p3/r4/r4.css` -- +2 rules (`.r4-refund-head`).
- `src/modules/organiser/p3/r4/__tests__/r4Refund.matrix.test.tsx` -- new, 28 tests.
- `tests/e2e/walk-r4-cancel-refund.spec.ts` -- new throwaway walk, 3 tests, refund endpoints mocked.
- `scripts/check-e2e-spec-coverage.mjs` -- +1 MANUAL entry (line 98) with the five flags.
- `docs/handover/handover-r4-cancel-refund-c.md` -- new.
- `docs/design/organiser-round4/shots/refund-{night,sheet,partial,manager,not-cancelled}.png` -- 5 new shots (binary).

## Checks (brief items 1-5)

### 1. Flag off renders nothing new -- PASS
- The only mount point is `R4Night.tsx:67` `refundNightsOf(flags.organiserTicketing && flags.organiserCancelRefund, ...)`; `r4RefundModel.ts:37` returns `[]` when off, so `R4Night.tsx:142` maps nothing: no `R4NightRefund`, hence no `useQuery`, no RPC read (the read lives inside the component, `R4NightRefund.tsx:16-21`).
- `refundData.ts` is imported only by `R4NightRefund.tsx`; the 2 css rules are inert without the markup. `featureFlags.ts:94` reads `=== 'true'` so unset = off.
- Test `flag off: no nights, so no block and no refund read` (matrix test). E2E `night not cancelled` asserts zero summary requests (`walk-r4-cancel-refund.spec.ts:73`).

### 2. Owner/admin only, never managers, no client widening -- PASS
- The client never decides: `R4NightRefund.tsx:31-33` draws nothing until the server's summary says `ok` AND `night_cancelled` AND has orders (`r4RefundModel.ts:75`). `not_allowed` parses to a kind that draws nothing (`refundData.ts:30`, `r4RefundModel.ts:75`). No role/seat check anywhere in the PR, so nothing to widen.
- Verified in prod (read-only SELECT of `pg_proc`): `organiser_night_refund_summary_v1(p_event_series_id uuid, p_occurrence_id uuid)` -> `ticket_night_refund_plan_v1(..., auth.uid())`, which returns `not_allowed` unless `_ticket_can_handle_money_v1` is true, and that function is `admin_users` OR seat kind `'owner'` only. Managers and door staff are excluded server-side. Return keys match the parser exactly (`ok`, `reason`, `night_cancelled`, `orders_to_refund`, `pence_to_refund`, `free_orders_to_end`, `orders[].{order_id,first_name,tickets,remaining_pence,refunded,mixed_nights}`).
- Tests: `manager` / `door staff` -> no `r4-refund`, no button at all. E2E `manager / door seat` -> `toHaveCount(0)` (`spec:63`).
- Note (not a finding in this repo): the per-order path reuses the older `ticket-refund` edge fn whose docstring says "Owner / manager only" (`ticketsApi.ts:358`). The UI entry to it is still owner/admin-gated by the summary, so no client widening; the admin side owns whether that function's own gate matches the new rule.

### 3. Amount shown, one call, disabled in flight, every outcome handled, never a false "refunded" -- PASS
- Amount: sheet title `askAll(orders, pence)` / `askOne(order)` from the summary (`R4NightRefund.tsx:104`); walk shot `refund-sheet.png` shows "Refund 3 orders, £57?".
- One call per press: `go()` sets `busy` first (`:46`); the Refund and Keep buttons are `disabled={busy}` (`:108-109`) and the sheet is `locked={busy}` (`:104`) so Close and scrim do nothing in flight (`Sheet.tsx:13,31,35`). Reviewer extra test: three synchronous clicks on Refund -> `invoke` called once, both buttons disabled, Keep does not close the sheet while busy; same for a per-order Refund. (Nit: `go()` relies on `disabled` alone, no `if (busy) return` guard.)
- Expected totals sent (`refundData.ts:63-65`), asserted in the matrix test and the walk (`spec:55`).
- Outcomes (`refundData.ts:60-77` strict `classifyEdge`, `nightDoneOf:79-91`; `R4NightRefund.tsx:38-43,51-67`):
  - 409 `changed`: nothing sent; re-reads; re-asks only with the fresh totals, or closes if the re-read fails (test `409 changed and the re-read fails: does not re-ask with the old numbers`).
  - `failed` with a reason (502 / 200 `ok:false`): sheet stays open with "didn't go through", no `said` text. Reviewer extra: 200 `{ok:false, reason:'not_allowed'}` -> same, body never contains "refunded".
  - No answer (network / relay): "couldn't confirm", sheet closed, summary re-read. Correct: a bare failure may have reached Stripe, so it is not called "nothing changed".
  - `not_configured` only from a body that says so (strict mode), never from a bare 503/404.
  - Partial: counts only `results[].ok === true` (`:86`), names failed orders, keeps Refund all; `free_failed` adds its line and flips the style to error (`nightDoneText`, `r4RefundModel.ts:92-97`).
  - Rows say "Refunded" only from the server's `refunded` flag or `remaining_pence === 0` (`r4RefundModel.ts:85`); an unknown amount keeps its Refund button (test `an order with no readable amount is never called Refunded`).
- After any press: summary refetched and the night-money cache invalidated (`:69-70`).

### 4. Part-used orders and free tickets per the model -- PASS
- Whole order: per-order Refund sends `{ order_id }` only (`refundOneOrder` -> `refundOrder(orderId)` with no opts, `ticketsApi.ts:361-365`), i.e. the whole remainder. A mixed-night order is excluded from the total (server) and gets its own Refund with "Also on other nights. Refund it on its own." and the sheet says "The whole order is refunded." (`r4RefundModel.ts:54`). Part-refunded orders show `remaining_pence` (server `greatest(remaining,0)`), e.g. walk row "Ben, 3 tickets, £21".
- Free tickets: never listed (server lists `total_pence > 0` only; brief: "Free tickets are not listed"); `ticket-refund-night` ends them during Refund all and `free_failed` is surfaced. Test `free-only (or empty) cancelled night draws no block at all`.

### 5. No direct table write; tests; e2e registered -- PASS
- Grep of the three new source files for `.from( .update( .insert( .delete( .upsert(`: none. Writes go only through `supabase.functions.invoke` (`refundData.ts:63`, `ticketsApi.ts:365`). `check-onboarding-write-doors.mjs`: 0 violations (1 pre-existing expected-pending warning). `check-no-legacy-tables.mjs`: pass.
- Spec registered: `scripts/check-e2e-spec-coverage.mjs:98` (MANUAL, WALK, flag list includes `VITE_ENABLE_ORGANISER_CANCEL_REFUND=true`); `check-e2e-spec-coverage.mjs` passes (100 specs). `check-p3-specs-not-skipped.mjs` passes.

## Runs on head c1b1f85 (this sandbox)

| What | Result |
|---|---|
| `vitest run r4Refund.matrix.test.tsx` | 28/28 pass |
| Reviewer extra inputs (7 tests, not committed) | 7/7 pass: double tap all / one = 1 call; 200 `ok:false`; `ok:true` with no results; all-failed results; mixed-only night; negative / float pence rejected |
| `playwright test walk-r4-cancel-refund.spec.ts` (flags on, dev server, 390x844) | 3/3 pass in 27s; shots regenerated byte-identical (`git status` clean) |
| `node scripts/check-e2e-spec-coverage.mjs` | OK |
| `node scripts/check-onboarding-write-doors.mjs` | 0 violations |
| `node scripts/check-no-legacy-tables.mjs` | pass |
| `node scripts/check-p3-specs-not-skipped.mjs` | pass |
| `npx tsc --noEmit -p .` | 0 errors (whole repo) |
| `npm run check:no-social-word` | 3 violations, all in files NOT in this PR (pre-existing on main, as the handover says) |

## Nits (none blocks; owner's call whether any goes in before merge)

1. **Free-only cancelled night cannot end its free tickets from this screen.** `refundBlockOf` returns null when `orders` is empty (`r4RefundModel.ts:75`) even if `free_orders_to_end > 0`, so there is no Refund all to press and `ticket-refund-night` never runs for that night. Consistent with the brief's "free tickets are not listed", but worth a decision: show a "N free tickets to close" line with the button, or document that free-only nights are closed elsewhere.
2. **Contradictory copy on a mixed-only night.** When every open order is mixed-night, `orders_to_refund` is 0 so the line says "Nothing left to refund." while rows below still show an amount and a Refund button (reviewer test `mixed-only night`). Suggest a third line, e.g. "Refund these one by one." when `ordersToRefund === 0` but some row `canRefund`.
3. **`{ok:true}` with no `results` and no `refunded_count`** reads as a green "0 orders refunded." (`refundData.ts:86`, `nightDoneText`). Not a false claim, but a success style for an answer that said nothing; a neutral "Done. Check the list." would be safer.
4. `go()` has no `if (busy) return` guard (`R4NightRefund.tsx:44-46`); correctness rests on `disabled` + `locked`, which the extra tests confirm. One line would make it belt and braces.
5. Brief deviation, judged correct: the brief asked to hide the door list on a cancelled night; the builder left it because `R4Night.tsx:64,144` already hide `R4GuestList` when the NEXT night is cancelled, and when a later/past night is cancelled the door list is for a scheduled night. Agree.
6. Gap the builder listed, allowed by brief item 3: the Refunded chip in the guest list is not shipped (`ticket_door_list_v3` rows carry no order id). Needs admin.
7. Nights cancelled more than 28 days back get no block (`REFUND_LOOKBACK_DAYS`, `r4RefundModel.ts:13`); fine for the model, but a night cancelled late and forgotten past 28 days has no UI path.

## Verified
- Whole diff read, every changed file named above.
- Backend contract in prod (read-only SELECT): RPC name, parameter names, return keys, and the owner-or-admin gate.
- `ticket-refund-night` edge function exists and is ACTIVE in prod (v1); its request body shape is checked against the brief and the mocked walk only, not against its source (admin repo, out of scope).
- Unit tests, the walk at 390x844 with prod-shaped mocked data (5 order shapes), the guard scripts and tsc, all on head c1b1f85 in this sandbox.
- tsc run on c1b1f85: 0 errors in branch files (0 in the whole repo).

## Not verified
- No live press of Refund all against the real edge function (correctly mocked everywhere; no prod order sits on a cancelled night today per the builder).
- PR #1860 CI check results on GitHub (gh unavailable in this sandbox; not polled).
- Flag-on Vercel preview walk (needs the env var on the preview).
