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

## Browser walk (390x844, Playwright isMobile, local build on prod reads)
Coco Loco (weekly), with v2 rows stubbed to the no-night shape (remaining NULL) and view-recording
calls blocked. The sticky bar's "Choose a night" opens the Tickets page, which lists 8 nights, 48px
each (Wednesday 18 November 2026 19:15 ... Wednesday 6 January 2027). The quiet-bar "Choose a night"
scrolls the list into view. Tapping a row lands on `?occurrenceId=<id>` with the Tickets page
reopened for that night. scrollWidth is 390 and no control is under 44px. The walk caught that the
quiet bar's 84px spacer opened a gap above the list; the list now renders before the bar.
Screenshots: `docs/handover/fix1-shots/`.

## Checks (local)
- vitest src/modules/tickets + src/modules/event-page: 1112/1112. Full `test:unit`: 29202 pass,
  15 fail in the same 4 `tests/` files as round 0 (live-DB contracts and `integrityCouldNotRun`;
  none import tickets).
- build ok; check:bundle-budget, check:chunk-cycles, check:first-load-requests, check:images
  (AUDIT_STRICT=1), check:mojibake, check:wallclock-brand, check:legacy-tables,
  check:legacy-program-rpcs, check:rpc-typing, check:dancer-area-isolation, bin/check-integrity.sh
  all green. check:doc-weight needs a live deploy (it was skipped on the PR).
- tsc run on the final head: 0 errors in branch files beyond the pre-existing set (BentoPage
  `dates`/state comparisons and `programHooks` on EventTicketsPageProps, which exist on main).
- Both PR-body checks exit 0.

## Not verified
- Refusal flow in a browser: checkout is origin-locked, so Buy is disabled off bachatacalendar.co.uk
  (jsdom only).
- Festival page: no in-site bar button showed locally, so it was not walked.
- Vercel preview walk, real Stripe, edge deploy and live 409s, iOS Safari, contrast measured.
