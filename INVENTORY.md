# INVENTORY: organiser area v2, slice 1c (Add a profile card)

Written before any code change was committed (rule 1). Checked against origin/main `f096f60` (slice 1a merged), 2026-11-09.

## Data source (proved first)
`my_roles_v1` body, read-only on prod (`pg_get_functiondef`, 2026-11-09). Returns `(role, active, complete)` per role:

| Role | Says "held" | Who writes it |
|---|---|---|
| dancer | `_dancer_profile_id_for_account_v1(auth.uid())` is not null | the dancer setup (`/app/welcome`) and admin linking |
| organiser | `entity_members` row, `entity_type='organiser'`, `member_role in (owner, manager)`, organiser `lifecycle_status not in (archived, rejected)` | the add-a-page / claim flow, admin approval |
| teacher | `person_roles.role='teaching' and is_active` on the dancer profile | the wizard's "Do you teach?" step (`DoYouSheet`), admin |
| DJ | `person_roles.role='djing' and is_active` on the dancer profile | the wizard's "Do you DJ?" step (`DoYouSheet`), admin |

Read in this repo at `src/modules/areas/home/rolesApi.ts:41` (`fetchMyRoles`), cached under `myRolesQueryKey` (`rolesApi.ts:20`), the same query slice 1a's Other pages reads (`src/modules/organiser/switch/index.tsx:38`).

## Three columns

| Role | Admin (how admin creates / links) | Current Website (entry for this card) | Public (what the profile becomes) |
|---|---|---|---|
| Organiser | NOT VERIFIED: `bachata-admin-11april` is not reachable from this session (add_repo: no access). Prod writes land in `entity_members` / `organiser_profiles` (my_roles_v1 body above). | `P3_SURFACE.addPage = P3_PATHS.youAdd` `src/modules/organiser/p3/you/surface.tsx:86` -> route `src/modules/organiser/p3/shell/P3Routes.tsx:107` (`AddPageScreen`). R1 twin: `src/modules/organiser/shell/surface.tsx:41` (`?add=1`, handled `src/modules/organiser/home/index.tsx:103`). Pending claim state: `src/modules/organiser/home/ClaimNotice.tsx`, read through `fetchMyAccessRequests` `src/modules/organiser/shared/selfServeApi.ts:87`. | `src/pages/OrganiserProfile.tsx`; paid tickets via `you/get-paid` `src/modules/organiser/p3/shell/youTickets.tsx:23` (behind `organiserTicketing`). |
| Teacher | NOT VERIFIED (admin repo unreachable). Prod writes land in `person_roles` ('teaching'). | `AREA_PATHS.teacher` `src/lib/areaPaths.ts:4` -> `AreaRoutes.tsx:28` -> `RoleAreaPage` not-added card `src/modules/areas/shared/RoleAreaPage.tsx:67`, whose Add opens the existing `DoYouSheet` (`RoleAreaPage.tsx:83`). Same action Your areas uses (`areaAction`, `src/modules/areas/home/areaStatus.ts:86`). | `src/pages/TeacherProfile.tsx`, listed in `src/pages/Teachers.tsx` (students find teachers there). |
| DJ | NOT VERIFIED (admin repo unreachable). Prod writes land in `person_roles` ('djing'). | `AREA_PATHS.dj` `src/lib/areaPaths.ts:5` -> same `RoleAreaPage` / `DoYouSheet` path as teacher. | `src/pages/DJProfile.tsx` (contact panel `DJProfile.tsx:418`), listed in `src/pages/DJs.tsx`. |
| Dancer | NOT VERIFIED (admin repo unreachable). | `APP_WELCOME_PATH` `src/lib/accountRouting.ts:240` (the dancer setup; also where an incomplete dancer is sent, `accountRouting.ts:364`). | Dancer app Nights / Home from the going list (`src/modules/dancer-app/screens/nights/NightsScreen.tsx:36`). |

Other reads: onboarding `src/modules/organiser/p3/onboarding/OnboardingFlow.tsx:421` (`onFullClaim` -> `P3_PATHS.youAdd`, the same organiser entry); `ContinueAs` route `src/components/AnimatedRoutes.tsx:227`.

Flag gate: `flags.organiserP3 && flags.organiserSelfServe` `src/components/AnimatedRoutes.tsx:275` mounts the P3 area; the card renders only when `useOrgSurface().kind === 'p3'` (`src/modules/organiser/switch/index.tsx:132`), so R1 Switch (flag off) is unchanged.

Preference store re-check: no per-viewer preference mechanism exists under `src/modules/organiser` (localStorage used only for edit drafts and the organiser choice). The card uses `localStorage` key `bc.addProfile.hidden.<userId>` in try/catch (`src/modules/organiser/switch/addProfileModel.ts`).

## Prod shape survey (counts only, read-only, 2026-11-09)
dancer only 28; all four 8; dancer+organiser 6; dancer+teacher+DJ 3; organiser only 3; none 2; dancer+organiser+teacher 2; dancer+DJ 2; dancer+organiser+DJ 1.

## Tests section coverage
All cells live in `src/modules/organiser/switch/__tests__/addProfile.matrix.test.tsx`.

| Cell | Anchor |
|---|---|
| Dancer only | `PEOPLE` row 1, model + page `it.each` |
| Dancer + teacher | `PEOPLE` row 2 |
| Teacher + DJ | `PEOPLE` row 3 |
| Organiser only | `PEOPLE` row 4 |
| All roles | `All roles: nothing missing` + `All roles: no card, no Not now, no toast` |
| P6 unfinished dancer | `P6 unfinished dancer` |
| 1. tap targets per role | `1. %s row opens the existing entry` (4 cells) |
| 2. Not now / Undo / reload / other user | `2. Not now hides the card ...` |
| 3. localStorage throws | `3. localStorage throws ...` |
| 4. Flag off | `4. Flag off (R1 Switch)` |
| 5. Signed-out | `5. Signed-out visitor` |
| 6. last block, tap sizes | `6. the card is the last block ...` |

Coverage: 12 cells in the Tests section, 12 with a file anchor. The Admin column has no anchors (repo unreachable) -- reported under Not verified, not a Tests cell.
