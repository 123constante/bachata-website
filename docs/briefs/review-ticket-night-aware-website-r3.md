# Review round 3 (delta only): S1a Website PR #1523 at head 5d6adb23

Brief-version: 1
Repo: Website. Review branch `claude/review-ticket-night-aware-website-r3` (READ-ONLY: no source edit, one report file). Fable reviews. You are not the round-1 or round-2 reviewer and not the builder.

## Target
Head 5d6adb23 of `claude/ticket-night-aware-website`. Round-2 report (FIX-4, N6, N7, N8; reviewed e015802a): `docs/review/ticket-night-aware-website-r2.md` on branch `claude/review-ticket-night-aware-website-r2`. Delta to review: `git diff e015802a 5d6adb23` (screenshots/docs plus TicketsBlock.tsx, EventStickyActionBar.tsx, nightControls.matrix.test.tsx).

## Files
docs/review/ticket-night-aware-website-r3.md

## Check
1. FIX-4 fixed: in the no-night state the night list is above the quiet-bar spacer and the spacer is the LAST child of the block in every quiet state (no-night, sold out, refusal + list). Run the new tests; run a mutant that moves the spacer back above the list and show it fails.
2. N6 text honest in the PR body and `docs/design/ticket-night-aware-website.md` (festival page not covered). N7: dropping the night from the `promoKey` call at the block now fails a test (run the mutant). N8: title reworded.
3. No regression: `npx vitest run src/modules/tickets src/modules/event-page` all green; round-1/2 PASS items untouched (`git diff` shows no change to ticketCheckoutApi.ts / buildCheckoutBody).
4. State plainly what you could not verify (no browser walk at 390x844).

## Hand-off
Verdict PASS / FIX in `docs/review/ticket-night-aware-website-r3.md`; the report must name "PR #1523" and "head 5d6adb23". Last commit subject ends with the worker-done marker.
