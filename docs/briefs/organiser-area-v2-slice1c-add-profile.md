# Brief: organiser area v2, slice 1c (Add a profile row in the switcher sheet)

Brief-version: 2
Branch: claude/organiser-area-v2-addprofile
Repo: Website (`C:\dev\Website`)
Lane: careful as to the flag gate and the switcher. Website owns no migrations; if a DB change seems needed, STOP and report to the lead.
Parent: `C:\Users\ecual\.claude\plans\CONTRACT-organiser-area-v2.md` (section 6.1)
Prototype (look B picked): https://claude.ai/artifact/AXrKLXiAydvMxG367Mr7Pp
Split: 1a = `organiser-area-v2-slice1a-strip-switcher.md` (strip, switcher, badge). 1c = this brief. 1c WAITS for 1a to merge (shares the switcher file `src/modules/organiser/switch/index.tsx`). Dispatch only after 1a is on main; re-run the "What main lacks" checks then.
Dispatch: NOT yet. The lead lands and dispatches.

## Standing header lines (dispatch-checklist, Website)
- Prove the data source first. Before building the reader, read `my_roles_v1` (RPC body, read-only on prod) and state which table/column says a person holds teacher, DJ, organiser or dancer, and who writes it. The missing roles come from that one source.
- Zero bytes to the /app first load. Run `npm run check:bundle-budget` on main and on the branch; the PR adds 0 bytes to dancer-app first load. Never edit `perf-budgets.json` or `vite.config.ts`. Keep the new code inside the organiser module chunk.
- Overlay geometry. The switcher sheet and the Hidden toast are portalled to `document.body`; opening them must not scroll the page (`focus({ preventScroll: true })`); an e2e at 390x844 with a flowing clock asserts the sheet, the add card and the toast boxes sit inside the viewport.
- Push rule: commit locally as often as needed; PUSH ONCE per slice, when coherent and tests ran; never push work in progress; never add `run-ci` yourself. A fix round after review is one more push.
- Stopping rule: one independent review, one fix round, then the orchestrator walk. A third round needs a stated reason.
- Dispatch guards: this brief carries `Brief-version: 2`; "What main lacks" and "Files" are checked against main and open PRs before anything is claimed.
- PR body (Website): write the exact skeleton from the worker prompt and check it with the repo's own scripts; a UI PR needs sizes, walked, phone-not-verified.
- Design record: a UI PR carries `docs/design/<pr>.md` (look B chosen; alternatives A and C in two lines each, from the prototype) linked in the PR body.

## Goal
At the bottom of the switcher sheet, a dashed outline card "Add a profile" lists only the roles the person does not hold, each with one benefit line, opens the EXISTING claim/create flow on tap, and can be hidden with "Not now" (remembered per person). With `organiserP3` off, nothing new appears.

## Boundary
- IN: the add card, its missing-roles model, the Not now memory, the flag gate, tap routing to existing screens.
- OUT: any new claim/create form or route; the strip, badge, chooser (1a, 1b); any DB change.

## Decisions (owner/lead, final)
- Shown to EVERYONE with at least one missing role. Lists ONLY roles the person lacks, from teacher, DJ, organiser, dancer. A person holding all four sees no card and no Not now.
- Benefit lines, exact: Organiser "Get paid for tickets"; Teacher "Be found by students"; DJ "Get booked as a DJ". Dancer (when missing, e.g. P6 unfinished dancer): the worker proposes one line in the design record, same tone, no promise the app does not keep.
- Look B: dashed outline card, heading "Add a profile", one row per missing role (dashed plus tile, bold label, benefit line, chevron), 56 px rows, text 14 px minimum, then a "Not now" text button (44 px tap) under the card.
- Tap opens the existing flow (find the exact entry in INVENTORY; known on main: organiser = `addPage` in `src/modules/organiser/shell/surface.tsx` line 41, i.e. `ORG_PATHS.home?add=1` handled in `src/modules/organiser/home/index.tsx` line 103; dancer = `APP_WELCOME_PATH` in `src/lib/accountRouting.ts` line 240). For teacher and DJ find the existing create/claim entry the Welcome / onboarding screens use. If a role has NO existing entry, STOP and report to the lead; do not invent a form.
- Not now: hides the whole card, shows a toast "Hidden. We will remember this." with Undo. Memory is per person, per browser: no per-viewer preference store exists on main under `src/modules/organiser` (checked 2026-11-09; localStorage is used only for edit drafts), so use `localStorage` key `bc.addProfile.hidden.<userId>` wrapped in try/catch (storage can throw or be empty; the card must still render, shown, if it does). Re-check for an existing preference mechanism before building; if one exists, use it and say which. Per-viewer convenience only.
- Flag: the same pair as slice 1a (`flags.organiserP3 && flags.organiserSelfServe`, AnimatedRoutes lines 275, 281). Flag off = today's screens.

## INVENTORY first (rule 1)
Before any code change, write `INVENTORY.md` at the repo root of the branch with three columns and file:line for each:
- Admin: how admin creates or links a teacher, DJ and organiser profile (`bachata-admin-11april` organiser studio and profile tabs).
- Current Website: the switcher (`switch/index.tsx`), `surface.tsx` addPage, `ClaimNotice.tsx`, `onboarding/OnboardingView.tsx`, `ContinueAsPage.tsx`, `accountRouting.ts` entry paths for each of the four roles, `my_roles_v1` use, the flag gate.
- Public: how each role's public page appears once created (`src/pages/OrganiserProfile.tsx` and the teacher and DJ pages), so the benefit lines are true.
End INVENTORY.md with a coverage count: cells in the Tests section and how many have a file:line anchor. Any cell without an anchor is a stop.

## What main lacks
Each bullet is checked against origin/main at draft time (2026-11-09; re-check when 1a has merged). `extends:` marks a change to a file that already exists on main.

- extends: The switcher has no Add a profile card, only an Add a page link -- src/modules/organiser/switch/index.tsx
- There is no add-a-profile card component -- grep: add-profile-card
- There is no missing-roles model (which of teacher, DJ, organiser, dancer the person lacks) -- grep: missingRoles
- There is no Not now memory for the add card -- grep: addProfileHidden
- There is no Hidden toast with Undo for the card -- grep: add-profile-undo

## Files
INVENTORY.md (new)
docs/design/add-profile-row.md (new)
src/modules/organiser/switch/index.tsx
src/modules/organiser/switch/AddProfileCard.tsx (new)
src/modules/organiser/switch/addProfileModel.ts (new, holds missingRoles and the Not now memory)
src/modules/organiser/switch/__tests__/addProfile.matrix.test.tsx (new, includes the Not now cells)

READ-ONLY (not edited): the flag gate in AnimatedRoutes, the addPage link in the organiser shell surface, APP_WELCOME_PATH in accountRouting, `my_roles_v1` in the generated types.

## Design rules
- One shared model `missingRoles(held)` returns the ordered missing list (organiser, teacher, DJ, dancer). The card, the toast logic and the tests all use it; no second copy.
- A role the person holds is never offered. A pending organiser claim counts as held (P5 shows no duplicate offer; the existing claim screen owns that state).
- Tap targets 44 px minimum, explicit px sizes (html font-size is about 13.5px on phones). Contrast 4.5 or better in light and dark.
- Copy: no text points at a control that is not on screen; the empty state is no card at all.
- Look B is decided; nothing to ask the owner.

## Tests (table-driven; red first against current code)
One shared mapping from held roles to the rows shown. Every cell is one test.
Person type x missing-role shape:
- Dancer only: card lists Organiser, Teacher, DJ (three rows, benefit lines exact).
- Dancer + teacher: lists Organiser, DJ.
- Teacher + DJ: lists Organiser, Dancer.
- Organiser only: lists Teacher, DJ, Dancer.
- All roles: no card, no Not now, no toast.
- P6 unfinished dancer (dancer profile not finished): Dancer is offered; its tap goes to the dancer setup (`APP_WELCOME_PATH`), not a second profile.
Behaviour cells:
1. Each row's tap navigates to the existing entry (assert the target path per role).
2. Not now hides the card and shows the toast; Undo restores it; reload keeps it hidden for that user; another user on the same browser still sees it.
3. localStorage throws: card renders, Not now works for the session only, no crash.
4. Flag off: no card for any person type.
5. Signed-out visitor: unchanged.
6. Card is the last block above Account and help; no sideways scroll at 390.
Shapes: 1, 2, 3 missing roles; hidden vs not; storage available vs throwing; light and dark.

## Walks (390x844, prod-shaped where possible; seeded accounts named in the PR)
1. Dancer-only account: sheet shows the dashed card with three rows; tap each row, land on the existing screen, Back returns.
2. Dancer + teacher: two rows only.
3. Organiser-only: Teacher, DJ, Dancer rows.
4. Not now: toast shows, Undo works, reload stays hidden.
5. All-roles account (read-only walk): no card.
6. Flag off: today's switcher, nothing new.
7. Card, rows and toast fit 390 with no sideways scroll; taps at least 44 px; dark mode contrast.
Screenshots attached to the PR.

## Gates
- INVENTORY.md first, coverage count at the end.
- Tests red first, then green.
- Every CI job step of the Website PR run locally (read `.github/workflows`), including `npm run check:bundle-budget`.
- Independent review by a different worker before the owner sees anything.
- Stop and report if any role has no existing claim/create entry, or any cell needs a DB change.

## Verified / Not verified (in the PR body)
Verified on origin/main 2026-11-09: `addPage` = `${ORG_PATHS.home}?add=1` (`shell/surface.tsx` 41); the `add=1` handler (`home/index.tsx` 103); `APP_WELCOME_PATH` (`accountRouting.ts` 240); the switcher has no add card (`switch/index.tsx`, only an Add a page link); no per-viewer preference store under `src/modules/organiser`.
Not verified: the teacher and DJ create/claim entries (worker finds them in INVENTORY); the dancer benefit line; the `my_roles_v1` shape for each held-role case; all walks; seeded shapes.
