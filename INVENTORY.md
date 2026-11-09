# INVENTORY: organiser area v2, slice 1a (role strip, switcher, Switch badge)

Brief: `docs/briefs/organiser-area-v2-slice1a-strip-switcher.md` (branch `brief/organiser-area-v2-shell`). Written before the code change; anchors refreshed after it.

## Three columns

| Item | Admin (`bachata-admin-11april`) | Current Website | Public |
|---|---|---|---|
| Organiser studio tabs | NOT ANCHORED: this cloud session has no access to the admin repo (add_repo refused). `components/admin/OrganiserStudio.tsx` unread. | P3 tabs Home / Events / Stats / You: `src/modules/organiser/p3/model/labels.ts:17`; tab bar `src/modules/organiser/p3/shell/P3Shell.tsx:100` | n/a |
| Team roles (Owner / Manager) | NOT ANCHORED (same): `components/admin/organiser-studio/OrganiserTeamTab.tsx` unread. | `HomeOrganiser.role: 'owner' \| 'manager'` `src/modules/organiser/shared/selfServeApi.ts:44`; role word mapping `src/modules/organiser/p3/model/strip.ts:16` | n/a |
| Flag gate (READ-ONLY) | n/a | `src/components/AnimatedRoutes.tsx:275` (`flags.organiserP3 && flags.organiserSelfServe`), `:281` (ticketing) | n/a |
| P3 shell header (extends) | n/a | before: h1 = tab name only. now: strip above it, `src/modules/organiser/p3/shell/P3Shell.tsx:105` (`<P3RoleStrip />`), strip body `:57-90` | n/a |
| Role strip (`p3-role-strip`) | n/a | `src/modules/organiser/p3/shell/P3Shell.tsx:62` | The page the strip names is the public organiser page; its name renders at `src/pages/OrganiserProfile.tsx:1068` |
| Switch control (`p3-switch-control`) | n/a | `src/modules/organiser/p3/shell/P3Shell.tsx:70` -> `P3_PATHS.youSwitch` (`src/modules/organiser/p3/shell/paths.ts`) | n/a |
| Switcher lists every page (extends) | n/a | organiser rows `src/modules/organiser/switch/index.tsx` (SwitchPage); teacher/DJ/dancer `OtherPages` same file, reads `my_roles_v1` via `src/modules/areas/home/rolesApi.ts` (`fetchMyRoles`); type `src/integrations/supabase/types.ts:15193` | n/a |
| Switch to-do badge (`switch-todo-badge`) | n/a | strip `src/modules/organiser/p3/shell/P3Shell.tsx:77`; switcher rows `src/modules/organiser/switch/index.tsx:104`; count `src/modules/organiser/p3/model/strip.ts:36,44` (from Home's Needs you, `src/modules/organiser/p3/data/home.ts` `needsOf`) | n/a |
| Labels (extends) | n/a | `src/modules/organiser/p3/model/labels.ts:20` (`L.strip`) | n/a |

## Tests cells -> anchors

S = `src/modules/organiser/p3/shell/__tests__/strip.matrix.test.tsx`, W = `src/modules/organiser/switch/__tests__/switcher.matrix.test.tsx`.

| Cell | Anchor |
|---|---|
| P1 strip names Owner + page; switch opens; no badge | S:46, S:47, S:104, W:60 |
| P2 switcher lists all pages; badge counts only OTHER pages; page with none = no badge | S:48, S:49, S:68, W:61, W:62 |
| P3 org+teacher+DJ+dancer: all listed; badge on organiser only | W:63, S:82 |
| P4 manager: strip says Manager; no owner-only control | S:51, S:118, W:98 |
| P5 claim pending: no strip, no badge; only pages held | S:54, S:125 |
| P7 caught up: no badge | S:52, W:64 |
| P12 interim seat (0 seats): nothing new | S:54, S:125 (prod: 0 interim seats) |
| P13 door + manager: Manager for that page only | S:53 |
| P14 teacher/DJ/dancer, no organiser page: listed, no strip, no badge | W:88, S:125 |
| P15 signed-out visitor: unchanged | P3 area sits behind AuthGuard (`src/modules/organiser/p3/shell/P3Routes.tsx`, `<AuthGuard>`); no change |
| J1 strip on every P3 screen | S:104 (Home, Events, Stats, You, Switch page) |
| J2 switch from every screen | S:104 (href asserted per screen) |
| J3 badge = other pages' to-dos; none = no badge | S:60, W:69 |
| J4 cancelled event drives no badge | S:55, S:56, W:65 |
| J5 flag off: nothing new | W:109 (R1 Switch); route gate `src/components/AnimatedRoutes.tsx:275` + `src/modules/organiser/p3/__tests__/flagOff.test.ts` |
| J6 teacher/DJ/dancer Home unchanged | no file under `src/modules/areas` touched; existing `src/modules/areas/__tests__/*` green |
| Shapes (0/1/many events; live/draft/paused; 1/2 pages; zero to-dos; one other page only) | S:46-56 |

## Coverage count

Tests cells in the brief: 17 (10 person types + 6 journeys + 1 shapes row). With a file:line anchor: 17 / 17.
Admin column: 0 / 2 anchored -- the admin repo is not reachable from this session (see HANDOVER). This is reported, not hidden.
