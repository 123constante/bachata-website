# P3 acceptance: FLIP-READINESS

Brief: `docs/briefs/p3-flip-readiness.md` (branch `brief/p3-flip-readiness`). Question: is the
owner-approved flip of `organiserP3` (`VITE_ENABLE_ORGANISER_P3`, `src/lib/featureFlags.ts:67`;
the new area `/account/p3` goes live and the old area `/account/o` retires) safe TODAY?

Evidence base, all read on 2026-10-31 against `origin/main` b96ada3 (#1231): every file the
[FIXLIST](FIXLIST.md) cites, the tests named below, the eight PRs merged since the audits
(#1208 #1217 #1218 #1219 #1220 #1227 #1229 #1231), CI conclusions for b96ada3, and read-only
counts from the prod project `stsdtacfauprzrdebmzg`. The admin repo (`bachata-admin-11april`,
PRs #1160 #1166 #1169) is outside this worker's reach: every row whose fix lives there is marked
ADMIN-REPO and NOT verified. No code was changed. No browser walk was run.

## Verdict: NOT READY

The flip as the brief describes it (new area live, old area retires) is **not implemented**:
not one of the six P3-LAND rows was touched by the eight PRs. With the flag on, every existing
page holder still lands in `/account/o` at every door, and `/account/o` keeps working. The flag
alone would create a second, parallel organiser area that only new organisers (0 pages) and
people who type the address reach. Owner rule R1 (F-28) is unmet, 0 of 47 WALKLIST rows has a
prod-shaped browser walk, and 26 owner decisions are unanswered, three of which decide the flip.

What IS true today, and helps:

- The server gate flag `organiser_onboarding_gate` is **false** in prod (read 2026-10-31). The
  P3 flip does not touch it. F-07 blocks turning that flag on, not turning `organiserP3` on.
- 12 FIXLIST rows are fixed with tests (F-16 F-17 F-18 F-19 F-22 F-24 F-25 F-27 F-33 F-34, plus
  the discard-error third of F-15 and the create half of F-10).
- CI on b96ada3: Unit and Contract Tests, DB Contract Check, E2E Smoke (now including the P3
  walk specs with the flags on, per #1231), Typecheck, Perf Budget, Source Integrity all green.
  CI Budget Guard and PR Mergeable Guard were red on that push (not read further here).

## Prod shape today (read-only counts, 2026-10-31)

| fact | count |
|---|---|
| `app_feature_flags.organiser_onboarding_gate` | **false** |
| claimed pages / distinct users with a claimed page | 10 / 10 |
| users with any organiser access (claimed_by or `entity_members` owner/manager) | 15 |
| `entity_members` organiser rows: owner / manager | 18 / 45 |
| claimed pages with a completed onboarding row (`organiser_onboarding_progress`) | 0 (0 rows at all) |
| claimed pages with a live series that has a future date | 4 (7 live series, 5 dates in the next 7 days) |
| live series on claimed pages with every date past (F-16 shape) | 5 |
| series with more than 100 dates (F-27 shape) | 1 |
| future dates with an active guest-list entry (F-29 shape) | 3 |
| pending `profile_claims` (F-45) | 5 |
| active legacy `organiser_team_members` rows (F-44) | 62 |
| unclaimed pages / claim emails set (F-49) | 39 / 0 |
| claimed pages whose website is a Facebook address (W-21, R3) | 1 |

The FIXLIST's "11 non-admin organisers" could not be reproduced exactly: 15 users have organiser
access and the admin exclusion was not computed. The 4 pages / 7 live upcoming series match.

## FIXLIST, row by row

Verdict words: FIXED (commit and the test that proves it), STILL OPEN (current file:line),
CHANGED (the fault moved or shrank), ADMIN-REPO (server fix; not verifiable here).
`p3/` = `src/modules/organiser/p3/`.

### P3-LAND (F-01..F-06): all STILL OPEN, none touched since the audit

| id | sev | verdict | evidence on main |
|---|---|---|---|
| F-01 | blocker | STILL OPEN | `src/lib/auth-otp-routing.ts:172-173` `organiserHomeHandoff` sends to P3 only when `organiserCount === 0`; `src/lib/accountRouting.ts:29,352,396,405` `ORGANISER_HOME_PATH = '/account/o'`; `claimSignInLanding.tsx:20`, `DancerHome.tsx:298,310`, `optionsModel.ts:42,104`, `NoProfileWayOut.tsx:5`, `areaStatus.ts:28` all `/account/o`. Tests PIN the open behaviour: `src/lib/__tests__/p3LandingWelcome.table.test.ts:92-93` ("1 page", "several pages" -> R1 with flag on), `newOrganiserLanding.test.ts:47-48`. Owner decision 1 unanswered. |
| F-02 | medium | STILL OPEN | `modules/organiser/shell/legacyPaths.ts:23-28` maps to `ORG_PATHS.*` with no flag; `components/AnimatedRoutes.tsx:241-255` `/account/new`, `/account/series/:id`, `/account/team` -> R1 regardless of `flags.organiserP3`. #1208's "old URLs keep format" is only the interim `/account/p3/new/*` -> `/account/p3/create` bridge (`p3/shell/P3Routes.tsx:54-64`). |
| F-03 | medium | STILL OPEN (one correction) | `AnimatedRoutes.tsx:258-262` `/account/o/*` -> R1 whenever `organiserSelfServe`; `OrganiserRoutes.tsx:128-153`; `pages/Account.tsx:42,56-57`; `accountRouting.ts:71-75`. Correction: `/account/series/:id` does reach R1's event page (`/account/o/events/:id`), it does not lose the event. |
| F-04 | medium | STILL OPEN | `PublicClaimCard.tsx:212` `to={ORG_PATHS.home}`; `JoinScreens.tsx:168` no-page branch `ORG_PATHS.home`; `EmailCodeProof.tsx:27` default `ORG_PATHS.home`. No test names `public-claim-go`. |
| F-05 | low | STILL OPEN | `p3/shell/paths.ts:88-89` `acceptedInviteLanding` -> `/account/p3/you/welcome?o=`; `JoinScreens.tsx:166-171` button copy `joinCopy.ts:80` "Open your organiser home". |
| F-06 | low | STILL OPEN | `p3/screens/DetailsScreen.tsx:85`, `PricesScreen.tsx:46` raw `<a href={PROFILE_WIZARD_PATH}>`; `shared/profileProgress.ts:46` `= '/account/o/complete'`. #1217 and #1229 edited both screens and left the link. |

### GATE-RETRY (F-07..F-15): nothing fixed; F-07 is moot while the server flag stays off

| id | sev | verdict | evidence on main |
|---|---|---|---|
| F-07 | blocker | ADMIN-REPO; client has no grace at all | `p3/onboarding/graceModel.ts:48` "No grace end date exists on the server yet". No `scripts/check-*.mjs` names `_require_onboarding_complete_v1`. Prod: gate flag false, 0 onboarding rows, 4 pages with live upcoming dates would be stopped the day it turns on. Owner decision 2. **Not a blocker for the P3 flip while `organiser_onboarding_gate` stays false; a blocker for that flag.** |
| F-08 | high | STILL OPEN | `p3/screens/GraceBanner.tsx:67` "Until then everything works as usual" (true today only because the gate is off); `:27` no end date, failed read shows nothing (`retry: false`). Owner decision 3. |
| F-09 | high | STILL OPEN | `p3/onboarding/gate.ts:13` stores the path only to drop the sheet on navigation (`GateHost.tsx:18-25`); `GateSheet.tsx:65` Continue -> `p3StartReview`; `OnboardingFlow.tsx:130,286` exits to Home or Page; no returnTo or redo anywhere; `gate.matrix.test.tsx:386` pins "leaving closes the sheet". Owner decision 4. |
| F-10 | high | CHANGED | Create half FIXED by #1208 (4bb3e43): `p3/new/CreateFlow.tsx:228-232` refusal card with a "Finish your details" link (`useCreateSave.ts:182` `isOnboardingRefusal`); `flows/new/*` is dead for P3 (`P3Routes.tsx:58-64` redirects). Organisers half STILL OPEN: `P3Routes.tsx:90` mounts R1 `events/SeriesOrganisers.tsx:80` -> `selfServeErrors.ts:153` fixed line, not in the gate hook list (`gate.matrix.test.tsx:313-316`). Re-point the row's files. |
| F-11 | high | STILL OPEN | `p3/tickets/TypeSheet.tsx:120-121,130`, `TicketsEntry.tsx:165-167` -> `tickets/ticketModel.ts:408` "That did not work. Try again in a moment"; no `onboarding_incomplete` reason; `scripts/onboarding-write-doors.json:119-125` still "Neither gated nor guard-allow-listed". Moot while `VITE_ENABLE_ORGANISER_TICKETING` is off. |
| F-12 | medium | STILL OPEN (mitigated) | `p3/screens/RepeatSheet.tsx:146-148,167-170` preview refusal still opens the gate before Save, now at most once per sheet (`useGatedCopy({ once: true })`). Failed-change rows: server side. |
| F-13 | medium | STILL OPEN | `p3/screens/EditTray.tsx:78-86` "N answers left" from `my_profile_progress_v1` (`shared/profileProgress.ts:67-70`) vs `gateModel.ts:32` "N things left" from `organiser_onboarding_status_v1`. Owner decision 5. |
| F-14 | medium | ADMIN-REPO | Nothing client-side; `gateModel.ts:50-54` only shows "not yours". Owner decision 6. |
| F-15 | low | STILL OPEN (one third fixed) | Own card not shared sheet: `CreateFlow.tsx:228-232` (no `gate.ts` import). Cover before create: `useCreateSave.ts:137-139` upload precedes the `create` loop `:152-162`; `model.ts:393-394` admits the stray file. Discard error FIXED: `useCreateSave.ts:212` `discardFailed` -> `CreateFlow.tsx:197`. |

### HOME-COPY, EDITOR-STATES, PAGE-SCOPE, DATES-100

| id | sev | verdict | evidence on main |
|---|---|---|---|
| F-16 | high | FIXED | #1218 c72e668 + #1227 58bc84c. `p3/model/status.ts:52-71` `nextUpAdviceOf` (one mapping); `HomeScreen.tsx:14-22` renders the named control. Tests `model/__tests__/nextUpAdvice.matrix.test.ts`, `screens/__tests__/homeNextUp.matrix.test.tsx:49-78`. Meets the 5 live-all-past prod series. |
| F-17 | low | FIXED | #1217 dcbb6cc. `p3/screens/VenueList.tsx` (Try again, empty line) used by `DetailsScreen.tsx:171` and `DateSheet.tsx:292`. Tests `editorStates.test.tsx` "F-17", `editorSheets.matrix.test.tsx` "F-17 place sheets x venue list shape". |
| F-18 | low | FIXED | #1217. `PricesScreen.tsx:26,66` `freeSwitchShown`; `labels.ts:276-278`. Tests `editorStates.test.tsx` "F-18", `editorSheets.matrix.test.tsx` "F-18". |
| F-19 | low | FIXED | #1217. `CancelEventSheet.tsx` ReasonPick error and empty states with Try again. Test `editorStates.test.tsx` "F-19". |
| F-20 | medium | STILL OPEN | `EditTray.tsx:77-84` `useEditLock` has no role input; `EventPage.tsx:286` "not one of yours" is the only role state. Owner decision 7. |
| F-21 | medium | STILL OPEN | `p3/data/eventPage.ts:283` `live: { ..., undo: null }`. Owner decision 8. |
| F-22 | medium | FIXED | #1217. `StatusSheet.tsx:178` `removed: true`; `EventPage.tsx:266` navigates to Events with the toast; `:320` Removed card; `status.ts:28` archived -> Removed. Test `removedEvent.test.tsx` (3 cases). |
| F-23 | low | STILL OPEN | `status.ts:35` has no cancelled-date input. Prod has none today. Owner decision 9. |
| F-24 | low | FIXED | #1217. `DateFieldSheets.tsx:50-51` `useLeave`. Test `dateFieldLeave.test.tsx` (4 cases: tab bar, phone Back, Escape, clean). |
| F-25 | low | FIXED | #1217. `EventPage.tsx:207-223` `onError` -> no cover. Test `removedEvent.test.tsx` "F-25". |
| F-26 | high | STILL OPEN | `p3/data/home.ts:121-133` loops every page; `stats.ts:63` takes no page id; `useOrganiserChoice` used only by GraceBanner and CreateFlow. No commit since the FIXLIST. Owner decision 10. Day-one impact nil: prod has 0 users with 2+ pages. |
| F-27 | medium | FIXED | #1218. `p3/data/olderDates.ts` (`p_before`/`p_limit 200`), `AllDatesScreen.tsx:28,36-47` "Load older dates", counts from the server summary. Test `allDates100.matrix.test.tsx` (4 cases incl. the 132-date shape). |

### SERIES-EDIT-RULE and CACHE

| id | sev | verdict | evidence on main |
|---|---|---|---|
| F-28 | blocker | STILL OPEN | No "this date only / all dates" ask anywhere; `DetailsScreen.tsx:268`, `PricesScreen.tsx:88` still "one save for all dates"; `p3/model/repeat.ts:417-430` preview lists dates and "has bookings", never going people. Owner decision 11. |
| F-29 | high | STILL OPEN (client) + ADMIN-REPO (server) | `p3/screens/DateSheet.tsx:195-208` move step has no guest-list, going or ticket warning; `p3/model/dates.ts` has no such input. Prod: 3 future dates carry guest-list entries. Owner decision 12. |
| F-30 | medium | ADMIN-REPO | Nothing client-side. `scripts/check-occurrence-delete-booking-safety.mjs` covers deletion, not move-as-curated. Unconfirmed (W-32). |
| F-31 | low | ADMIN-REPO | `scripts/check-event-truth-v1.mjs:41,702-705` documents the paused exclusion, does not test the wanted behaviour. Owner decision 13. |
| F-32 | medium | ADMIN-REPO | No client change; no contract script compares stored end time with sessions. |
| F-33 | medium | FIXED | #1220 9bcefaa. `shared/publicCache.ts` `invalidatePublicEventCaches`; called from `runCommands.ts:44`, `useOwnerCommand.ts:41`, `p3/data/dates.ts:380`, `sessions.ts:300`, `p3/new/useCreateSave.ts:91` and the five R1 senders. Test `shared/__tests__/publicCache.test.tsx` incl. the grep-driven completeness case. Gap: `team/publicTeamApi.ts` (team visibility) does not invalidate; arguably out of scope. |
| F-34 | low | FIXED | #1220. `EventPage.tsx:144-147` "See it as dancers see it" via `publicPageOf`. Test `dancerView.matrix.test.tsx`. |

### PEOPLE-JOIN and TEAM-RIGHTS (F-35..F-60): 0 fixed; none of the eight PRs touched these files

| id | sev | verdict | evidence on main |
|---|---|---|---|
| F-35 | high | ADMIN-REPO | Client still sends name/city/role as sign-up metadata (`pages/Auth.tsx:318-327`). Decision 14. |
| F-36 | high | ADMIN-REPO | No merge RPC referenced in src or scripts. |
| F-37 | high | STILL OPEN | `src/lib/auth-otp-routing.ts:288-289,316-317` teacher/dj only; pinned by `AuthCallbackRoleIntent.test.tsx:158,195`. |
| F-38 | high | STILL OPEN | `pages/AuthCallback.tsx:197` `claimAtSignIn` runs before `:207` `signInDeletionTarget`. Decision 15. |
| F-39 | high | STILL OPEN | `admin-organisers/join/JoinPage.tsx:210` claims after OTP; imports neither the deletion check nor the Already-listed step. |
| F-40 | medium | STILL OPEN | No `banned` handling or copy in src (comments only). |
| F-41 | medium | STILL OPEN | `pages/Auth.tsx:313-316` silent sign-in; `AuthCallback.tsx:236` roles only on first sign-in, pinned by `AuthCallbackRoleIntent.test.tsx:204`. Decision 16. |
| F-42 | medium | STILL OPEN | `auth-otp-routing.ts:317` only `no_match` shows the step; `ambiguous` pinned to show nothing (`:273`). |
| F-43 | medium | ADMIN-REPO | Client `AuthCallback.tsx:218` swallows an empty result silently. |
| F-44 | high | ADMIN-REPO | 62 active legacy team rows today. Decision 17. |
| F-45 | high | ADMIN-REPO | 5 pending claims today; no client writer. Decision 18. |
| F-46 | high | STILL OPEN | `p3/onboarding/OnboardingFlow.tsx:400-401` filters `open` only; `declinedRequests()` used by R1 only. |
| F-47 | medium | STILL OPEN | `src/lib/accountRouting.ts:118-131` vs `AuthCallback.tsx:202`, two mechanisms. Decision 19. |
| F-48 | medium | STILL OPEN | `p3/you/youRows.ts:55-60` switch/page/team/addPage/account only. Decision 20. |
| F-49 | medium | ADMIN-REPO | 0 claim emails set today. Decision 21. |
| F-50 | high | STILL OPEN + ADMIN-REPO | `edit-in-place/teamPickerModel.ts:217-218` "There is no owner invite RPC". Decision 22. |
| F-51 | medium | STILL OPEN | `series_leave_v1` has zero src callers; `more/index.tsx:18-19`; `shared/teamRules.ts:12-14,79`. Decision 23. |
| F-52 | medium | STILL OPEN | `page/index.tsx:62,114` no role input, contact slot for every member. Decision 24. |
| F-53 | low | ADMIN-REPO | backfill. |
| F-54 | low | ADMIN-REPO | `_dancer_profile_link_matches_v1`. |
| F-55 | low | STILL OPEN | `claimMyDancerProfile.ts:92-93`, `claimSignInLanding.tsx:10`; AuthStepper still imported by `ProfileEntryFlow.tsx:7` and `CreateVideographerProfile.tsx:6`, so "dead" is not re-proven. |
| F-56 | high | CHANGED (wording) / STILL OPEN (test) | #1219 fixed CONTRACT.md to `permission_denied (P0001)`. `tests/e2e/organiser-real-rpc.spec.ts:357-366` covers a contributor of the SAME series only; no cross-page RPC test. |
| F-57 | medium | ADMIN-REPO | 0 contributors in prod. |
| F-58 | low | STILL OPEN | `events/organisersModel.ts:13,35`; pinned by `sw1.parity.test.tsx:203,596`. Decision 25. |
| F-59 | low | ADMIN-REPO | Client-only guard `teamRules.ts:80-81`. |
| F-60 | low | ADMIN-REPO / data | `more/index.tsx:41-42` "Hand over (owner only)". Decision 26. |

Totals: 60 rows. FIXED 10 (F-16 F-17 F-18 F-19 F-22 F-24 F-25 F-27 F-33 F-34). CHANGED 3 (F-10,
F-15, F-56). STILL OPEN client-side 31. ADMIN-REPO 16 (unverifiable here; the admin RPC names
appear in this repo only in `src/integrations/supabase/types.ts` and these docs; no
`scripts/check-*.mjs` contract backs any of them). Four tests actively pin open behaviour
(F-01 landing tables, F-37/F-42, F-41, F-58) and must change with the fix.

## WALKLIST, row by row

No row has a prod-shaped browser walk. The only flag-on walk (`docs/review/p3-flags-on-walk.md`,
b41bf28, 31 screens at 390x844) ran on the `OrganiserFake` mock and says so. Every P3 handover
since 2026-10-30 carries "Not verified: browser walk at 390x844". #1208's screenshots
(`docs/design/p3-create-event/walk/`) cover the create flow only, which no W-row asks for.
PARTIAL = a unit test or a mock e2e spec covers part of the row's assertion.

| id | status | evidence | account (ACCOUNTS.md) |
|---|---|---|---|
| W-01 | PARTIAL | #1217 `useLeave` unit tests; `p3-w3b2-geometry.spec` static markup; no tab/Back/Back-link e2e | A-org-big |
| W-02 | PARTIAL | #1217 `removedEvent.test.tsx`; tag word and sheet state not asserted in a browser | A-org-big |
| W-03 | NOT WALKED | none | public; prod ids from the lead |
| W-04 | NOT WALKED | none | public; prod ids from the lead |
| W-05 | PARTIAL | #1220 `publicCache.test.tsx` (unit); handover "No browser walk" | A-org-big |
| W-06 | NOT WALKED | `p3-gate-sheet.spec` opens/Not now only | A-org-half (gate ON) |
| W-07 | PARTIAL | `organiser-home.spec` Retry case is the legacy area, flags off | A-dj |
| W-08 | NOT WALKED | none | A-org-big |
| W-09 | NOT WALKED | flags-on-walk screen 9 renders the sheet only | A-org-big |
| W-10 | NOT WALKED | none | A-org-big |
| W-11 | NOT WALKED | needs the admin repo | lead |
| W-12 | NOT WALKED | none | A-helper |
| W-13 | PARTIAL | `organiser-team.spec` manager reason (legacy route, mock) | A-org-member |
| W-14 | NOT WALKED | `TeamG3.test.tsx` unit only | A-org-member |
| W-15 | PARTIAL | `organiser-profile.spec` "Hand over first" on legacy More (same component) | A-org-solo |
| W-16 | PARTIAL | `ticket-door-scanner.spec` `not_allowed` card; "Not yours" in no test | A-org-member |
| W-17 | NOT WALKED | none | A-org-big, A-org-partner |
| W-18 | NOT WALKED | none | A-org-big |
| W-19 | PARTIAL | flags-on-walk (mock, 5 sub-44px defects listed); each P3 spec checks its own screens | any |
| W-20 | PARTIAL (CI spec) | `p3-gate-sheet.spec` Part 2: simulated refusal, Hide only | A-org-half, A-org-unfinished (gate ON) |
| W-21 | NOT WALKED | none; prod has 1 claimed page with a Facebook website | A-org-legacy-live (gate ON) |
| W-22 | PARTIAL | 1 of 24 doors (Hide) in `p3-gate-sheet.spec` | A-org-half (gate ON) |
| W-23 | NOT WALKED | none | A-org-half (gate ON) |
| W-24 | NOT WALKED | `p3-toast-geometry.spec` static; unit matrices only | A-org-tickets (gate ON, ticketing flag) |
| W-25 | NOT WALKED | none | A-org-half (gate ON) |
| W-26 | PARTIAL (CI spec) | `walk-p3-golive.spec` Review -> Live, refusal, retry (mock); landing after the SHEET not asserted | A-org-half (gate ON) |
| W-27 | PARTIAL | `p3Going.matrix.test.tsx` unit; handover "No e2e" | A-org-legacy-live (going preview flags) |
| W-28 | NOT WALKED | no spec references `/account/tickets` | A-org-tickets (ticketing flag) |
| W-29 | NOT WALKED | none | A-org-big + 100 one-offs seed |
| W-30 | PARTIAL | #1218 `nextUpAdvice.matrix` unit | A-org-history |
| W-31 | PARTIAL | #1218 `allDates100.matrix.test.tsx` (132-date shape vs emulator) | A-org-big (W-weekly-130) |
| W-32 | NOT WALKED | `walk-w3c-1-repeat` changes the rule but never moves a date first | A-org-big |
| W-33 | NOT WALKED | none | A-org-big + guest-list seed |
| W-34 | NOT WALKED | #1220 "paused opens" unit only | A-org-big (P-paused) |
| W-35 | NOT WALKED | none | A-org-big + A-org-member |
| W-36 | NOT WALKED | none | A-org-big (F-festival, K-course-now) |
| W-37 | NOT WALKED | none | A-org-big + going seed |
| W-38 | PARTIAL | `walk-p3-w4b-onboarding` no-dancer frame (rewritten in #1231); ask count not tested | A-org-nodancer |
| W-39 | NOT WALKED | none | A-org-autoclaim |
| W-40 | NOT WALKED | none | person seed D2 |
| W-41 | NOT WALKED | none | person seed D3 |
| W-42 | NOT WALKED | none | person seed D4 |
| W-43 | NOT WALKED | flags-on-walk screen 23 renders Add someone only | A-org-big |
| W-44 | NOT WALKED | none | person seed: banned account |
| W-45 | NOT WALKED | none | person seed: ambiguous pair |
| W-46 | NOT WALKED | none | lead (real approval email) |
| W-47 | NOT WALKED | none | A-org-member, A-org-tickets (ticketing flag) |

P3 e2e specs in CI (`test:e2e:p3`, e2e-smoke step "Run E2E P3 walk specs (P3 flags on)", #1231),
all 390x844 on `OrganiserFake`: `walk-p3-w4b-onboarding` (rewritten, was KNOWN RED),
`walk-w3c-1-repeat`, `walk-p3-w4b2-person`, `walk-p3-w4b2-page`, `ticket-door-scanner`,
`walk-p3-golive`, `p3-gate-sheet`, `walk-p3-create-kinds`. E2E Smoke on b96ada3 is green, so
they pass on mocks. `pre-ship` still runs only `test:e2e`, not `test:e2e:p3`
(`docs/handover/guard-p3-walk-specs.md:58`). The ten walk fixtures in the lead's manifest were
not available to this worker; the account column above is what each row needs.

## What the flip does on day one, in plain words

If `VITE_ENABLE_ORGANISER_P3=true` is set on production with the code at b96ada3 and nothing else:

- **The 10 people who run a page (15 counting managers) notice nothing.** Sign-in, the account
  icon, the dancer home, Options, "I organise events", the claim landing and every old bookmark
  still open the old area. The old area is not retired. They reach the new area only by typing
  `/account/p3`, or if an invite with a page id lands them on the new Welcome.
- **Anyone who signs up as an organiser and has no page yet** lands on the new Welcome
  (`/account/p3/start`, Find your page, claim or create) instead of the old flow. This path is
  CI-walked on mocks only. In the new create flow, Course, Festival and Online are marked
  "Coming soon" (`p3/new/model.ts:47,49,51`), so a new organiser cannot create those three kinds
  until they find the old area; prod has 6 live courses and 8 live festivals, so the shapes are
  real.
- **Both areas write the same data.** The public page and calendar now refresh after a write
  (F-33), so a change made in one area shows in the other after a reload.
- **No event change is blocked.** The server gate flag is false; the Home banner's
  "Until then everything works as usual" is true today.
- **Links do not break.** Nothing is removed; no redirect changes. The old event link
  `/account/series/:id` still opens the old event page.

So the env-var flip alone is low-harm and low-value: it does not deliver the brief's flip
(old area retires), and the one group it does move (new organisers) meets a create flow with
three kinds missing, on a path no one has walked with real data.

## Blockers, in order, each with a one-slice fix

| # | blocker | owner decision (recommended default) | one-slice fix | files | size | model / effort |
|---|---|---|---|---|---|---|
| 1 | **F-01 + F-02..F-06 landing** (the flip is not implemented) | Decision 1: **(c)** everyone with a page lands in the new area and `/account/o/*` redirects there for page holders, with a dated fallback link `?legacy=1` for one week | One flag-aware `organiserAreaHome(flags)` replacing every `ORGANISER_HOME_PATH` / `ORG_PATHS.home` landing; drop the `organiserCount === 0` guard in `organiserHomeHandoff`; `legacyPaths.ts` gains the flag and maps `/account/o/events/:id` -> `/account/p3/events/:id`, team -> `/account/p3/you/team`, new -> `/account/p3/create`; `PROFILE_WIZARD_PATH` -> P3 start review; fix the F-05 copy; flip the two pinning tables | `accountRouting.ts`, `auth-otp-routing.ts`, `claimSignInLanding.tsx`, `DancerHome.tsx`, `optionsModel.ts`, `NoProfileWayOut.tsx`, `areaStatus.ts`, `legacyPaths.ts`, `AnimatedRoutes.tsx`, `PublicClaimCard.tsx`, `JoinScreens.tsx`, `EmailCodeProof.tsx`, `profileProgress.ts`, `joinCopy.ts`, 2 table tests + new legacy-redirect table | ~250 lines | Opus, high; user-facing, two review rounds |
| 2 | **Create flow kinds** (new organisers lose Course, Festival, Online) | Owner: ship Course and Festival in the new flow first, or keep sending those kinds to the old create flow. Default: **route the three "Coming soon" kinds to the old flow** (`/account/o/new/what?kind=`) until create-event slice 2 lands | In `p3/new/CreateFlow.tsx`, a deferred kind tap navigates to the R1 create flow with the kind preselected, instead of a pill | `p3/new/CreateFlow.tsx`, `p3/new/model.ts`, `routes.test.ts` | ~40 lines | Sonnet, medium |
| 3 | **F-28 owner rule R1** (scope ask; going people in preview) | Decision 11: **(b)** keep hand-edited dates | Client: a Scope step ("This date only / All dates") on Details, Prices and Cover saves for recurring series, reusing the sessions sheet's existing Scope; preview adds "N people going" per date from `get_my_series_going_v1`. Server: per-date override command for cover/venue/prices (admin repo) | `DetailsScreen.tsx`, `PricesScreen.tsx`, `p3/model/repeat.ts`, `p3/data/repeat.ts`, `sessions.ts`; admin migration | ~300 lines + admin | Opus, xhigh (data integrity, two rounds); admin side first |
| 4 | **Zero prod-shaped walks** (definition of done) | None; the lead seeds the `[ACC]` accounts | Walk section A rows walkable with today's flags: W-01 W-02 W-05 W-18 W-19 W-30 W-31 plus W-07 and W-38 for the 0-page path; record in a `WALK-LOG.md` | seed per ACCOUNTS.md; no code | half a day | lead, with phone |
| 5 | **F-29 move with guests** (3 prod dates affected) | Decision 12: **(b)** warn, and tell the people | Client: `DateSheet.tsx` move step reads guest-list / going counts for the date and shows a warning line; server: `_cmd_occurrence_move_date_p5` guard (admin) | `DateSheet.tsx`, `p3/model/dates.ts`, `p3/data/dates.ts`; admin | ~120 lines + admin | Opus, high |
| 6 | **F-10 organisers half + F-46** (dead ends on the new Welcome and Who-runs-it) | None | Route `SeriesOrganisers` refusals through the gate hook; show `declinedRequests()` on P3 Welcome | `events/SeriesOrganisers.tsx`, `p3/onboarding/OnboardingFlow.tsx`, `gate.matrix.test.tsx` | ~60 lines | Sonnet, medium |

Not blockers for this flip, but blockers for the NEXT flag (`organiser_onboarding_gate`): F-07,
F-08, F-09, F-11, F-13, F-14 and decisions 2 to 6. Do not turn that flag on until a grace
answer and a working retry exist; today it would stop every change on the 4 pages with upcoming
dates (5 dates in the next 7 days), with 0 of 10 pages able to pass.

Not blockers for day one because prod has no such shape: F-26 (0 users with 2+ pages), F-23
(0 cancelled one-offs), F-57 (0 contributors), F-11 and W-24/W-28/W-47 while ticketing is off.

## Not verified

- Prod Vercel env: whether `VITE_ENABLE_ORGANISER_P3` is already set. This session's network
  policy blocks `api.vercel.com` and `www.bachatacalendar.co.uk` (403 from the egress proxy), so
  neither the API nor the live bundle could be read. Needs owner: a look at the Vercel project
  env, or egress for the API.
- Every ADMIN-REPO row (16) and the three admin PRs #1160 #1166 #1169.
- Any browser walk. None was run; none exists on prod-shaped data.
- The tests named above were read, not run, in this session; CI on b96ada3 ran them green.
- "11 non-admin organisers" from the FIXLIST (15 users with organiser access measured; admin
  exclusion not computed).

## Handover

Done: this document (FIXLIST 60/60 rows, WALKLIST 47/47 rows, prod counts, verdict, blockers); PR #1233.
Left: nothing from the brief. Next: the owner answers decisions 1, 11 and 12 and the create-flow
kinds question above; slice 1 (landing) is the first PR; the lead seeds and walks section A.
