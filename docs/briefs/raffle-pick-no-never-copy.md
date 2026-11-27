# Brief: drop "never been to" from the winner list screens, follow-up to website slice C (Website repo)

Branch: `claude/raffle-pick-featured-web` (PR #2507 is open on it; add ONE commit on top, do not open a new PR). UI copy only.
Size: 4 files, 40 lines.
Design: owner-approved mockup https://claude.ai/artifact/FEoc3S42BBAJYUTZnJfvS6 (admin Priority, message, pick list, tick + QR).
NEVER run `gh api`.

## Why (owner rule 2026-11-27)
The words "never been to" must not appear in the winner message or the pick list. They may appear ONLY in the tick on the last
screen (`src/modules/raffle-win/screens/HonestySheet.tsx`). Slice C left two old strings in place; brief item 4 asked for them to go.

## Inventory first
Write INVENTORY.md in the PR description section "Inventory" (not a file): every winner-screen string containing "been to", file:line cited, GAPs listed, end with a coverage count (N strings found, N changed or kept with reason). Do this BEFORE editing.

## Changes
1. `src/modules/raffle-win/screens/WonScreen.tsx` line ~11 title:
   `Free entry to a bachata night you have never been to. Pick which one.` -> `Free entry to a bachata night. Pick which one.`
2. `src/modules/raffle-win/pick/pickCopy.ts` `PICK_INTRO`:
   `Only nights you have never been to. Once you lock one, only the organiser can change it.` -> `Once you lock a night, only the organiser can change it.`
3. Update the pins in `src/modules/raffle-win/__tests__/screens.test.tsx` (~line 46) and `src/modules/raffle-win/pick/__tests__/pick.test.tsx` (~line 52).
4. Add one test: render WonScreen and the pick list; their text must not match /never been to/i. (HonestySheet is allowed to.)
5. grep `src/` and `public/` for any other winner-screen copy with "never been to" / "haven't been to" outside HonestySheet and list it in the PR body (do not change admin or other features).

## Done means
Commit on the existing branch, tests green (`npx vitest run src/modules/raffle-win`), tsc clean, PR #2507 body still passes
`check-pr-real-data-verified.mjs` and `check-pr-phone-qa.mjs`.
