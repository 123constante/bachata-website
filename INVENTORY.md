# INVENTORY: organiser area v2, slice 1b (chooser, event-day landing, X1, Team roles)

Branch `claude/organiser-area-v2-chooser`, brief `docs/briefs/organiser-area-v2-slice1b-chooser-team.md`
(brief branch, sha 26691a7). Written before the code change; anchors refreshed to the branch head.

## Three columns

| Item | Admin (admin repo, organiser Access tab) | Current Website (before -> after) | Public (`src/pages/OrganiserProfile.tsx`) |
|---|---|---|---|
| Team roles | NOT ANCHORED to a file: this session cannot reach `bachata-admin-11april` (add_repo refused). DB fact instead: `entity_members.member_role` CHECK = owner, manager, contributor, ambassador (prod read 2026-11-09); organiser rows: 20 owner, 43 manager, 0 contributor. No door seat exists. | Before: `src/modules/organiser/shared/teamModel.ts:64` ROLE_LABEL (Owner/Manager/Contributor), `:189` ADD_ROLES (manager, contributor); `src/modules/organiser/shared/selfServeErrors.ts:356` ROLE_HELP names contributors. After (P3 only): `src/modules/organiser/edit-in-place/teamRoles.ts:31` TEAM_ROLES (Owner, Manager, Door), `:24` teamRoleDoor, `:38` P3_ADD_ROLES | Not shown (public Team list is people, not seat roles): `src/pages/OrganiserProfile.tsx:525` route param, `:527` slug/id resolve |
| Team copy and counts | as above | Before: `src/modules/organiser/edit-in-place/EditInPlaceLayer.tsx:91` comment, `:117` count line with contributor. After: `EditInPlaceLayer.tsx:122` p3TeamCountLine (owner, manager), `TeamSheet.tsx:86` addRoles, `TeamSheet.tsx:266` disabled Door + reason | n/a |
| Chooser sides | n/a | Before: `src/components/account/profiles/ContinueAsPage.tsx:63` organiser + dancer only (`src/lib/accountRouting.ts:352` ProfileSide). After: `ContinueAsPage.tsx:46` areaPagesOf (teacher, DJ), `:67` ContinueAsLive, `:142` area entries | The chooser's organiser entry opens the organiser AREA (`/account/p3`), not this public page: `OrganiserProfile.tsx:1388` |
| Live tonight mark | n/a | Before: absent (grep `Live tonight` empty on main). After: `src/lib/accountRouting.ts:447` LIVE_TONIGHT, `:467` liveTonightIds (rule = `src/modules/organiser/shared/homeModel.ts:88` attentionItems 'tonight'), `ContinueAsPage.tsx:133` | n/a |
| Event-day landing | n/a | Before: absent (grep `eventDayLanding` empty). After: `src/lib/accountRouting.ts:495` eventDayLanding over `:419` signInLanding | n/a |
| Account / Help / Sign out (X1) | n/a | Before: `src/modules/organiser/p3/onboarding/SettingsSheet.tsx` sign-out only. After: `SettingsSheet.tsx:13` X1_COPY, `:72` one block (Account settings, Help mailto, Sign out). Reached from `src/modules/organiser/p3/screens/GraceBanner.tsx:77` and `src/modules/organiser/p3/onboarding/OnboardingFlow.tsx:66` only -- NOT every screen (see handover) | n/a |
| Flag gate | n/a | READ-ONLY `src/components/AnimatedRoutes.tsx:227` (`p3Live = organiserP3 && organiserSelfServe`); `ContinueAsPage.tsx:87` ContinueAsToday (flag off: no new reads); `EditInPlaceLayer.tsx:92` p3Roles = flags.organiserP3 | n/a |

## Tests (brief cell -> file:line)

| Cell | Anchor |
|---|---|
| P1 one page, straight in | `src/lib/__tests__/accountRouting.eventDay.test.ts:50`; `src/components/account/profiles/__tests__/chooser.matrix.test.tsx:75` |
| P2 chooser every sign-in, second same day | `accountRouting.eventDay.test.ts:56`; `chooser.matrix.test.tsx:77`, `:109` |
| P2 live day lands on that page | `accountRouting.eventDay.test.ts:62`; `chooser.matrix.test.tsx:78` |
| P2 two live pages, Live tonight on both | `accountRouting.eventDay.test.ts:65`; `chooser.matrix.test.tsx:79` |
| P3 all four kinds, each opens its area | `accountRouting.eventDay.test.ts:78`, `:81`; `chooser.matrix.test.tsx:81` |
| P4 manager | `accountRouting.eventDay.test.ts:70`; `chooser.matrix.test.tsx:80` |
| P5 claim pending | `accountRouting.eventDay.test.ts:91`; `chooser.matrix.test.tsx:83` |
| P6 unfinished dancer | `accountRouting.eventDay.test.ts:95`; `chooser.matrix.test.tsx:84` |
| P7 caught-up organiser | `accountRouting.eventDay.test.ts:53`; `chooser.matrix.test.tsx:76` |
| P12 interim seat | `accountRouting.eventDay.test.ts:98`; `chooser.matrix.test.tsx:85` |
| P14 teacher/DJ/dancer, no organiser page | `accountRouting.eventDay.test.ts:84`, `:87`; `chooser.matrix.test.tsx:82` |
| P15 returnTo wins (A14) | `accountRouting.eventDay.test.ts:101` |
| Live event on a page not held | `accountRouting.eventDay.test.ts:73`; `chooser.matrix.test.tsx:120` |
| Shapes 0 / 1 / many events, live vs draft, cancelled, archived | `accountRouting.eventDay.test.ts:144` (parity with homeModel attentionItems) |
| Loading / failed reads | `accountRouting.eventDay.test.ts:104`, `:109`, `:150` |
| Team roles R1/R2 (Owner, Manager, Door; manager no owner-only action; no contributor) | `src/modules/organiser/edit-in-place/__tests__/TeamPicker.test.tsx:312`, `:328`, `:310` |
| X1 Account, Help, Sign out | `chooser.matrix.test.tsx:153` |
| Flag off (A8) | `accountRouting.eventDay.test.ts:121`; `chooser.matrix.test.tsx:136`; `TeamPicker.test.tsx:338` |
| Regression A6 (teacher/DJ/dancer Home snapshot) | NO ANCHOR -- not written (those Homes are not touched by this diff) |

Coverage: 19 cells in "Tests"; 18 have a file:line anchor. The A6 regression snapshot cell and the
Admin column have no file anchor: both are stops recorded in `docs/handover/organiser-area-v2-slice1b.md`.
