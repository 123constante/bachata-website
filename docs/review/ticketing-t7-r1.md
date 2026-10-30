# T7 review r1: P3 ticketing fix-1 and fix-2, fix-3 open items, bundle, phone-qa

Read-only review. Brief `docs/briefs/ticketing-t7-review.md` (branch `brief/ticketing-t7-review`).
Reviewed `main` at `a1d0fa6`, folder `src/modules/organiser/p3/tickets/` (fix-1 and fix-2 landed
squashed in #1079 `4d7b57b`, fix-3 in #1106 `c17277b`), plus the shared
`src/modules/organiser/tickets/ticketsApi.ts` / `ticketModel.ts` paths they call.
No source edited. Supabase: one SELECT (counts only) and one edge-function body read.

Severity scale: **blocks go-live** / **fix before go-live** / **nit**.
CONFIRMED = traced through code (and server body where named); PLAUSIBLE = path is real but not run.

## Summary

No finding blocks go-live. No path found where a refund is double-charged, sent for the wrong
order, or shown as done when the server refused: the client shows "done" only on `kind === 'ok'`,
and the server (`ticket-refund`) refuses any order whose status is not `paid` and uses the Stripe
idempotency key `refund-<order id>`. Two money-path findings are about WORDS (the organiser is told
the wrong thing), not money. All fix-3 open items still reproduce on `main`. Bundle is green with
0.2 KB headroom. phone-qa's timeout is a fixed 25-minute job budget around install + a full
two-viewport dev-server suite.

## Findings (most severe first)

### 1. Stripe refund succeeds, DB mark fails: the organiser is told it "did not start" -- fix before go-live (admin repo), PLAUSIBLE
- Where: server `supabase/functions/_shared/ticketingHandlers.ts` `handleTicketRefund` (deployed body,
  read today): `stripePost('/v1/refunds', ...)` succeeds, then `await deps.rpc('ticket_order_mark_refunded_v1', ...)`;
  if that RPC throws, the outer `catch` returns `500 internal_error`. Website side:
  `RefundSheet.tsx:53-56` maps it through `p3Reason` to "That did not work. Try again in a moment."
  (`ticketModel.ts:404-405`, no entry for `internal_error`).
- Failing input: a paid order, Stripe refund 200, the mark RPC times out. The buyer has been refunded;
  the sheet says it did not work; the row still reads Paid with Refund enabled.
- Money effect: none extra. A retry reuses idempotency key `refund-<id>` (Stripe returns the same
  refund) and then marks the order; the `charge.refunded` webhook path also marks it. So this is a
  wrong-words state, not a double refund.
- Fix belongs in admin (`bachata-admin-11april`): after a successful Stripe refund, a mark failure
  should still answer `ok: true` (or a distinct `refunded_pending_mark`), and the webhook reconciles.

### 2. Between "Refund started" and the refetch, the same order's Refund button is live again -- fix before go-live, CONFIRMED
- Where: `RefundSheet.tsx:47-48` calls `onSettled()` (clears `inFlight`, `TicketsEntry.tsx:361`) BEFORE
  `onDone` (`TicketsEntry.tsx:362-366`), which only then starts `refresh()`. Until the orders refetch
  lands, `orders.data` still holds the order as `paid`, so `refundable(o)` is true
  (`TicketsEntry.tsx:193`) and the button reads "Refund", enabled (`inFlight` no longer has it).
  If the refetch FAILS (phone loses signal right after the refund), `orders` keeps the stale data
  and the button stays live until a later successful fetch.
- Failing input: organiser refunds order A on a slow connection; taps Refund on A again before the
  list updates; confirms. Server answers `409 not_refundable` (status is now `refunded`), which reads
  in the sheet as "That did not work. Try again in a moment." -- wrong words, and it invites a third
  try. Same window on the late path (`late` -> `refresh`, `TicketsEntry.tsx:140-141`).
- Money effect: none (server status check + idempotency key). Words: wrong.
- Smallest fix: keep the order id locked after `ok` until the refetch shows it non-refundable
  (e.g. a `refundedIds` set, or `onSettled` only on failure), and give `not_refundable` its own words
  ("This order is already refunded. Pull to refresh.").

### 3. Late "Close sales" toast names an UNSAVED typed name -- fix before go-live (low), CONFIRMED
- Where: `TypeSheet.tsx:68` `named` = `form.name.trim() || type?.name`; used by the late success
  of `closeForGood` (`TypeSheet.tsx:141`, third argument `named('sales closed.')`) and by its late
  refusals (`TypeSheet.tsx:142,144` via `refuse(..., 'sales not closed.')`). `closeForGood` sends
  only `setTicketStatus(type.id, 'closed')`; it never saves the form, so the name typed in step 1 is
  NOT what the list shows.
- Failing input: edit "Door", change the name to "Door late" (do not save), go to step 3, Close
  sales for good, Close the sheet while "Closing..." -> toast `"Door late": sales closed.` while the
  list still shows "Door" (now Closed). Note the in-sheet success already uses `type.name`
  (`TypeSheet.tsx:141` first argument), so the two paths disagree.
- This is N1's expression reaching a path N1 did not consider. Fix: close paths name `type.name`;
  only a LANDED save names `form.name`.

### 4. N1 (fix-3 open item): a late REFUSED rename names the typed name -- still on main, fix before go-live (low), CONFIRMED
- Where: `TypeSheet.tsx:68` + `TypeSheet.tsx:70` (`refuse` -> `onLate(named(...), false)`), reached from
  `TypeSheet.tsx:119` and `:129`.
- Failing input: rename "Door" -> "Door 2", Save, close mid-save, server refuses (e.g. `closed`) ->
  alert `"Door 2": not saved. Sales are closed...` while the list shows "Door". Fix: refusals name
  `type?.name ?? form.name.trim() || 'New ticket'` (the name the list shows), landings keep N1's order.

### 5. Toasts sit over the tall sheet's Close -- still on main, fix before go-live, CONFIRMED (CSS) / PLAUSIBLE (tap capture)
- Where: `src/modules/organiser/p3/theme/p3.css:330` moves `.p3-toast-stack` to
  `top: calc(var(--top-h) + 12px + safe-area)` = y 68 at 390x844 (`--top-h: 56px`, `p3.css:25`), and
  `p3.css:287` gives it `z-index: 90`, above every sheet scrim (`p3.css:175`, z 70). fix-3's handover
  measured the tall sheet's Close at y 35-79, so a toast covers the bottom ~11 px of Close, and the
  column (`max-height: 40dvh`, `p3.css:288`) covers the top of an add sheet's body.
- Failing input: one late refusal alert (never auto-dismisses, `TicketsEntry.tsx:393`) on screen; tap
  the lower part of the tall sheet's Close -> the tap lands on the alert, not Close. Not a money control.
- Fix (design call): offset the column below the sheet head (`top` past the stack head), or reserve
  that band in the sheet when alerts exist.

### 6. R6 (fix-2 / fix-3 open item): toast column outside the aria-modal dialog -- still on main, owner call, CONFIRMED
- Where: `TicketsEntry.tsx:369-380` renders `.p3-toast-stack` after the sheets, outside their
  `aria-modal="true"` dialogs (`StackSheet.tsx:115`). It is not made inert (only scrims are,
  `StackSheet.tsx:57,75`), so Tab reaches Dismiss; a screen reader that confines browse mode to the
  modal hears the live region but reaches Dismiss only after the sheet closes. Documented choice in the
  comment; unchanged. Owner call still open.

### 7. Price unlocks when BOTH sales and orders reads fail -- nit, CONFIRMED (server-guarded)
- Where: `TicketsEntry.tsx:332-333`: `checking` is `summary.isPending || orders.isPending`; on error
  both are false, so `hasOrdersOf` (`model.ts:162-166`) sees an empty sales map and no orders and
  returns false unless `t.reserved > 0`. The price field unlocks for a type that has orders.
- Failing input: type with refunded-only orders (`reserved` 0), summary and orders reads both error ->
  price editable; Save -> server refuses `has_orders` ("The price cannot change once someone has
  bought a ticket.") Money-safe; words arrive late. Fix: treat a read error as "checking" (keep locked
  with "Could not check sales").

## Fix-1 and fix-2 handover claims vs code (main)

| Claim | True on main? | Evidence |
|---|---|---|
| F1/F2: late save/refund goes through one `late(text, landed)`; never touches `editing`/`draft`/`refunding` | Yes | `TicketsEntry.tsx:133-142` |
| F3: late refusal is `role="alert"`, never auto-dismisses, 44px Dismiss | Yes (Dismiss `min-height: var(--tap)` from `.p3-link`; width is the word plus `padding: 0 12px`, over 44 px, with no `min-width`) | `TicketsEntry.tsx:391-401`, `p3.css:116,205` |
| F4: switch success clears only its own row's error | Yes | `TicketsEntry.tsx:151-163` (`with_` keys on `t.id`) |
| F5: price waits with "Checking sales..." | Yes, except finding 7 | `TypeSheet.tsx:248,253`, `TicketsEntry.tsx:333` |
| F6: Escape inside "Close sales for good?" = Keep selling | Yes when not busy; busy changed by fix-3 N2 (closes the layer) | `TypeSheet.tsx:216` |
| R1/R2: status slot + alert queue; status never clears an alert; two refusals both stay | Yes | `TicketsEntry.tsx:94-99,133-140,375-379` |
| R2: late texts name their subject | Yes for refunds (`RefundSheet.tsx:51-54`); for tickets the name is the TYPED name (fix-3 N1), see findings 3, 4 | `TypeSheet.tsx:68` |
| R2: "Ticket subject = the saved type's name (a new ticket: its typed name)" | **No longer true**: fix-3 N1 changed it to typed name first | `TypeSheet.tsx:68` |
| R7: each toast keyed (`alert-<id>`, `status-<id>`), same words restart 8 s | Yes | `TicketsEntry.tsx:97,377-378,392-396` |
| R4: `onSaved` clears only the saved type's reason; late save clears its own row | Yes | `TicketsEntry.tsx:340-349`, `TypeSheet.tsx:76` |
| R5: Escape mid-close keeps "Closing..."; Keep selling disabled while busy | Superseded by N2 (Escape mid-close now closes the layer); Keep selling disabled: yes | `TypeSheet.tsx:216,324` |
| From in-session review: partial "Put on sale" (saved, on-sale refused) is an alert | Yes | `TypeSheet.tsx:127` (`whole=false` -> `landed=false` -> alert) |
| Toast column capped at 40dvh and scrolls | Yes | `p3.css:288` |
| Refund in flight locks that order's Refund ("Refunding...") | Yes while in flight; unlocks before the refetch (finding 2) | `TicketsEntry.tsx:193-203`, `RefundSheet.tsx:46-48` |
| Add closed mid-save drops its draft (no second save) | Yes | `TicketsEntry.tsx:334-338`, `TypeSheet.tsx:213` |

## Money and refund paths: states x shapes

Client shows "done" only on `out.kind === 'ok'` (`RefundSheet.tsx:52`); `invokeEdge` never throws
(`ticketsApi.ts:220-234`), so `onSettled` always runs and `inFlight` never sticks. Server
(`handleTicketRefund`): owner/manager check, `status === 'paid'` + PI + account required, Stripe
idempotency key `refund-<id>`, then marks refunded before answering 200.

| Shape | Refund button | Double submit | Wrong order | Shown done when refused |
|---|---|---|---|---|
| Paid, money left | Shown (manager) | In sheet: disabled while busy (`RefundSheet.tsx:65`). Closed + reopened: locked by `inFlight`. After success: live until refetch (finding 2), server 409s | No: sheet carries the `Order` it opened with; late words name it (`:51`) | No (`kind === 'ok'` only). Reverse case possible (finding 1) |
| Paid, free (total 0) | Hidden (`refundable`: amount 0) | n/a | n/a | n/a |
| Unpaid (pending / expired) | Row not shown (`SHOWN_ORDER`) | n/a | n/a | n/a |
| Refunded | Hidden (status) | Server 409 if reached via stale row | n/a | No |
| Disputed | Hidden (status) | n/a | n/a | n/a |
| Partially refunded, still `paid` | Shown with remaining amount (`refundAmount`) | as Paid | No | No |
| Zero ticket types / zero orders | No rows; empty text says what to do (`model.ts:106-111`) | n/a | n/a | n/a |
| 100+ orders | `fetchOrders` pages with `range` (`ticketsApi.ts:146-156`); "See all N orders"; every row keyed by order id | as Paid | No | No |

Prod shape today (SELECT, counts only): `ticket_orders` = 3 `refunded` (none free, none partial, all
named, max quantity 1) and 1 `paid` (free, quantity 3). So the only live paid order has no Refund
button, and no prod row exercises the paid-with-money or 100+ shapes; those rows are traced, not run.

## Bundle re-measure

Command (perf-budget.yml env, on `main` `a1d0fa6`, after `npm ci` -- the container's stale
`node_modules` lacked `jsqr` and the first build failed on it):

```bash
VITE_SUPABASE_URL=https://stsdtacfauprzrdebmzg.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=<perf-budget.yml placeholder> npm run build && npm run check:bundle-budget
```

Result: `[ok] dancer-app (/app/*, lazy chunk via catchall): 373.8 KB first-load JS across 49 files
(budget 374 KB)`; exit 0, "All first-load JS budgets respected"; chunk ratchet 49/49. No
`p3/tickets` module appears in the /app first-load report. (event 377.2/381, auth 295.7/310,
home 209.2/215.)

Verdict: the overage item is **resolved** (green on main), but with **0.2 KB headroom** (fix-3 read
373.7; today 373.8). The allowance **cannot be lowered**: 374 is already the measured value rounded
up, and lowering it reds main. Next feature touching a shared chunk will trip it; that is the
file's intended posture, not a defect.

## phone-qa 25-minute timeout (from the workflow files)

- `.github/workflows/phone-qa.yml:64`: `timeout-minutes: 25` for the WHOLE `phone-qa` job, which
  includes `npm ci` (`:80`), `npx playwright install --with-deps chromium` (`:83`, apt deps every run,
  no cache step) and the suite (`:91`).
- `playwright.phone.config.ts`: every spec in `tests/e2e-phone/` (27 files) runs in TWO projects
  (`phone-390x844`, `phone-360x640`, lines 71-73), on `workers: 2` in CI (line 40), with
  `retries: 1` in CI (line 42) and a 90 s per-test timeout (line 37), against a Vite DEV server
  (`npm run dev`, line 51, `reuseExistingServer: false`) that transforms lazy chunks on first request.
- So the runtime is (spec count x 2 viewports) / 2 workers on a cold dev server, plus install, plus
  up to one retry per failing test (each up to 90 s). The fix-1 handover's local run was 14.3 min for
  the suite alone with 2 workers; install + browser deps + any retry wave pushes the job past 25.
  `concurrency` (`:58-59`) cancels in-progress runs on a new push to the same PR, a second, separate
  source of "cancelled".
- Levers (owner call, not done): shard the job by project (a matrix of the two viewports), raise
  `timeout-minutes`, cache Playwright browsers, or run the suite against the built server instead of
  `npm run dev`.

## Where open PR #1165 (`claude/tickets-retire-old-screens`) changes the answer

Its diff to this folder is mechanical: `p3Reason` -> `reasonMessage` and `p3MoveBlock` -> `moveBlock`
(the copy swap moves into `ticketModel.ts`), in `TicketsEntry.tsx`, `TypeSheet.tsx`,
`RefundSheet.tsx`, `model.ts`. It touches none of the refund ordering, `late`, `named`, the toast
render or the CSS. **No finding above changes** with #1165; only the line numbers shift by a few.

## Not reviewed

- No test was run (unit or e2e); claims of "red on unfixed code" in the handovers are not re-checked.
- No browser walk; finding 5's tap capture and finding 2's window are traced, not observed.
- A real Stripe refund (none possible read-only); `ticket_order_mark_refunded_v1` body not read.
- `GetPaid.tsx` and `data.ts` read only where the paths above call them (no findings sought there).
- `StackSheet.tsx` focus/inert logic beyond the lines cited.
- Secrets (`TICKET_BOOKING_FEE_PENCE` etc.) cannot be read.
