Brief-version: 2
# Brief: organiser R4, delete the old P3 and V2 organiser screens

Owner click 2026-11-19: delete the old P3 and V2 screens after the real-data walk passed (it did, walk-r4d on prod shapes; #1810 merged). Prod already runs VITE_ENABLE_ORGANISER_R4=true, so production behaviour must not change.

## What main lacks
- extends: the organiser area still carries three parallel UIs (P3 v1, V2 shell, R4) -- grep: v2Live|r4Live in src/modules/organiser/p3/shell/P3Routes.tsx
- the V2 shell and tabs are dead when R4 is on -- src/modules/organiser/p3/v2/V2Shell.tsx
- old P3 Home, Events, Stats screens and the v1 shell are dead when R4 is on -- src/modules/organiser/p3/screens/HomeScreen.tsx

## Files
src/modules/organiser/p3/shell/**
src/modules/organiser/p3/v2/**
src/modules/organiser/p3/screens/HomeScreen.tsx
src/modules/organiser/p3/screens/EventsScreen.tsx
src/modules/organiser/p3/screens/StatsScreen.tsx
src/modules/organiser/p3/dash/**
src/modules/organiser/p3/r4/**
src/lib/featureFlags.ts
e2e/**
tests/**

## Do
1. Make R4 the only organiser UI: in P3Routes drop v2Live, shellV2On, r4Live gating and all non-R4 branches (R4 routes stay exactly as they are today; routes that R4 still reuses, e.g. EventPage on events/:seriesId/all, dates, details, prices, history, door, You, Team, create, stay).
2. Delete everything that becomes unreferenced: v2/ (keep anything R4 imports, move it into r4/ or its owner), P3ShellV1, HomeScreen, EventsScreen, StatsScreen, their tests, and unused CSS. Use grep + `npx tsc --noEmit` + knip-style checks to prove each deletion is dead; do NOT delete a file anything imports.
3. Flags: remove organiserShellV2 and organiserR4 from featureFlags.ts and their uses; organiserP3 and organiserDash stay. Do not touch Vercel env. If a unit/e2e test only covered a deleted screen, delete it; if it covers a kept screen, update it (R4 on by default).
4. Never touch money paths (tickets/RefundSheet, door check-in logic) beyond import fixes.
5. Standing lines: zero bytes added to /app first load (`npm run check:bundle-budget` on main and branch; never edit perf-budgets.json or vite.config.ts); push ONCE; no run-ci.

## Acceptance
- `npm run pre-ship` green, `npm run test:unit` green, e2e list updated by name.
- 390x844 walk (mock mode) of Home, Events, a night, Tickets, Team, Compare looks identical to before.
- PR body has `## Phone QA` and `## Verified on real data` blocks (Shapes surveyed / Checks run / NOT verified lines). Class: ARC cleanup, risky only if a kept route lost its element.
