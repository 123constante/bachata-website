# Handover: S1a Website fix round 2 (PR #1523)

Ticket: dt_3849feb4d8ee. Brief: `docs/briefs/ticket-night-aware-website-fix2.md` (branch
`brief/ticket-night-aware-website`). Review: `docs/review/ticket-night-aware-website-r2.md`
(branch `claude/review-ticket-night-aware-website-r2`). Branch `claude/ticket-night-aware-website`.

## Done
- FIX-4 (`src/modules/tickets/TicketsBlock.tsx`): the quiet bar's 84px spacer moved out of the quiet
  bar fragment to the very END of the block (`data-testid="ticket-bar-quiet-spacer"`, rendered when
  `quiet`). Note: commit 1a6bc4d (round 1, after the reviewed e015802) had already put the night list
  above the bar, which fixed the plain no-night case; the refusal + its night list and the
  "Pick a ticket" hint still rendered after the spacer. Now nothing in flow follows it.
  Tests (`nightControls.matrix.test.tsx`, "FIX-4"): spacer is the last child (no-night weekly; sold
  out; refusal then sold-out re-read), no quiet spacer when buyable.
  Red first: the no-night test fails on e015802's block; the refusal test fails on 1a6bc4d's block
  (both with only a test id added to the old spacer). Green on this branch.
- N6: design record (`docs/design/ticket-night-aware-website.md`) and the test file header now say
  the festival page (`FestivalDetail`) has no in-site ticketing surface, before and after this PR;
  the festival shape is fixture only. PR body corrected.
- N7: test "N7" applies SAVE10 on night w0 (total shows the discounted price), rerenders the block on
  w2 by prop only, asserts no "applied" note and the full price. Confirmed: dropping `occurrenceId`
  from `const key = promoKey(selected.id, qty, occurrenceId)` fails it.
- N8: `EventStickyActionBar.tsx` disabled fallback title is now "Tickets cannot be bought on this
  page" (no "event dates").

## Checks run (this sandbox)
- `npx vitest run src/modules/tickets src/modules/event-page`: 58 files, 1117/1117 pass.
- `npx tsc --noEmit -p tsconfig.app.json`: 0 errors in the files touched (repo total 147,
  pre-existing, machine-dependent per r2).
- `npm run check:mojibake`: clean.
- `/code-review` (low) on the diff: no findings.

## Not verified
- Browser walk at 390x844: last night row tappable above the quiet bar (jsdom cannot see layout).
  This is the lead's walk after this push.
- Festival in-site ticketing: does not exist; separate ticket.

## Next steps
- Lead: browser walk at 390x844 on the preview (weekly page, no night on screen; and a refusal).
- Follow-ups from round 1 handover stand (typed form lost on night change; only 8 nights listed;
  N9 midnight cut-off memo).
