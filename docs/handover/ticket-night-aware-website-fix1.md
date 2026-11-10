# Handover: S1a Website fix round 1 (PR #1523)

Brief: `docs/briefs/ticket-night-aware-website-fix1.md` (branch `brief/ticket-night-aware-website`,
sha 85cd149). Review: `docs/review/ticket-night-aware-website.md` (branch
`claude/review-ticket-night-aware-website`). Ticket dt_dcbfce8d0f0a. Design:
`docs/design/ticket-night-aware-website.md`, section "Fix round 1".

## Done
- FIX-1: night list inside the Tickets block (`src/modules/tickets/NightPicker.tsx`, mapping
  `nightOptions`), fed from `snapshot.occurrences` via BentoPage -> EventTicketsPage. Rows navigate to
  `?occurrenceId=<id>`. Sticky bar "Choose a night" now opens the Tickets page; the refusal's
  "Choose another night" scrolls to the list; copy reworded to "See the other nights below."; empty
  state with a Contact the organiser link (the festival after a refusal has no other night).
- FIX-2: the block's quiet-bar "Choose a night" is a working button (scrolls the list into view);
  other quiet states keep their disabled label.
- FIX-3: tests that `InSiteTicketProbe` with `occurrenceId="n1"` fetches `('e1','n1')` and that
  `EventStickyActionBar` forwards `occurrenceId`.
- N1 (done, 1 line): the Stripe cancel URL carries the resolved night.
- N2 (done, 4 lines): `promoKey(typeId, qty, night)`.
- One /code-review round (medium) on the diff: 10 findings; fixed copy-vs-empty-list, timeless
  nights, duplicate wall-clock parsing, dead branch, mixed-case prompt, double exclusion, no-op
  button fallback; documented the remount (below).

## Mutants (run on the new test file)
| Mutant | Result |
|---|---|
| probe keyed/fetched with `null` night (the review's FIX-3 mutant) | 2 fail |
| sticky bar "Choose a night" back to scrolling `[data-block-id="dates"]` (old code) | 1 fail |
| block quiet-bar "Choose a night" `disabled` again (old code) | 1 fail |

## Follow-ups (not done)
1. Picking a night reloads the event page; the Tickets overlay remounts, so a typed email/name is
   lost after a refusal. Fix would be BentoPage keeping the overlay mounted through the reload.
2. The list shows at most 8 nights (soonest first); a weekly series has 53 future nights, so nights
   past the 8th cannot be chosen from it. Consider "Show more".
3. Rows are snapshot nights, not a per-night stock read; a listed night can turn out sold out / not
   yet on sale (that night's page then says so).
4. Review N3 (bar reads all rows, block reads `typesForNight`) unchanged; prod has no own-night types.
