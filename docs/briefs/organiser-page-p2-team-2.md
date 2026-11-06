# Brief: organiser page P2 (Team), continuation 2

Branch: `claude/organiser-page-p2-team` (PR #1437 is open; push to the same branch, one push when done).
Read first: `docs/handover/organiser-page-p2-team.md` on that branch (what is done, what is left) and `docs/briefs/organiser-page-p2-team.md` (v4 scope).

## Do, in order
1. Team sheet list with Hide / Show buttons, exactly as the handover's "Left" item 1 describes. Controls only where `canSetHidden()` says so. Hidden-read error shows "Couldn't check who is hidden. Try again" and no controls.
   Design decision (lead, recorded): managers and the person themself get the control through the same Team sheet; the sheet opens from the Team card for owner, admin, manager and the self arm. Do not widen it further.
2. Write `docs/design/organiser-page-p2-team.md` with the Step 0 coverage table (ACCEPTANCE s1 Team, J3, J7, E11, s6 Team states).
3. Shape survey detail (owners / managers / listed split, seats on inactive rows) read-only on prod, counts only, into the PR body.
4. Table-driven tests: every caller x target x action on the sheet, red first.

## Limits
Website only, no database change, no `scripts/`, no `.github/`. Do not touch the Next/Past nights cards (separate branch `claude/organiser-nights-cards`). Do not resize anything on the organiser page.
Hard limits as in every worker prompt. Early checkpoint push after item 1; handover file if you stop before item 4.
