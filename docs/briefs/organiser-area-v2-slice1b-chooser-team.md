# Brief: organiser area v2, slice 1b (sign-in chooser, event-day landing, X1, Team roles)

Brief-version: 2
Branch: claude/organiser-area-v2-chooser
Repo: Website (`C:\dev\Website`)
Lane: careful as to sign-in routing (it decides where every sign-in lands). Website owns no migrations; if a DB change seems needed, STOP and report to the lead.
Parent: `C:\Users\ecual\.claude\plans\CONTRACT-organiser-area-v2.md` (section 6.1 rows 1, 2, 6, 7, 8 and 6.6 R1/R2; section 9 slice 1; amendments A4, A5, A6, A7, A8, A14)
Rulebook: `C:\Users\ecual\.claude\plans\BRIEF-organiser-area-v2.md` (Q1, Q2, Q25, Q27)
Owner answers: `C:\Users\ecual\.claude\plans\queues\f73b9c9e-3bff-4489-b855-e9ed6cbec413.md` (OPEN:11 decided: chooser marks "Live tonight"; contributor role removed; roles Owner, Manager, Door; no helper or interim-seat role)
Split: this is 1b. It WAITS for brief 1a (`organiser-area-v2-slice1a-strip-switcher.md`) to merge, because the chooser links into the switcher and the strip.
Dispatch: NOT yet. The lead lands and dispatches. Cloud workers are blocked by the org spend limit until the owner raises it.

## Goal
The sign-in chooser lists every page the person holds (organiser, teacher, DJ, dancer), on every sign-in when there are 2+ pages. A person with a live event today lands on the organiser page that holds it. Account, Help and Sign out have one clear place. The Team tab lists the roles Owner, Manager and Door only, with no contributor option. With `organiserP3` off, nothing new appears.

## Boundary
- IN: chooser, event-day landing, X1 placement, Team roles list and its copy.
- OUT: strip, switcher and badge (brief 1a). Teacher, DJ and dancer to-do Homes (arc 2). Door card on the dancer home (later slice). Database removal of the contributor role (separate admin migration).

## INVENTORY first (rule 1)
Before any code change, write `INVENTORY.md` at the repo root of the branch with three columns and file:line for each:
- Admin: the Team roles and Access UI that exist today (the admin repo's organiser Access tab).
- Current Website: every file under "What main lacks".
- Public: `src/pages/OrganiserProfile.tsx` (the public page the chooser's organiser entry opens).
End INVENTORY.md with a coverage count: cells in "Tests" and how many have a file:line anchor. Any cell without an anchor is a stop.

## What main lacks
Each bullet is checked against origin/main at draft time. `extends:` marks a change to a file that already exists on main. Other bullets name a grep token that must be absent from main.

- extends: The sign-in chooser lists organiser and dancer sides only, with no teacher or DJ entry -- src/components/account/profiles/ContinueAsPage.tsx
- The sign-in chooser has no "Live tonight" mark on a page with a live event -- grep: Live tonight
- There is no event-day landing rule that sends a sign-in to the page holding a live event -- grep: eventDayLanding
- extends: The Team copy and counts mention a contributor role -- src/modules/organiser/edit-in-place/EditInPlaceLayer.tsx
- extends: Sign out sits only in the P3 settings sheet, with no Account, Help and Sign out placement for the area -- src/modules/organiser/p3/onboarding/SettingsSheet.tsx
- No Team roles list shows Owner, Manager and Door as the only roles -- grep: teamRoleDoor

## Files
src/components/account/profiles/ContinueAsPage.tsx
src/lib/accountRouting.ts
src/modules/organiser/edit-in-place/EditInPlaceLayer.tsx
src/modules/organiser/edit-in-place/__tests__/TeamPicker.test.tsx
src/modules/organiser/p3/onboarding/SettingsSheet.tsx
src/components/account/profiles/__tests__/chooser.matrix.test.tsx (new)
src/lib/__tests__/accountRouting.eventDay.test.ts (new)

READ-ONLY (not edited): `src/components/AnimatedRoutes.tsx` lines 227 and 272-281 (the flag gate and the continue route).

## Design rules
- The chooser shows for anyone with 2+ pages, on every sign-in (Q1, A5), including a second sign-in the same day.
- Event-day landing (Q2, A4): a sign-in on the day of a live event goes to the organiser PAGE that holds it. If two live pages exist, the chooser shows with "Live tonight" on each (OPEN:11 decided).
- Team roles list: Owner, Manager and Door only. No contributor option, no helper or interim-seat option (OPEN:7 decided: none). Door is the per-event door role (Q25). Door people are never shown with sales or money.
- Account, Help and Sign out: one place per area, reachable from every screen in the area (X1).
- Every new element sits behind the existing flag pair; flag off = today's sign-in landing and screens (A8).
- Tap targets 44 px; px sizes (defect 8).
- No copy that names a control not on screen; a disabled control says why.

## Tests (table-driven; red first against current code)
Person types x journeys. Every R cell is one test; R* cells use seeded accounts and say so in the PR.
- P1 organiser, 1 page, owner: one page = straight in; no chooser (A1, A3).
- P2 organiser, 2+ pages (seeded): chooser on every sign-in, including a second sign-in the same day (A5); live-event day lands on that page (A2, A4); two live pages show the chooser with "Live tonight" on both.
- P3 organiser + teacher + DJ + dancer (3 prod accounts): chooser lists all four kinds; each opens its working area (A5, B3).
- P4 manager (seeded): chooser and landing as P2 for the manager's pages.
- P5 claim pending: no organiser entry; the chooser shows only the pages it holds.
- P6 unfinished dancer: the dancer area is its own; the chooser still lists it (A12).
- P7 caught-up organiser: lands on the page; no chooser when it is the only page.
- P12 interim seat (0 seats): nothing new appears (OPEN:7 decided).
- P14 teacher/DJ/dancer with no organiser page: chooser lists their pages; teacher and DJ entries open their areas.
- P15 signed-out visitor: sign-in unchanged; a door or short link returns to the link, never leaking the event (A14).
- Team roles (R1, R2): Owner, Manager and Door only; a manager cannot do owner-only actions; no contributor option anywhere (the copy and counts).
- X1: Account, Help and Sign out reachable from every screen of the area.
- Flag off (A8): today's sign-in landing and no new elements.
- Regression (A6): teacher, DJ and dancer Home render unchanged (snapshot) for P3 and P14.
Shapes: 0 events, 1 event, many events; live and draft pages; one and two pages; a live event today versus none; a live event on a page the person does not own.

## Walks (390x844, prod-shaped where possible; seeded accounts named in the PR)
1. One page, no event today: straight in.
2. Two pages (seeded), no event today: chooser on sign-in; choosing opens each page.
3. Two pages (seeded), live event today on one: lands on that page; the other page shows no mark.
4. Two live pages today (seeded): chooser with "Live tonight" on both.
5. Teacher, DJ and dancer entries open their areas.
6. Team tab: Owner, Manager and Door roles only; no contributor.
7. Account, Help and Sign out reachable; flag off shows today's screens.
8. Fit at 390 with no sideways scroll; taps at least 44 px.

## Gates
- INVENTORY.md first, coverage count at the end.
- Tests red first, then green.
- Every CI job step of the Website PR run locally (read `.github/workflows`).
- Walks 1-8 at 390x844, screenshots attached to the PR.
- Independent review by a different worker before the owner sees anything.
- Wait for brief 1a to merge before dispatch.
- Stop and report if any cell needs a DB change.

## Verified / Not verified (in the PR body)
Verified on origin/main 2026-11-09: the chooser has organiser and dancer sides (`ContinueAsPage.tsx`, `side.kind`); no "Live tonight" token exists; no event-day landing token exists; continue route and flag gate (`AnimatedRoutes.tsx` 227, 275, 281); the sign-out token sits in `SettingsSheet.tsx`; the contributor copy sits in `EditInPlaceLayer.tsx` (91, 117).
Not verified: the full side list in `ContinueAsPage.tsx` (worker confirms before building); the teacher and DJ entry routes; all walks; P2, P4, P12, P14 shapes (seeded only).
