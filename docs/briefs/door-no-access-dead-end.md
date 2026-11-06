# Brief: Door "cannot check tickets" card gets a way out
Brief-version: 2
Branch: claude/door-no-access-dead-end
Lane: normal, Sonnet. bachata-website only (src/modules/organiser/p3/door/**); must not touch supabase/**, the camera code, or any calendar density-exclusion file.
Serves: a team member (or an organiser whose team row is missing) who opens the door screen and is refused; today the card is a dead end (walk claude/walk-1294-r1, dead end 1).

## What main lacks
- extends: the refused card (CANNOT CHECK TICKETS) has no control; its detail says "open this screen again" which needs a browser reload -- src/modules/organiser/p3/door/model.ts
- a "Check again" button on the refused card that re-reads the door list, so a person just added to the team gets in without reloading -- grep: door-act-recheck
- a "Back to events" link on the refused card, to the organiser Events screen -- grep: door-notallowed-back

## Files
src/modules/organiser/p3/door/DoorScreen.tsx
src/modules/organiser/p3/door/model.ts
src/modules/organiser/p3/door/__tests__/door.model.test.ts
src/modules/organiser/p3/door/__tests__/door.screen.test.tsx
src/modules/organiser/p3/door/__tests__/door.noAccess.matrix.test.tsx (new)

## What to build
0. Write INVENTORY.md first: every field, state and option from the admin app, the current Website and the public page, each with file:line. Build only after it exists and report the coverage count (covered / total) at the end.
1. On the not_allowed card (both the Scan tab and List tab renders, DoorScreen.tsx lines ~208 and ~410) show two controls: "Check again" (data-testid door-act-recheck, refetches the list; disabled with the reason "Checking..." while fetching) and "Back to events" (data-testid door-notallowed-back, Link to P3_PATHS.events). Both at least 44px high.
2. Reword the detail in model.ts so it names only controls on screen: "Ask the event's organiser to add you to their team, then tap Check again." Keep the shared RESULT_TABLE the single mapping; update door.model.test.ts rows accordingly.
3. If Check again returns ok, the card is replaced by the normal screen; if it is refused again the card stays and says nothing new (no error toast).

## Tests
Table-driven, red first (run against unfixed main to see red): shape (refused on list read, refused on a typed code, refused then ok after recheck, refused then network error on recheck, refused with 0 sold) x tab (Scan, List). Each cell asserts: both controls present, no text points at a missing control ("open this screen again" absent), recheck sends exactly one list read and no check-in write, Back link href is the Events path.

## Done when
- Matrix green; door.model and door.screen tests green; tsc clean on changed files; every applicable CI job step run.
- Walked at 390x844 on the refused shape; screenshot attached to the PR.
- PR body has a Verified / Not verified block (Not verified: a real phone, a real team change on prod).
