# Brief: ambassador link card, continuation 1 (review fixes)
Brief-version: 2

Branch: claude/bristol-ambassador-tracker (ALREADY has the build at head 69f9abad; continue on it, do not recreate). Normal lane, Sonnet, context cap 50%. One push. No `supabase/**`.

## Decisions
Independent review returned SAFE AFTER FIXES (no security problem; copy and states only).

## What main lacks
- a visible load-failure state with Retry on the link card. -- grep: link-load-error

## What to build
0. Write INVENTORY.md first (docs/design/ambassador-link/INVENTORY.md if absent): every state of the link card from the current Website, with file:line; report the coverage count at the end. No new design work.
1. trackerModel.ts: when `showWho` is true (admin viewing another person's link) the title reads "{Name}'s {City} link" not "Your ..."; make EMPTY_TEXT and OFF_NOTE wording not say "your" in that case. Tests for both viewers.
2. LinkCard.tsx LinkSection: when `tracker.isError`, show one line "We could not load the link." with a Retry button (data-testid link-load-error, 44px tap, calls refetch). Test: error state shows it; empty state does not.
3. trackerModel.ts: NOT_LIVE_NOTE and OFF_NOTE end with a full stop and name a real route ("Ask an admin." unless the app has a real contact route on screen: check, grep first).
4. LinkCard.tsx: keep the confirm box open (button text "Saving...") until the switch save finishes; close on success, show the error and stay open on failure.
5. LinkCard.tsx: make `busy` per card (only the card being saved disables its own switch); other cards stay usable.
6. cityLabel: change "Set Bristol 3" style chip to "3 set Bristol as their city".
7. Run `npx vitest run src/modules/ambassador`, `npx tsc -p tsconfig.app.json --noEmit` (count not higher), `npm run check:mojibake`. Update the PR body Verified / Not verified block (Not verified: real phone, real admin account, joined/city_set counts rely on the RPC bodies not read).
8. Commit `fix(ambassador): link card review fixes [worker-done <ticket>]` and push ONCE (not [skip preview]).

## Files
- src/modules/ambassador/link/trackerModel.ts (new; already on the branch, edit it)
- src/modules/ambassador/link/LinkCard.tsx (new; already on the branch, edit it)
- the existing tests under src/modules/ambassador

## Done when
Each finding has a test red before and green after; tsc count not higher; one push.
