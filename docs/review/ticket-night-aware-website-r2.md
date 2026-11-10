# Review round 2: S1a Website fix round 1 (PR #1523, `claude/ticket-night-aware-website`)

Reviewed head: `e015802aed1eeaff4095f7d45e94b008dcd67164` against `main` (merge-base `4bebd94`).
Fix-round diff reviewed: `7532b82..e015802a` (one commit). Round-1 report: `docs/review/ticket-night-aware-website.md`
on `claude/review-ticket-night-aware-website`. Fix brief: `docs/briefs/ticket-night-aware-website-fix1.md` on
`brief/ticket-night-aware-website`. This brief: `docs/briefs/review-ticket-night-aware-website-r2.md` (sha 913b262).
Reviewer: zero-context cloud worker, ticket dt_6488ebad23ab. Read-only on prod (counts only); no source edited.

## Verdict: FIX (one small UI item), plus notes

The three round-1 items are fixed and the fixes are covered by tests that fail under the mutants. One new
defect found by reading the layout (FIX-4, a few lines). One finding about the festival page that is
pre-existing on `main` and not a regression, but it contradicts the PR body and the design record (N6).

### FIX-4 (UI, small): in the no-night state the night list ends under the fixed quiet bar
- Where: `src/modules/tickets/TicketsBlock.tsx:313-337` (quiet bar and its 84px spacer), `:356` (the list),
  `src/modules/tickets/EventTicketsPage.tsx:158` (`pb-8`, the only clearance after the list).
- Failing input: a weekly page with no night on screen (`remaining` NULL, the `needs_night` shape of
  `nightControls.matrix.test.tsx` "weekly, no night on screen"). `quiet` is set (quiet bar "Choose a night"),
  `showNights` is true, no form renders.
- Wrong output: the block renders, in order, the ticket rows, the FIXED quiet bar (`z-[60]`, about 72px plus
  the safe-area inset), an 84px in-flow spacer, and only then the heading and 8 rows of 48px. The spacer
  that exists to clear the fixed bar sits ABOVE the list, so (a) there is an 84px blank gap between the rows
  and "Choose a night to buy tickets", and (b) the list is the last thing in the scroll content with only 32px
  below it, so at scroll end the 8th row (and on a phone with a home indicator, part of the 7th) is covered by
  the bar and cannot be tapped. The quiet bar's own "Choose a night" scrolls the list to `block: 'start'`,
  which does not help the last row.
- Fix: render the spacer after the last in-flow element (move the `h-[84px]` div to the end of the block, or
  add `pb-[84px]` to the list container when `quiet` is set). jsdom cannot see this; note it as a browser-walk
  item in the PR body.
- Reachability: `needs_night` needs `occurrenceId ?? snapshot?.occurrenceId` to be null while the series is
  not over. The snapshot resolves a next night for both weekly sellers today, so this state is rare in prod;
  the PR's own tests, design record and the sticky bar treat it as real, so it should render correctly.

## Checks, in the brief's order

### 1. FIX-1: every night control reaches a real night row or a real navigation: PASS on the weekly page
- Sticky bar "Choose a night" (`EventStickyActionBar.tsx:217-233`) now calls `onOpenTickets`, which BentoPage
  always passes together with `inSiteTicketing` (`BentoPage.tsx:889-890`). The Tickets page renders
  `TicketsBlock` with `nights={nightOptions(snapshot.occurrences, occurrenceId, now)}`
  (`EventTicketsPage.tsx:130,177`), and the block renders `NightPicker` whenever `needsNight && buyable.length
  === 0` or a `pick_night` refusal is on screen (`TicketsBlock.tsx:197,356`). The block's quiet-bar button and
  the refusal's "Choose another night" both call `scrollToNights`, which targets `#tickets-nights`, an element
  the same component renders in those exact states (`NightPicker.tsx:62-66`). No control points at
  `[data-block-id="dates"]` any more (grep: zero hits outside the test asserting its absence).
- Nights listed (`nightOptions`, `NightPicker.tsx:43-57`): `isCancelled` and `isPast` dropped, London date
  `>= today`, the night on screen left out, soonest first, capped at 8, label from `longDate` (full weekday and
  month from fixed tables, ICU-free), time from `wallClockTimeKey` unless untimed or a bare date. Tested per
  shape in `nightControls.matrix.test.tsx:70-100`.
- Copy matches the screen: the five refusals end "See the other nights below." (`night_required`: "See the
  nights below."), the list or its empty state renders directly under the alert (`TicketsBlock.tsx:339-356`),
  and the heading "Choose a night to buy tickets" shows only when there are rows.
- Tap on a row sets `?occurrenceId` and re-keys everything together: `pickNight` navigates to
  `searchWithNight(location.search, id)` (`TicketsBlock.tsx:68-73,116`, keeps other params, drops a stale
  `tickets=cancelled`, `replace: true`). `EventPage.tsx:41-42` reads `?occurrenceId` from the URL and passes it
  to BentoPage, which passes `occurrenceId ?? snapshot?.occurrenceId` to `EventTicketsPage` -> `TicketsBlock`.
  Inside the block the ONE `occurrenceId` prop feeds the query key (`:75`), `promoKey(.., occurrenceId)`
  (`:124,141,154`), `previewPromo(.., occurrenceId)` (`:143`) and `buildCheckoutBody({.. occurrenceId})`
  (`:215`). A `nightSeen` guard clears the old refusal and pick on a night change (`:185-191`, tested). The
  snapshot query key changes with the night, so `useEventPage.isLoading` goes true, `state` leaves `ready`,
  the overlay (`BentoPage.tsx:783`) unmounts and remounts on the new night while `ticketsOpen` (BentoPage
  state, `:207`) survives. Documented in the design record; typed form input is lost (handover follow-up 1).
- Weekly page: `nights.length` is 8 of 53 (prod: both weekly sellers have 53 future nights, 0 cancelled). Nights
  past the 8th cannot be chosen from the list (handover follow-up 2). Acceptable for this round; not a dead
  end, since any listed night works.
- Festival page: see N6. The S1a surfaces do not exist on the festival page at all, so there is nothing to
  check there; the "festival" test shape renders components the festival page never mounts.

### 2. FIX-2: block quiet bar and sticky bar agree for `needs_night`: PASS
- `TicketsBlock.tsx:323-333`: for `needsNight` the quiet-bar button is enabled and calls `chooseNight`
  (the list); the disabled variant is kept for the other quiet states (sold out, closed). `quietBar(..).button`
  equals `quietBarButton(..)` for the shape (test `FIX-2`). The sticky bar's button is enabled whenever
  BentoPage renders it. No disabled labelled button remains on a reachable path. The sticky bar keeps a
  `disabled={!onOpenTickets}` fallback whose `title` says "Choose a night from the event dates"; see N8.

### 3. FIX-3: probe and sticky-bar tests exist; the null-night mutant fails: PASS
Run in a worktree at e015802a with the repo's `node_modules`, `npx vitest run src/modules/tickets src/modules/event-page`:
| Run | Result |
|---|---|
| baseline | 58 files, 1112/1112 pass (37.8s) |
| `InSiteTicketProbe` keyed and fetching with `null` night (round-1 FIX-3 mutant) | 2 fail (`nightControls` FIX-3 x2), 1110 pass |
| sticky bar "Choose a night" back to scrolling `[data-block-id="dates"]` | 1 fail (FIX-1 test) |
| block quiet-bar "Choose a night" disabled again | 1 fail (FIX-2 test) |
| `buildCheckoutBody` drops `occurrence_id` (round-1 PASS regression) | 3 fail |
| `pickNight` navigates without setting `occurrenceId` | 8 fail (every row-navigation assertion) |
| `nightOptions` stops dropping cancelled nights | 7 fail |
| `TicketsBlock` calls `promoKey(id, qty)` without the night (N2 at the call site) | 0 fail -- see N7 |

### 4. N1, N2 and round-1 PASS items: PASS, one test gap
- N1 (`TicketsBlock.tsx:215`): the cancel URL is built from `searchWithNight(location.search, occurrenceId)`
  when the block has a night, so the resolved night rides the cancel path even when the page URL had none.
  Tested (`screens.matrix.test.tsx:179-180`: `?occurrenceId=n1&tickets=cancelled`). Correct.
- N2 (`promo.ts:105`): `promoKey(typeId, quantity, night)` appends `@night`; all three call sites in the block
  pass `occurrenceId`. The pure function is tested; the call site is not (N7).
- Round-1 PASS items unchanged: `ticketCheckoutApi.ts` (v2 reads, `p_event_series_id`/`p_occurrence_id`) is
  not touched by the fix commit; the body carries `occurrence_id` iff a night (mutant above); the five refusal
  copies keep "You have not been charged" and `way: 'pick_night'` (`ticketCheckoutModel.ts:330-334`).

### 5. UI by reading: FIX-4, rest PASS
- Taps: night rows `min-h-[48px] w-full` (`NightPicker.tsx:85`), quiet-bar button `h-[48px]`, refusal control
  `min-h-[44px]`, empty-state "Contact the organiser" `min-h-[44px]`. Covered rows: FIX-4.
- Widths: the list uses `w-full`, `min-w-0 break-words` on the label and `shrink-0` on the time; no new fixed
  width, so no new sideways-scroll source at 390.
- Raw Unicode punctuation: none in the diff; `npm run check:mojibake` on e015802a: 2653 files, clean.
- Empty night list: "No other nights are listed for this event." plus a `/organisers/:id` link (route exists,
  `app/routes/organiser.tsx`) or "Check back later." when no organiser. Actionable. Wording nit: "other" is
  wrong when no night is on screen (every night past or cancelled; no refusal); harmless.
- Not measured: contrast of the new `#FFFFFF` on `#243B36` button text and the muted empty-state copy; actual
  layout at 390x844 (no browser walk, no preview deploy).

## Notes (not blocking)

- N6 (medium, pre-existing on `main`, not a regression): the festival seller never renders these surfaces.
  `sniffIsFestival` returns true for `event.format === 'festival'` (`festivalEventQuery.ts:120`), and
  `EventPage.tsx:82-86` then renders `FestivalDetail`, not `BentoPage`. `src/pages/FestivalDetail.tsx:4014-4030`
  mounts `EventStickyActionBar` with no `inSiteTicketing`, no `occurrenceId`, no `onOpenTickets`, and never
  mounts `EventTicketsPage` or `TicketsBlock`. Prod (read-only, 2026-11-10): the one `format='festival'` series
  with live types (12) is exactly this case. So on the festival page there is no probe, no "Choose a night",
  no Tickets page and no night list: its 12 in-site types are not buyable in-site, before and after this PR.
  The PR body ("Ritmo de Bachata Festival ... its night, NULL"), the design record ("one festival (one night)")
  and the festival test shapes present the festival as covered by this UI. Ask: say in the PR body and design
  record that the festival page has no in-site ticketing surface (separate ticket), and keep the festival test
  as a fixture-only shape.
- N7 (low, test gap): the night in `promoKey` is asserted only on the pure function. Dropping `occurrenceId`
  from the `promoKey` call in `TicketsBlock.tsx:124` leaves 797/797 green. One assertion that an applied
  preview is not shown after a prop-only night change (the `rerender` pattern already in `nightControls`)
  would close it.
- N8 (low): `EventStickyActionBar.tsx:224-225` keeps a disabled fallback with `title="Choose a night from the
  event dates"` for a caller that passes no `onOpenTickets`. BentoPage always passes it and FestivalDetail
  never sets `inSiteTicketing`, so the branch is dead; if kept, the title should not name the dates.
- N9 (low): `EventTicketsPage.tsx:130` memoises `nightOptions(nights, occurrenceId, new Date())` on
  `[nights, occurrenceId]`, so the "today" cut-off is the one at mount; a page left open past midnight keeps
  yesterday's filter until the night or snapshot changes. Tapping such a row lands on that night's page, which
  says what applies. Harmless.
- Round-1 N3, N4, N5 stand as written; N3 unchanged (handover follow-up 4).

## tsc
`npx tsc --noEmit -p tsconfig.app.json` on e015802a and on `main` (both in this sandbox): 91 error lines each
after stripping positions; the sets are identical except the pre-existing `BentoPage.tsx` TS2322 whose message
now lists the `nights` prop (its cause is the pre-existing missing `programHooks` on `EventTicketsPageProps`,
`EventTicketsPage.tsx` TS2339, present on `main`). No new error from the diff. (The PR body's "147" is from
another checkout; the count is machine-dependent, the delta is what matters.)

## PR #1523 checks at e015802a (GitHub API, 2026-11-10 ~15:45 UTC)
success: contract-check, live-db-gate, wallclock-brand, phone-qa (1,2,3), phone-qa-section, build-smoke,
dancer-area-isolation, unit x3 (Europe/London full, America/New_York, Australia/Sydney), integrity,
notification-check, masking-check, no-preview-reason x4, bundle-budget, bom-check, bom-check-routed, route,
decide, open-pr, real-data-verified. skipped: lighthouse, doc-weight, synthetic, synthetic-preview, og-check,
og-preview, seo-check, seo-preview, enable. e2e-smoke: success (completed 15:42:12 UTC). All 27 non-skipped checks green. `mergeable_state`: blocked (review required).

## Verified / Not verified
- Verified: the whole fix-round diff read file by file; every finding traced to file:line; vitest baseline
  and seven mutants on e015802a; tsc on e015802a vs `main`; mojibake check; prod counts (read-only: series
  with live types by format, future and cancelled night counts); the festival routing by reading
  `EventPage.tsx`, `festivalEventQuery.ts` and `FestivalDetail.tsx`; PR check runs.
- Not verified: browser walk at 390x844 (FIX-4 is by reading the layout, not measured); contrast; real
  Stripe; the edge deploy and live 409s; the overlay remount on a night change in a real browser; how
  `is_past` is computed server-side for a night that is today but already started.
