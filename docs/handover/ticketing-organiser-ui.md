# Handover: organiser ticketing screens (Website), PR #1060

> **Retired 2026-10-30 (T6).** The `/account/tickets` screens below were deleted once the P3 walk passed. That path is now only a redirect to P3 (`src/modules/organiser/tickets/legacyRedirect.ts`): Stripe returns go to You > Get paid with `o` and `stripe` kept; an event screen goes to its P3 event page. `ticketModel.ts` and `ticketsApi.ts` stay; P3 uses them.

Branch `claude/ticketing-organiser-ui`. Flag `organiserTicketing` stays OFF.
Journey map and first shape survey: [`docs/organiser-ticketing-journey.md`](../organiser-ticketing-journey.md).
Design record (S3b): [`docs/design/1060.md`](../design/1060.md).

## S3b critique fixes (brief `briefs/ticketing-organiser-ui-fixes.md`, blob de6fb45; ticket dt_1ddc6e8c89ca)

Critique: `docs/review/ticketing-organiser-ui-1060.md` on branch `claude/ticketing-organiser-ui-critique`.
**These fixes are unreviewed code** (no `/code-review` round has run on them).

### Done (each red-first: the new tests ran on the unfixed code first, 65 failed)
1. BLOCKING, profile switcher: `TicketsHome` no longer passes `topBarEnd`, so the shell keeps the
   profile switcher in every state. The "Paid out via Stripe" chip sits on the page-name line
   (`tix-page-line`, name left, chip right). Test: switcher present for stripe none / started / connected.
2. `eventLeftLine` counts only `on_sale` and `sold_out` types; with none it returns null, so only the chip shows.
   The critic's mixed shape (on sale + paused + draft gives "8 left of 20") and a sold out + on sale + paused shape are in
   `compact.model.test.ts`. Draft-only and paused-only now show the chip alone (two old rows changed).
3. Thousands separators in the ONE helper: `formatPence` uses `toLocaleString('en-GB', {min/max 2 decimals})`;
   new `formatCount` for Sold, waiting / disputed counts and the event "N left of M" line. `poundsText`
   (the price input's value) is unchanged, so a form never gets a comma.
4. Payments link: `paymentsLink(role, stripe, step)` in `ticketModel.ts` decides; `PaymentsLink` in `parts.tsx`
   renders one line under the number cards ("Payments not connected. Connect" / "Finish connecting") when a
   manager is not connected and the Next step card is not `connect`. `go()` was moved out of `NextStepCard` into
   `useStartOnboarding`, which both use (same not-switched-on and error words). Tests: role x stripe x
   (all free, mixed, none) in the model, and owner/contributor x stripe x mix on the screen, plus the click
   (return/refresh URLs, error note, not switched on).
5. An edit sheet shows "Save changes" (primary) with "Continue" (ghost) on steps 1 and 2, so raising places takes
   two taps instead of four. A new ticket still has only Continue before the review. The switch's `aria-describedby` is now set only when its
   reason is rendered under the row. The role reason is shown once at the top, so the switch no longer points at a missing id.
6. Coverage the critic listed: Close sales for good confirm (Keep selling backs out, Close sales sends `closed`),
   back-from-Stripe notes (`?stripe=return|refresh`), orders empty-state words (selling / nothing selling).

### Verified / Not verified (critique fixes)
Verified:
- Unit: tickets suite + focusReturn: 1170 pass (6 files).
- `npm run lint`: 21 of 22 links green. `check:integrity` exits 126 here only because the exec bit is not set in this checkout. Run with
  `bash bin/check-integrity.sh` it passes (2652 files, 0 issues), and CI runs chmod first. eslint on tickets/: 0 errors (6 old warnings).
- `npx tsc --noEmit -p tsconfig.app.json`: 113 errors, the same count as main, none in tickets/.
- architecture-guard steps: `AUDIT_STRICT=1 check:images`, plan-hygiene self-test: pass.
- perf-budget: build, bundle-budget, first-load-requests, chunk-cycles (+ self-tests): pass.
- e2e-smoke (`test:e2e`): 153 pass, 8 skipped, 4 failed on first run (account-settings x2, dancer home-nights,
  organiser-onboarding sign-in link, all cold first-load timeouts in areas this diff does not touch). Re-run alone: 24/24 pass.
- phone-qa (`playwright.phone.config.ts`): the full 534-test run did not finish inside the 10-minute local limit. The
  organiser contact-sheet / hero specs that failed under that load pass when run alone (20/20). No phone spec covers tickets.
- Full `test:unit`: 16391 pass and 15 fail. These are the same 15 as main (integrityCouldNotRun x5, live event contract tests x10).
- Browser walk at 390x844 (dev server with the flag env vars on, the phone suite's fake Supabase, and ticket rows shaped like the live RPCs). There
  were 6 states, all PASS: page and sheet scrollWidth 390, no tap under 44x44, sticky footers end at 844, 0 page errors. Screenshots
  `11`..`16` are in `docs/handover/ticketing-organiser-ui/`:
  - Connected Home: the profile switcher is at the top right (44x44), and the chip is on the page-name line, right-aligned.
  - Free tickets with Stripe started: "Finish connecting" under the cards. With no Stripe: "Payments not connected. Connect".
  - Mixed event: "8 left of 20". Edit step 2: Save changes plus Continue. Big numbers: "2,022" and the gross in pounds with commas, with no clipping.

Not verified:
- The full phone-qa run and the phone build config (`playwright.build.config.ts`) locally: left to CI.
- Everything in the S3b "Not verified" list below still holds (real Stripe, real RLS logins, desktop, prod-DB contract steps).
- Code review of these fixes.

## S3b redesign (brief `briefs/ticketing-organiser-redesign.md`, blob b5e3618; ticket dt_57ce27a0ca93)

Owner picked mockup **B, Compact** (<https://claude.ai/artifact/7NicJi37hDk21cUSG239ZD>). Presentation and
flow changed; every S3 rule kept (roles, locked price, untouched save sends nothing, error states,
Stripe not set up / not switched on, whole-order refund).

### Done
- `ticketModel.ts`: new shared helpers, each the one source for its fact: `buyerTotal` (ticket + 50p =
  total; free = "Free, no fee"), `paidOf` / `formPence`, `leftOf` / `countsLine`, `SWITCH_LABEL` /
  `switchMove`, `eventSaleOf` / `EVENT_SALE` / `eventLeftLine`, `setupSteps` / `setupLine`, `nextStep`,
  `dayWord` / `orderLine` (full month names, area rule G1), `STEP_FIELDS` / `stepErrors`, `eventStartOf`,
  `reviewRows`, `buyerNameOf`; `refundQuestion` now returns the brief's words plus the confirm label;
  `STRIPE_COPY` rewritten for the Next step card.
- `ticketsApi.ts`: `writeResult` also keeps the new ticket's id from `ticket_type_upsert_v1`'s existing
  `ticket_type` echo (no RPC or edge contract change).
- Screens: `TicketsHome` (Next step card, setup bar, Sold / Sales, compact event cards with Add tickets,
  "Paid out via Stripe" chip), `SeriesTickets` (ticket rows with the Selling switch, orders by buyer name,
  `?add=1` opens the add sheet), `TypeSheet` (three steps: name + price with live Buyer pays; places and
  sales window chips; review with sticky Put on sale / Save as draft; edits reuse it, Close sales for
  good with a confirm on the review step), `RefundSheet` (brief copy, destructive Refund &pound;N).
  `parts.tsx` holds `NextStepCard`, `SetupBar`, `NumberCards`, `EventCard`, `SellingSwitch`.
- Tests: `screens.matrix.test.tsx` rewritten (64: every screen x 12 shapes + flows),
  `compact.model.test.ts` new, `ticketModel.matrix.test.ts` copy updated. focusReturn list unchanged (no
  new sheet files; both sheets keep `returnFocusRef`).

### Notes for the orchestrator / data owner
1. Buyer name: `ticket_orders.buyer_name` exists (nullable) and is already read; a null shows "Buyer".
   Nothing needed unless checkout does not fill it.
2. Manual "Mark sold out" is no longer offered (sold out happens at capacity). Say if it should come back.
3. "Event start" as the close default is offered only for one-offs (a series has no single start).
4. The S3 notes still hold: edge-function contracts ASSUMED (`stripe-connect-onboard`, `ticket-refund`);
   `organiser_home_v1` never returns `contributor`; no `orders_expired` count; `types.ts` lacks ticketing.

### Left / next steps
- Code review (two rounds for user-facing changes) was NOT run in this session: no reviewer here.
- Flip the flag on a preview for the owner's phone test.
- Entry link to `/account/tickets` from the organiser area (still deliberately absent while the flag is off).
- Partial refunds and a per-date ticket picker remain out of scope.

### Verified / Not verified (S3b)
Verified:
- Shape survey on prod (read-only, counts): 0 ticket_types, 0 ticket_orders (0 without buyer_name),
  0 organiser_stripe_accounts; 69 live series, 11 one-offs. Upsert RPC returns the row (id) read live.
- Unit: tickets suite + focusReturn + organiser module 5814 pass. Full `test:unit`: 16242 pass, 15 fail,
  the same 15 the S3 handover recorded on main (integrityCouldNotRun x5, live event contract tests x10).
- Mutation: two planted bugs each turned the screen matrix red.
- Lint chain: every link green except `check:integrity` exit 126 (exec bit in this checkout; the script
  itself passes when run with bash; CI chmods). eslint on the module: 0 errors.
- typecheck: same error count as main (113), none in the ticketing files. Build pass; bundle budget,
  first-load requests, chunk cycles pass (TicketRoutes stays a lazy chunk).
- Browser walk 390x844 and 360x640 (fake Supabase + ticket rows shaped like the live RPCs): 10 screens,
  no sideways scroll, no control under 44px in the area, no page errors. Screenshots (390) in
  `docs/handover/ticketing-organiser-ui/` (taken before the full-month-name fix: "20 Oct" there).

Not verified:
- Real Stripe onboarding, real refunds, real checkout (edge functions not deployed; contracts assumed).
- Real Supabase auth and RLS reads with a real organiser login; a contributor login.
- `check:doc-weight` (needs a live preview; the workflow skips `claude/` branches) and the prod-DB contract
  steps of db-contract-check.
- Desktop widths. Light theme (the organiser area is dark only).
- Code review rounds.

## S3 (first build) history
S3 built the four plain screens, the wire and the model (commits aab1501..135b5fb); its review round 1
(10 findings) was fixed in 82d8355. Details of that round live in git history.

## Review round 2 fixes (N1 + N2, brief `docs/briefs/1060-n1.md`)
Source: `docs/review/ticketing-organiser-ui-1060-r2.md` (branch `claude/review-1060-r2`).

Done:
- N1, one count format on every screen. `countsLine` (the One event row), the capacity error in
  `validateForm` and `reviewRows` Places all go through `formatCount`. Dead `soldLine` / `takenLine`
  removed. `screens.matrix.test.tsx` row expectation now builds from `formatCount`.
- Red first: new test "One event + edit sheet: the same counts carry the same separators" (3,000 places,
  2,022 sold) failed on 5dd9e40: expected "&pound;10.00 &middot; 2022 sold &middot; 978 left" to contain "2,022 sold &middot; 978 left".
- N2 tests: "Save changes from step 1 with a step-2 error jumps to step 2" and "a double tap on the
  payments link starts Stripe onboarding once".
- Mutation (each reverted alone, then restored; ticketing suite, 1,161 tests): countsLine raw, capacity
  error raw, review Places raw each turn the separators test red (1 red each); removing the jump line in
  `TypeSheet.submit` (M7) reds the step-2 test; removing `disabled={busy}` on the payments link (M8) reds
  the double-tap test.
- No copy, layout or other behaviour changed. Edge functions untouched.

Left / next:
- Code review of this round (fixes to findings are unreviewed code).
- The review's third N2 bullet (payments link above "No live events yet") still has no test either way;
  the brief did not ask for one.
