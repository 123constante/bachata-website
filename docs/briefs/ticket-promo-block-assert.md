# Brief: block-level assertion that TicketsBlock uses promoNoteText (follow-up to Website #1372)

DISPATCH ONLY AFTER #1372 HAS MERGED (no stacked PRs). Branch claude/ticket-promo-block-assert, from latest main. Lane normal, Sonnet. Tests only: NO production code change. ONE push, final subject ends [worker-done <ticket>].

## Why
Survivor M5 in the #1372 verification (mutant review 2026-11-05): reverting the JSX in src/modules/tickets/TicketsBlock.tsx to the old inline join of pv.note and pv.applyBlocked, bypassing promoNoteText, still passes all 539 tests in src/modules/tickets. The current tests call the helper directly, so nothing guards that the block actually renders through it. The user-visible failure it would let back in: refusal text that repeats itself, e.g. "...Check the spelling and try again. Change the code to try again."

## What main lacks
- extends: no test renders TicketsBlock with a refusing preview and asserts the visible text -- grep: `promoNoteText` in src/modules/tickets/__tests__

## Files
- src/modules/tickets/__tests__/promo.block.test.tsx

## Do
Add a render-level, table-driven test of TicketsBlock (follow how promo.matrix.test.tsx or the existing block tests mount it and mock ticket_promo_preview_v1): for each of the 10 non-retryable refusal reasons (unknown_code, inactive, expired, used_up, not_for_this_event, no_discount, below_minimum, not_found, invalid_quantity) plus the retryable ones (rate_limited, network, timeout, internal_error), apply a code and assert the text under the field equals the note exactly once and does NOT contain "Change the code to try again." as a second sentence, and that Apply is disabled for non-retryable reasons. Include the empty-code note.
Prove the test works: run it against the real code (pass), then against this mutant in a scratch edit (must FAIL, then revert): in TicketsBlock.tsx replace the promoNoteText call with the old inline join of pv.note and pv.applyBlocked. Say so in the handover.

## Checks
npx vitest run src/modules/tickets (all green; report the count), eslint on the new file, tsc --noEmit -p tsconfig.app.json (no errors in touched files), npm run check:mojibake. Use HTML entities for punctuation in JSX, never raw Unicode. Handover: add a 5-line note to docs/handovers/ticket-promo-codes-web.md.
Git: separate plain commands (git add, git commit -F file, git push), no && chains, no -c user.name, no inline multi-line -m.
