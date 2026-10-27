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
