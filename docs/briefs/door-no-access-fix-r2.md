# Fix round: PR #1439 (door refused card) -- findings A, C, E from review r2

Branch: claude/door-no-access-dead-end (head 8aa5b7e). Normal lane. ONE round; no further review round.
Source: `git show origin/claude/review-1439-r2:docs/review/review-1439-r2.md` (read section 2).

Do:
1. Finding A (Medium): in `src/modules/organiser/p3/door/DoorScreen.tsx` recheck branch for a check-in refusal (about line 143): when the list read comes back ok, clear the refusal (`setShown(null)`, reset `onScreen`, the gate) so the scanner and code box return; note copy "You can check tickets now. Scan or type the code again." No copy may point at a control not on screen.
2. Add a test in `door.noAccess.matrix.test.tsx` `typed` cell: after recheck `door-code-input` is present on both tabs and the note names no missing control.
3. Finding C: add one assertion that a code already on screen can be scanned again after access returns (kills mutant of `onScreen.current = null`).
4. Finding E: `.p3-note` gets `margin-top: 6px` in `door.css`. Finding D: fix the one-space indents at DoorScreen.tsx ~195/200.
Skip finding B (separate guard, park it in the PR body as follow-up).

Rules: LF line endings, no bare CR; run unit tests for the door folder + `npm run pre-ship`; PR body gets Verified / Not verified; push once.
