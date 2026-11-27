# Brief P102 r2: review fixes on website#2517 (raffle win, been-to events)

Brief-version: 2
Size: 2 files, 80 lines. Design: none (uses the existing "none" screen).
Branch: `claude/raffle-win-beento-p102` (EXISTING branch, PR #2517 open; push new commits on top, do not open a new PR). No switch (bug fix on the live raffle win page).

Independent review `docs/review/2517-r1.md` (Opus) said BLOCK at head 53cdad6. Fix finding 1 (blocker) and nits 2 and 3. Leave nits 4-6.

## What main lacks
- src/pages/RaffleWin.tsx: after a silent `already_been_to_event` removal (or any refusal) empties `nights`, the page still goes to the pick step. PickScreen has no empty state for an empty list, so the winner sees "Pick your night" with no cards and no next step. -- grep: win-status-none
- src/pages/RaffleWin.tsx: on reload after onboarding, when the chosen night is still in the fresh list, the honesty step keeps the OLD `night` object (stale needsTick/tickOrganiser) and does not reset `ticked`. -- grep: reloadAfterProfile

## Files
- src/pages/RaffleWin.tsx (edit)
- src/pages/__tests__/RaffleWin.beenTo.test.tsx (edit)

## What to build
0. INVENTORY: not needed for this round (INVENTORY.md exists; leave it as the r1 worker left it).
1. Blocker: after `applyRefusal(...)` in the lock-refusal path, if the resulting `nights` list is empty, `setStep('none')` instead of `'pick'`. The existing none screen already says "No nights open right now / Check back soon. Your prize is kept." and has "Check again" calling `claim()`. This applies to every refusal that removes the last night (already_been_to_event, spot_taken, night_not_open), not only been-to.
2. Nit 2: in `reloadAfterProfile`, when the chosen occurrence is still in the fresh list, `setNight(` the FRESH night object with the same occurrenceId `)` before going to the honesty step.
3. Nit 3: on that same path, `setTicked(false)` (the r1 brief said "tick cleared").

Use HTML entities in JSX, never raw Unicode punctuation.

## Tests (add to `src/pages/__tests__/RaffleWin.beenTo.test.tsx`)
- One event, one night; lock refusal `already_been_to_event` -> `win-status-none` shown, no banner, no "have been to that event" text.
- One night; lock refusal `spot_taken` that removes it -> `win-status-none`.
- Two events; refusal `already_been_to_event` on one -> still pick step with the other event (unchanged behaviour).
- Reload after profile with the chosen night still present but `needsTick` changed in the fresh claim -> honesty sheet reflects the fresh value and the tick starts unticked.
Run the new tests against the current branch head (53cdad6) first and say they fail. Existing tests stay green.

## Done
- Run test:unit for src/modules/raffle-win and src/pages/__tests__/RaffleWin*, typecheck, lint chain incl. check:mojibake; results in a PR comment or PR body update.
- Handover: new head SHA, checks per job, honest "Not verified" (no phone walk).
