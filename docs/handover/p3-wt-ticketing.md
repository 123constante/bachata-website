# Handover: P3 W-T ticketing, Phase A (design only)

Branch `claude/p3-wt-ticketing`. Brief `brief/p3-wt-ticketing`.

## Done
- Design brief + inventory of the shipped ticketing screens: `docs/design/p3-wt-ticketing.md`.
- Three standalone 390x844 mockups (light / dark toggle) in `mockups/p3-wt-ticketing/`:
  `A-tickets-page.html` (recommended), `B-inline-on-event.html`, `C-tickets-sheet.html`.
- No source code changed. No Supabase read or write.

## Left / next (Phase B, on the owner's pick)
1. Owner picks A, B or C (and OKs the two copy changes in the design doc).
2. Prod shape survey (SELECT only), then build per the brief's Phase B list.
3. Delete old `/account/tickets` in the same PR series once the walk passes.

---

# Phase B (build), 2026-10-27, owner pick C "one tall sheet"

Brief `docs/briefs/p3-wt-ticketing-phase-b.md` on `brief/p3-wt-ticketing`. PR #1079 (draft).

## Done
- Prod shape survey (read-only, counts): table in the PR body; fixtures in
  `src/modules/organiser/p3/tickets/__tests__/fixtures.ts`.
- New module `src/modules/organiser/p3/tickets/` (behind `organiserP3` + `organiserTicketing`):
  - `TicketsEntry.tsx`: the event page Tickets row (word, detail, chip) opening ONE tall
    sheet: types with the Selling switch, the latest 2 orders, "See all N orders" (an
    orders view in the same layer, with Back), Add a ticket in the footer.
  - `TypeSheet.tsx` (add / edit, 3 steps) and `RefundSheet.tsx` (with an order summary)
    open OVER the tall sheet through `StackSheet.tsx` (only the top layer hears Escape
    and its scrim; lower layers are inert; closing a layer focuses the control that
    opened it).
  - `GetPaid.tsx`: You > Get paid screen (route `you/get-paid`), You's Get paid row,
    Home's ONE Get paid prompt, Home's tickets-sold tile.
  - `model.ts`: the P3 layer over `tickets/ticketModel.ts` (reused unchanged): the
    approved copy swap (`p3Words`: "Tickets home" -> "You > Get paid"), the Home prompt
    title, the one tone -> P3 tag class map, the Tickets row, the order preview, the held
    draft.
- Defects folded in: the add / edit draft is held by `TicketsEntry` (above every sheet);
  the order state tag is always shown and Refund is a separate button.
- Wiring: `EventPage.tsx` (+1 line), `HomeScreen.tsx` (+2 lines), `P3Routes.tsx` (the
  you route line -> `{youRoutes()}`), CSS appended to `theme/p3.css` (no new tokens).
- **W4a merge point:** `src/modules/organiser/p3/shell/youTickets.tsx` is the ONLY You
  wiring. W4a replaces `YouScreen` with its hub and mounts `<GetPaidRow />` as a row;
  the `you/get-paid` route stays.

## Deleting old `/account/tickets` (NOT done; after the walk passes)
Touches:
- `src/components/AnimatedRoutes.tsx`: the `OrganiserTicketsArea` lazy import and the
  `flags.organiserTicketing && flags.organiserSelfServe` route block.
- `src/components/catchallClientPaths.ts`: `'/account/tickets/*'`.
- `src/modules/organiser/tickets/`: `TicketRoutes.tsx`, `TicketsHome.tsx`,
  `SeriesTickets.tsx`, `TypeSheet.tsx`, `RefundSheet.tsx`, `parts.tsx`, `paths.ts`, and
  tests `__tests__/screens.matrix.test.tsx`, `__tests__/flagOff.test.ts`.
  KEEP `ticketModel.ts`, `ticketsApi.ts` and their tests (`ticketModel.matrix`,
  `compact.model`, `ticketsApi.wire`): P3 reuses them.
- Then the copy swap can move into `ticketModel.ts` (moveBlock + `organiser_not_onboarded`
  say "You > Get paid") and `p3Words` / `OLD_PAYMENTS_WHERE` go; the two small facts
  duplicated from `SeriesTickets.tsx` / `parts.tsx` (`hasOrdersOf`, `eventDateLine` in
  `p3/tickets/model.ts`) become the only copies.
- Any Stripe onboarding link minted by the old screens returns to `/account/tickets?...`;
  after deletion that lands on NotFound (flag is off in prod, test accounts only).
- Docs that name the old route: `docs/organiser-ticketing-journey.md`,
  `docs/handover/ticketing-organiser-ui.md`.

## Review rounds (stopping rule: user-facing + money = two rounds)
- Round 1 (10 findings) fixed in e2b5680: focus per view/step, no default focus on Close,
  per-row switch busy/error, refresh scoped to this event, dvh sheet height, closed+sold row.
- Round 2 (10 findings on the round-1 fix) fixed in 965765c: the round-1 "no close while a
  write runs" guard could trap the sheet on a hung request, so it was reverted: the sheet
  always closes, a late refusal comes back as a toast, an add closed mid-save drops its
  draft (no second save), a refund in flight locks that order's Refund button
  ("Refunding..."), default focus is the marked field or the heading (never a commit or
  money button), the refusal note takes focus, focus returns to the top sheet after a
  refund removes its button.
- Round-2 fixes are UNREVIEWED code (CLAUDE.md: fixes to findings are unreviewed).
- Process note: the review fixes landed as follow-up commits because the branch was
  pushed early (brief's push-early rule); CLAUDE.md prefers edits before commit.

## Local CI parity (HEAD 29f28f5, before the review fixes; re-run on the final head NOT done)
All architecture-guard, typecheck, perf-budget (build + budgets + chunk cycles), phone-qa
(phone suite + build smoke), dancer-area isolation and unit timing/tz legs PASS.
Failures: `test:unit:offline` B-N8 raw-Unicode test (CAUSED here, fixed in e2b5680; the
organiser suite is 6470 passed after the fixes); `tests/integrityCouldNotRun.test.ts`
(5, pre-existing on main); e2e `organiser-home.spec.ts:55` (pre-existing on main) plus
flaky retries; `npm run lint` link `check:integrity` exit 126 (script mode 100644 locally,
CI chmods; pre-existing). eslint p3: 0 errors, 3 react-refresh warnings (1 pre-existing).

## Next (new session)
1. Re-run the full local CI set on the final head; read PR #1079 checks per job.
2. Review round on 965765c (the round-2 fixes are unreviewed).
3. Orchestrator: browser walk at 390x844 as the walk test account, Design Gate stage 5
   critique by a different worker, Verified / Not verified block, then delete old
   `/account/tickets` (list above) in the same PR series.

---

# Fix 1, 2026-10-27 (brief `docs/briefs/p3-wt-fix1.md`, review `docs/review/pr-1079-r1.md`)

UNREVIEWED code: every fix below needs the second independent review the orchestrator runs.

## Done
- Merged `origin/main` (dd8112f) into the branch.
- **F2 + F1 (money):** a save or refund whose sheet was closed before the answer now reports
  through ONE parent handler, `late(text, landed)` in `TicketsEntry.tsx`: a success toasts and
  refreshes, and never touches `editing` / `draft` / `refunding` (the sheet open NOW). Both
  review probes are tests (`stack.draft.test.tsx`, "a late outcome never touches...").
- **F3:** a late refusal is `role="alert"`, never auto-dismisses, and has a 44px Dismiss.
- **F4:** a switch success clears only its own row's error.
- **D1** You > Get paid row stacks (more specific `.p3-status-row .p3-row-t.p3-block`).
  **D2** type rows pad once. **D5** the stacked sheet head is sticky (`.p3-stack-head`, scoped
  to `StackSheet` so W2's `Sheet.tsx` is unchanged). **D3** Close min-width 44px.
  **D4** money figures 22px + `overflow-wrap: anywhere` (`.p3-money`).
- **Nits:** F5 the price waits with "Checking sales..." while the sales / orders reads load;
  F6 Escape inside "Close sales for good?" = Keep selling (`StackSheet` `onEscape`);
  D6 ON knob is `var(--card)`; D7 Add a ticket's `aria-describedby` target always exists;
  D8 the contributor reason is said once; D9 Orders heading 16px, Home kicker is a warn tag;
  D10 the loading row has `cursor: default`.
- **Found on the 390px walk (not in the review):** `.p3-sheet-body { flex: 1; min-height: 0 }`
  shrank, so a long list overflowed past the sticky footer and Add a ticket scrolled away.
  Now `flex: 1 0 auto`; measured footer pinned at y 775-844 after a 1200px scroll.
- Tests: `layout.cascade.test.ts` resolves the p3.css cascade (specificity, order) for D1 to
  D5 and the footer; red on the old CSS (4/4). F1 to F6 and D7/D8 tests red on the unfixed TSX.

## CI notes
- `bundle-budget` is red ON MAIN: main dd8112f measures 374.088 KB on `/app/*` vs the 374
  pin (#1056 Bristol polish). This branch measures 374.085 KB (3 bytes under main): the P3
  tickets code is not in `/app`'s first load, so lazy-loading it changes nothing. Budget
  NOT raised (brief). Needs an owner decision on main (raise with measurement, or trim #1056).
- `phone-qa` was CANCELLED by its 25-minute job timeout, no test failed in the log. The suite
  is 534 tests; locally it passed 406, skipped 128, failed 0 in 14.3 min with 2 workers; other PRs hit the same cancel today.
  Infra (suite length vs timeout), not this PR.

## Left / next
1. Second independent review of the fix-1 diff (`git diff 84567dd..HEAD -- src`).
2. Owner walk on a phone with the walk account (D1 row, a three-type event, a long list).
3. Owner call on the main bundle-budget overage and the phone-qa timeout.

---

# Fix 2, 2026-10-27 (brief `docs/briefs/p3-wt-fix2.md`, review `docs/review/pr-1079-r2.md`)

UNREVIEWED code: these are fixes to findings. Round 2 of 2 was the last review round under the
stopping rule, so the orchestrator decides whether this diff (`git diff ceb8a22..HEAD -- src`) gets
a read before the flag goes on. One in-session `/code-review` (high) ran on it; its findings are
listed at the end.

## Done (every item with a test red first on the unfixed code)
- **R2 + R1, one toast model** (`TicketsEntry.tsx`): a status slot (`say`, 8 s) and an alert QUEUE
  (`late(text, false)`), rendered in one `.p3-toast-stack` column (alerts first). A status never
  clears an alert; two late refusals both stay, each with its own Dismiss. Late texts name their
  subject only when late: `Refund started for Buyer X's order.`, `Refund for Buyer X's order did not
  start. <reason>`, `"<ticket>": Ticket saved.`, `"<ticket>": sales closed.`; the in-sheet words are
  unchanged. Ticket subject = the saved type's name (a new ticket: its typed name).
- **R7**: every toast is its own keyed node (`alert-<id>`, `status-<id>`), so an alert is never a
  status node changing role, and the same words said twice restart the 8 s.
- **R3**: the F3 test installs fake timers BEFORE mount, advances 8001 ms, asserts the alert stays
  AND the status is gone. Mutant M3 (`if (alert) return;` removed): RED (was green).
- **R4**: `onSaved` clears only the saved type's switch reason (also Close sales); a save that lands
  late clears its own row through `late(..., savedTypeId)`. Probe P6 is a test.
- **R5**: Escape while "Close sales" is in flight keeps "Closing..." (Escape is a no-op then) and
  Keep selling is disabled while busy. Probe P9 is a test.
- **R6**: kept as a documented choice (comment at the toast render in `TicketsEntry.tsx`): the
  alert is a live region and Tab reaches Dismiss; a screen reader confining browse mode to the
  aria-modal sheet reaches Dismiss only after the sheet closes. Owner call if that is not OK.
- **R8**: `layout.cascade.test.ts` header says what the resolver cannot see; two raw-text checks:
  no `!important` in p3.css, no `padding-top/bottom` rule on `.p3-date-btn`.
- **R9**: note only (pre-existing, server-guarded), unchanged.
- From the in-session `/code-review`: a late "Put on sale" whose save landed but whose on-sale was
  refused is now an ALERT (was an 8 s status); the toast column is capped at `40dvh` and scrolls.
  Mutants for these three (partial save as success, late save not clearing its row, constant status
  key) each turn exactly one new test red.

## Not fixed from the in-session review (owner notes)
- Two orders with NO buyer name would both read "Buyer's order" late (prod: 0 such orders).
- Late wording is built in each sheet (TypeSheet `named`, RefundSheet `whose`), not in one parent
  formatter: a refactor for later, not this fix round.
- Alerts still sit above the open sheet's footer until dismissed (capped column, scrollable).

## Left / next
1. Orchestrator: read of the fix-2 diff (unreviewed), then the owner walk on a phone.
2. Owner calls: bundle-budget on main, phone-qa timeout, R6 (toast outside the dialog).

## CI (fix 2)
PR checks on `7b7df95` (the code head; the final commit adds only this doc):

| Job | Result |
|---|---|
| integrity, bom-check, masking-check, notification-check, wallclock-brand | success |
| unit (Europe/London, full) | success: the `festivalClientState.test.tsx:735` flake from fix 1 did not repeat (also 8/8 locally) |
| unit (America/New_York), unit (Australia/Sydney), dancer-area-isolation | success |
| e2e-smoke, phone-qa (finished inside its timeout this time), build-smoke | success |
| live-db-gate, real-data-verified, phone-qa-section, decide, open-pr, no-preview-reason x4 | success |
| bundle-budget | **failure**, red on main: `/app/*` 374.1 KB vs 374 (dancer-app chunk; P3 code not in it). Budget not touched (brief) |
| contract-check, seo-*, og-*, synthetic*, lighthouse, doc-weight, enable | skipped (path filters) |

Run locally on the fix-2 code: architecture-guard steps (integrity, legacy-tables,
legacy-program-rpcs, lint:architecture, check:images AUDIT_STRICT=1, image-widths, plan-hygiene,
workflow-artifact-policy, mojibake) PASS; dancer-area-isolation PASS; `test:unit:offline` London
17388 passed, 5 failed = `tests/integrityCouldNotRun.test.ts`, sandbox-only (passes 67/67 with
`NODE_PATH=` cleared, as fix 1 recorded); `test:unit:timing` 65/65; NY tz list 218/218; perf
self-tests + build + first-load-requests + chunk-cycles PASS; bundle-budget same as main; build
smoke 73/73; `test:e2e` 150 passed / 7 failed under load, re-run of the 7: 6 pass,
`organiser-home.spec.ts:55` fails again (logged as pre-existing on main in the fix-1 notes; CI
e2e-smoke is green). Local phone suite stopped once CI phone-qa came back green. tsc
(tsconfig.app.json): 172 lines before and after, none in the touched files. eslint p3/tickets:
0 errors, 1 pre-existing react-refresh warning. Organiser suite: 6488 passed.
