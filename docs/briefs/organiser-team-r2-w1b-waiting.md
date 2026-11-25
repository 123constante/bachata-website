Branch: claude/organiser-team-r2-w1b-waiting
Size: 3 files, 150 lines
Brief-version: 2

# R2 W1b (Website UI): keep "Waiting to join" on the flag-ON Team list

Owner delegated all product decisions 2026-11-25 (global CLAUDE.md "I DECIDE PRODUCT TOO"). Decision is final. W1 (#2163, merged) built `R4TeamR2` (flag `organiserTeamR2`, OFF in prod) but left out today's "Waiting to join" join requests. Without it, Home's "Answer" button (which lands on Team with `?answer=<request id>`) opens nothing when the flag is ON. This PR puts it back. Door invites stay on Add someone (Door chip, next PR); do NOT add the old "Door invite link" row.

## What main lacks
- R4TeamR2 has no join requests -- grep: fetchIncomingAccessRequests (no hits in src/modules/organiser/p3/r4/R4TeamR2.tsx)
- R4TeamR2 ignores `?answer=` -- grep: useSearchParams (no hits in src/modules/organiser/p3/r4/R4TeamR2.tsx)

## Files
src/modules/organiser/p3/r4/R4Team.tsx (only: add `export` to the existing `WaitingSection` function; nothing else changes)
src/modules/organiser/p3/r4/R4TeamR2.tsx (add the block below)
src/modules/organiser/p3/r4/__tests__/r4TeamR2.matrix.test.tsx (add tests)

## What to build (flag ON, R4TeamR2 only)
Copy the exact wiring R4Team uses today (src/modules/organiser/p3/r4/R4Team.tsx, `R4Team()` body): same query (`incomingAccessRequestsQueryKey` / `fetchIncomingAccessRequests`, enabled for owner or manager viewer), same rows (`buildR4Team(...).waiting` or the smallest helper in `r4TeamModel` that yields `R4Waiting[]`), same `?answer=<id>` open-once-then-clear logic, same `Sheet` + `JoinRequestCard` (with `blockedReason` TEAM_FULL_REASON when full, `declineGate={canDecline(...)}`), same `onAnswered` -> close sheet, show the message line (role=status), and refetch people_v1 + recent changes.
1. Placement: directly under the header/"Add someone" button, ABOVE the people list (an answer is the most urgent thing on the screen).
2. Render with the exported `WaitingSection` (same testIds `r4-team-waiting`, `r4-team-waiting-row`). Nothing shown when there are no requests.
3. Request load error: today's line "We could not load join requests." + Try again (testId `r4-team-requests-error`).
4. Reuse, never copy, R4Team's helpers; if one is not exported, export it from its file (that file then counts as touched only if it is not one of the 3 above: stop and report instead of adding a 4th file).

## Prototype checklist
- [ ] Waiting to join section above the list, same rows as today
- [ ] Row tap opens the request sheet (JoinRequestCard), answer closes it, message line, list refreshes
- [ ] `?answer=<id>` opens that request once, then the param is cleared
- [ ] Team full -> blockedReason shown in the card
- [ ] Request load error line + Try again
- [ ] No "Door invite link" row

## Tests
- Flag ON: with one request, the section renders above the first `r4-team-r2-row`; tapping the row opens `r4-team-request`; `?answer=<id>` (MemoryRouter initialEntries) opens it on mount; zero requests -> no section.
- Flag OFF keep-list tests from W1 stay green.

Rule: end with a tap table (button | destination | prototype/OLD) in the PR body; any OLD row = not done. Touch nothing else; list extras in the PR body.

## Proof
tsc zero errors in touched files, vitest for the test file, PR body with the tap table. No migration.
Stop after the push and report.
