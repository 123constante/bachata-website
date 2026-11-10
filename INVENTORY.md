# INVENTORY: organiser area v2, slice 1b FIX round (PR #1511 review)

Branch `claude/organiser-area-v2-chooser`, brief `docs/briefs/organiser-area-v2-slice1b-fix.md` (brief branch,
sha cf43752). Continuation of slice 1b (dt_efda9feba54e, head 4617f08); main (slice 1c, #1512) merged in first.
Anchors are file:line at this branch's head. Order note: the brief asks for this file BEFORE the build; this
round wrote it alongside the build (same session, before the first push) -- said here, not hidden.

**Admin column:** `bachata-admin-11april` is not reachable from this session, so admin items are anchored to the
DB fact instead: `entity_members.member_role` CHECK = owner, manager, contributor, ambassador; organiser seats on
prod 2026-11-09 = 20 owner / 43 manager / 0 contributor (slice 1b's read-only survey). No door seat exists.

**Public column:** the public organiser page (`src/pages/OrganiserProfile.tsx`) shows the public Team as people
(`:644-649` organiser_public_team_v1 via `OrganiserTeamSection`), never seat roles, the chooser or the settings sheet.

Covered = this round changed it, or a test in this round pins it. `n/a` = that surface has no such item.

## Team person screen (`src/modules/organiser/team/Person.tsx`)

| # | Item | Admin | Current Website | Public | Covered |
|---|---|---|---|---|---|
| 1 | Role explainer | DB roles above | `:19` ROLE_EXPLAINER (R1, names contributors, `shared/selfServeErrors.ts:356`); `:22` personExplainer -> P3_ROLE_HELP (`edit-in-place/teamRoles.ts:47`); rendered `:97` | n/a | yes (p3Roles.test) |
| 2 | Role line (label, "· you") | member_role | `:94` ROLE_LABEL | n/a | yes (no contributor on prod shapes) |
| 3 | Change role (disabled, reason) | owner-only | `:99`, `:101` | n/a | yes (manager viewer cell) |
| 4 | Make Manager (contributor only) | contributor seat | `:102`, canPromote `:79` | n/a | yes (absent: 0 contributors) |
| 5 | Hand the page over | owner | `:105` | n/a | no (owner hand-over hide is NOT this PR, owner answer) |
| 6 | Leave this page / reason | manager | `:108`, `:112-113` | n/a | no (unchanged) |
| 7 | Remove / confirm / Keep / reason | owner | `:117-128` | n/a | no (unchanged) |
| 8 | States: loading / error / missing | n/a | `:83`, `:85`, `:87` | n/a | no (unchanged) |
| 9 | Error line | RPC codes | `:103` | n/a | no (unchanged) |

## Team index (`src/modules/organiser/team/index.tsx`)

| # | Item | Admin | Current Website | Public | Covered |
|---|---|---|---|---|---|
| 10 | Roles list: Owner, Manager, Door (P3 only) | DB roles; no door seat | NEW `:29` RolesCard from TEAM_ROLES (`teamRoles.ts:38`); mounted `:185` when kind p3 | n/a | yes |
| 11 | Door disabled with its reason | no door seat | `:37-40` aria-disabled + DOOR_NOT_OPEN (`teamRoles.ts:28`) | n/a | yes |
| 12 | Member rows (face, label, switch) | member_role | `:85`, `:89`, `:100`, `:116`, `:122`; label SHARED_ROLE_LABEL (`teamShared.ts:46`) | people only (`OrganiserProfile.tsx:644`) | yes (no contributor text, prod shapes) |
| 13 | Added by | added_by | `:120` | n/a | no (unchanged) |
| 14 | Join requests card / error | access requests | `:172`, RequestsError (`p3TeamBits.tsx`) | n/a | no (unchanged; teamPageName.matrix) |
| 15 | Public team toggle | n/a | `:187` | shown/hidden there | no (unchanged) |
| 16 | Add someone / reason / share link | owner+manager add | `:196-200` | n/a | no (unchanged) |
| 17 | Leave / reason | manager | `:206-211` | n/a | no (unchanged) |
| 18 | States: loading / error / no page / empty / shared read failed | n/a | `:159`, `:161`, `:164-166`, `:182`, `:183` | n/a | no (unchanged) |

## Chooser (`src/components/account/profiles/ContinueAsPage.tsx`, rules `src/lib/accountRouting.ts`, `src/lib/auth-otp-routing.ts`)

| # | Item | Admin | Current Website | Public | Covered |
|---|---|---|---|---|---|
| 19 | Roles read (my_roles_v1) retry + wait | n/a | `:80` retry 1; `:68` rolesSettled (wait while fetching) | n/a | yes (race cells) |
| 20 | Organiser entries | seats | `:131` | organiser entry opens the AREA, not this page | yes (matrix) |
| 21 | Teacher / DJ entries | n/a | `:151` | n/a | yes |
| 22 | Live tonight mark | n/a | `:140`; rule `accountRouting.ts` liveTonightIds | n/a | yes (P4 manager rows) |
| 23 | Hint | n/a | `:121` | n/a | no (unchanged) |
| 24 | Loading (wait) | n/a | `:109` | n/a | yes (race cell: no redirect while retrying) |
| 25 | Claim pending -> P3 Welcome | access request | `auth-otp-routing.ts:190` continueAsLanding | n/a | yes (P5 openRequestCount 1) |
| 26 | Flag off = today | n/a | ContinueAsToday | n/a | yes (unchanged cells) |
| 27 | Storage: none written (A5) | n/a | no storage call in ContinueAsPage | n/a | yes |

## Settings sheet (`src/modules/organiser/p3/onboarding/SettingsSheet.tsx`) and its entry

| # | Item | Admin | Current Website | Public | Covered |
|---|---|---|---|---|---|
| 28 | Entry on every P3 screen (44px) | n/a | NEW `p3/shell/P3Shell.tsx:77` AccountEntry on the role strip; `:109` bar when no strip | n/a | yes (6 screens x 0/1 page) |
| 29 | Dark mode switch | n/a | `:56-57` | n/a | no (unchanged) |
| 30 | Page name / save / message | organiser name | `:64-66` | page title | no (unchanged) |
| 31 | Account settings link | n/a | `:74` -> /account/settings | n/a | yes |
| 32 | Help (mailto) | n/a | `:77` | n/a | yes |
| 33 | Sign out | n/a | `:82` | n/a | yes (44px through the class) |

## Flag gate

| # | Item | Admin | Current Website | Public | Covered |
|---|---|---|---|---|---|
| 34 | Team roles pair | n/a | `edit-in-place/teamRoles.ts:16` p3RolesLive; `EditInPlaceLayer.tsx:92` default; same pair as `AnimatedRoutes.tsx:227` | edit layer lives on this page | yes (P3 on + self-serve off = today's picker) |

**Coverage: 20 / 34 items covered.** The 14 not covered are untouched by the five fixes (left as they are, by
the brief's "nothing else").
