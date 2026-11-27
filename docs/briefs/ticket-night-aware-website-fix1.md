# S1a Website fix round 1: night controls need a real target

Brief-version: 1
Repo: Website (123constante/bachata-website). Branch: `claude/ticket-night-aware-website` (PR #1523, head 7532b82e; push onto it, do not open a new PR). Lane: careful (money path). Opus builds. One push. Independent review at `docs/review/ticket-night-aware-website.md` on branch `claude/review-ticket-night-aware-website` = FIX, three items. Read that file first; it has file:line for each.

## Do (in order, red test first each)
1. FIX-1 (blocking): "Choose a night" / "See the dates" / "Choose another night" scroll to `[data-block-id="dates"]`, which only renders for multi-date courses. Prod sellers are a festival and a weekly party, so the control is dead. Give the no-night and the five refusal states a real target: render a short night list (from `snapshot.occurrences`, already loaded by BentoPage; future, non-cancelled nights, full weekday names) inside the Tickets page, each row navigating to `?occurrenceId=<id>`; reword copy to match what is on screen. ONE design chosen, alternatives noted in `docs/design/ticket-night-aware-website.md`. Test: the control reaches a rendered night row or a navigation, not only a callback.
2. FIX-2: `TicketsBlock` `quietBar()` for `needs_night` renders a DISABLED "Choose a night" button while the sticky bar shows a working one. Wire it to the same action (or drop the quiet bar when `needsNight`). Test the two agree.
3. FIX-3: add tests that `InSiteTicketProbe` with `occurrenceId="n1"` calls `fetchPublicTicketTypes('e1','n1')`, and that `EventStickyActionBar` forwards `occurrenceId`. Confirm the null-night mutant now fails.
4. Notes N1 (write resolved night into the Stripe cancel path) and N2 (include the night in `promoKey`): do them if each is under 10 lines, else list as follow-ups in the handover.
5. UI at 390x844 on prod-shaped data: taps >= 44px, no sideways scroll, empty/error states actionable; screenshots on the PR; update the PR body "Verified / Not verified".

## Files
src/modules/tickets/__tests__/nightControls.matrix.test.tsx
src/modules/tickets/NightPicker.tsx
docs/handover/ticket-night-aware-website-fix1.md

Existing files you edit: `src/modules/tickets/TicketsBlock.tsx`, `EventTicketsPage.tsx`, `ticketCheckoutModel.ts`, `src/modules/event-page/bento/EventStickyActionBar.tsx`, `InSiteTicketProbe.tsx`, `docs/design/ticket-night-aware-website.md`, and existing tests in `src/modules/tickets/__tests__/`.
