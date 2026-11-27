# Brief: ticket-door-code-screen r2 (fix round on PR #1294)

Repo: 123constante/bachata-website. Branch: `claude/ticket-door-code-screen` (PR #1294, flag `ticketDoorCode` OFF).
Review: `docs/reviews/1294-r1.md` on branch `claude/review-1294-r1` (git show origin/claude/review-1294-r1:docs/reviews/1294-r1.md). Read it first.
F1 (PR body) is already fixed by the orchestrator. F2 (contract-check red) is red on main too: not yours.

## Fix (red test first for each behaviour change, then green)
- F3: after a list Check in answers `not_allowed`, the list rows must not keep enabled Check in buttons. Pass `notAllowed` to `ListTab` and show the card's reason instead of the button (as the scan tab does at DoorScreen.tsx:198). Add an off_team LIST-shape case to `door.shortCode.matrix.test.tsx` (kills mutant M2 in that file).
- F4: invalidate the list when a list Check in answers `already_in` (one line, DoorScreen.tsx ~:92).
- F5: the paused banner must not say "tap Check in" when the list failed to load (`list.isError && !list.data`): drop the banner or say "when the list loads".
- F6: rename `editor` to `manager` in the matrix `ROLES`, INVENTORY section 3 and the handover (prod roles are owner, manager, contributor; contributors are allowed).
- F7: correct the handover/PR-body claim to the real red-first number (168 failed / 50 passed of 218) and say flag-OFF differs from main in two harmless places, OR gate the `tried` reason line and the "Checking&hellip;" label behind `shortCodes` so the claim is literally true (prefer the gate if it is under 10 lines).

## Rules
Flag stays OFF. Design-gate: this is a wording and control-state fix; no new visuals. Run the door suite (`npx vitest run src/modules/organiser/p3/door`), typecheck, lint chain, `check:bundle-budget`. Update the PR body Verified lines honestly. One early checkpoint push (subject ends [skip preview]) then one final push. Never approve or merge. Handover `docs/handover/ticket-door-code-screen-r2.md`. Last commit subject ends `[worker-done <ticket>]`.
