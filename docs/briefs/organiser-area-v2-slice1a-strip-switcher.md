# Brief: organiser area v2, slice 1a (role strip, switcher, Switch badge)

Brief-version: 2
Branch: claude/organiser-area-v2-shell
Repo: Website (`C:\dev\Website`)
Lane: careful as to the flag gate and the strip on every P3 screen. Website owns no migrations; if a DB change seems needed, STOP and report to the lead.
Parent: `C:\Users\ecual\.claude\plans\CONTRACT-organiser-area-v2.md` (section 6.1 rows 1-5, section 9 slice 1; amendments A4, A6, A8, A12, A13, A14)
Rulebook: `C:\Users\ecual\.claude\plans\BRIEF-organiser-area-v2.md` (Q1, Q3, Q4, Q5)
Owner answers: `C:\Users\ecual\.claude\plans\queues\f73b9c9e-3bff-4489-b855-e9ed6cbec413.md`
Split: 1a = this brief (strip, switcher, badge). 1b = `organiser-area-v2-slice1b-chooser-team.md` (chooser, landing, X1, Team roles). 1b WAITS for 1a to merge.
Dispatch: NOT yet. The lead lands and dispatches. Cloud workers are blocked by the org spend limit until the owner raises it.

## Goal
One role-coloured strip that names the role and the page, one switcher listing every page the person holds, and a Switch badge that counts to-dos on OTHER organiser pages only. With `organiserP3` off, nothing new appears.

## Boundary
- IN: strip, switcher, badge, and their flag gate.
- OUT (1b): sign-in chooser, event-day landing, X1 Account/Help/Sign out, Team roles list, contributor copy.
- OUT (arc 2): teacher, DJ and dancer to-do Homes. No badge on those pages in this slice.

## INVENTORY first (rule 1)
Before any code change, write `INVENTORY.md` at the repo root of the branch with three columns and file:line for each:
- Admin: the organiser studio tabs and team roles (`bachata-admin-11april/components/admin/OrganiserStudio.tsx`, `.../organiser-studio/OrganiserTeamTab.tsx`).
- Current Website: every file under "What main lacks" and the flag gate.
- Public: `src/pages/OrganiserProfile.tsx` (what the public page shows for the strip's page).
End INVENTORY.md with a coverage count: cells in this brief (section "Tests") and how many have a file:line anchor. Any cell without an anchor is a stop.

## What main lacks
Each bullet is checked against origin/main at draft time. `extends:` marks a change to a file that already exists on main. Other bullets name a grep token that must be absent from main.

- extends: The P3 shell header shows only the tab name, with no role word and no page name -- src/modules/organiser/p3/shell/P3Shell.tsx
- extends: The P3 tab labels have no Tickets or Team tab; the People tab is called You -- src/modules/organiser/p3/model/labels.ts
- There is no role strip carrying a role word and a page name -- grep: p3-role-strip
- There is no Switch control inside the strip -- grep: p3-switch-control
- extends: The organiser switcher lists organiser pages only, not every page the person holds -- src/modules/organiser/switch/index.tsx
- There is no Switch to-do badge -- grep: switch-todo-badge

## Files
INVENTORY.md (new)
src/modules/organiser/p3/shell/P3Shell.tsx
src/modules/organiser/p3/model/labels.ts
src/modules/organiser/switch/index.tsx
src/modules/organiser/p3/shell/__tests__/strip.matrix.test.tsx (new)
src/modules/organiser/switch/__tests__/switcher.matrix.test.tsx (new)

READ-ONLY (not edited): `src/components/AnimatedRoutes.tsx` lines 272-281 (the flag gate `flags.organiserP3 && flags.organiserSelfServe`), `src/integrations/supabase/types.ts` (`my_roles_v1`, read via the existing areas code path).

## Design rules
- Read the person's pages from `my_roles_v1` (existing RPC); no new RPC.
- The badge counts open to-dos on organiser pages other than the one open. Cancelled events never count (contract defect 4). Teacher, DJ and dancer pages never show a badge.
- Role word is Owner or Manager only. No contributor word anywhere (the contributor role is removed; the UI hides it).
- Every new element sits behind the existing flag pair; flag off = today's screens, old routes still work (cell A8).
- Tap targets 44 px; use px sizes (defect 8).
- Copy: no control named that is not on screen; a disabled control says why.

## Tests (table-driven; red first against current code)
One shared mapping for who-can-do-what on the strip and switcher. Every R cell is one test; R* cells use seeded accounts and say so in the PR.
Person types x cells:
- P1 organiser, 1 page, owner: strip names Owner and the page; switch control opens the switcher; no badge.
- P2 organiser, 2+ pages (seeded): switcher lists all pages; badge counts only the OTHER pages' to-dos; a page with no to-dos shows no badge.
- P3 organiser + teacher + DJ + dancer (3 prod accounts): switcher lists organiser, teacher, DJ and dancer pages; badge only on organiser pages; no badge on teacher, DJ or dancer entries.
- P4 manager (seeded): strip says Manager; no owner-only control shown.
- P5 claim pending: no organiser page, no strip, no badge; the switcher shows only pages it holds.
- P7 caught-up organiser: no badge when nothing is waiting.
- P12 interim seat (0 seats): nothing new appears (OPEN:7 decided: none).
- P13 door + manager (seeded): strip shows Manager for that page only; door rights never shown here.
- P14 teacher/DJ/dancer with no organiser page: switcher lists their pages; no strip; no badge.
- P15 signed-out visitor: unchanged.
Journeys:
1. Strip on every P3 screen names role and page (A1, A6).
2. Switch from every screen, incl. scanner and cancel sheet placeholders (B1, B2).
3. Badge counts other organiser pages' to-dos; none = no badge (B4, B5).
4. Cancelled event drives no badge (E15).
5. Flag off: no strip, switch control, badge or entry for any person type (A8).
6. Regression: teacher, DJ and dancer Home render unchanged (snapshot), P3 and P14 (A6).
Shapes: 0 events, 1 event, many events; live, draft, paused page; one page, two pages; zero to-dos; to-dos on one other page only.

## Walks (390x844, prod-shaped where possible; seeded accounts named in the PR)
1. Owner, 1 page: strip shows Owner and the page name; switch opens.
2. Owner, 2+ pages (seeded): switcher lists all pages; badge on the other page only.
3. Teacher, DJ and dancer entries open their areas; no badge on them.
4. Manager (seeded): strip says Manager.
5. Flag off: today's screens, nothing new.
6. Strip and switcher fit 390 with no sideways scroll; taps at least 44 px.

## Gates
- INVENTORY.md first, coverage count at the end.
- Tests red first, then green.
- Every CI job step of the Website PR run locally (read `.github/workflows`).
- Walks 1-6 at 390x844, screenshots attached to the PR.
- Independent review by a different worker before the owner sees anything.
- Stop and report if any cell needs a DB change.

## Verified / Not verified (in the PR body)
Verified on origin/main 2026-11-09: P3 tab labels (`labels.ts`, `tabs:` line 17); the switcher is organiser-only (`switch/index.tsx`, `OrganiserSwitcher`); the flag gate (`AnimatedRoutes.tsx` 275, 281); `my_roles_v1` exists (`types.ts`).
Not verified: the strip and badge components (none exist; built here); all walks; P2, P4, P13 shapes (seeded only).
