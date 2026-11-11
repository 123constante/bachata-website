# What is LEFT of the organiser rebuild (P3), Website

Read-only audit, 2026-10-30. Brief `brief/audit-organiser-remaining` (`docs/briefs/audit-organiser-remaining.md`).
Base: `main` @ `21364be`. No source edited. Prod read with SELECT only (catalog and counts; no personal data, no write).

Words used below: **R1** = the current organiser area `/account/o/*` (`src/modules/organiser/shell/OrganiserRoutes.tsx`).
**P3** = the rebuilt area `/account/p3/*` (`src/modules/organiser/p3/shell/P3Routes.tsx`), mounted only while
`organiserP3 && organiserSelfServe` (`src/components/AnimatedRoutes.tsx:263-268`). Turning P3 on does NOT unmount R1.

## Headline

1. P3 has **no way to create an event**. Every "add/change it" link in P3 goes to R1 (`p3/screens/parts.tsx:10,76`).
2. P3 You > **Account** opens R1 More (`p3/you/YouScreen.tsx:64`), whose only back link is R1 Home
   (`more/index.tsx:88,91,95`): a P3 person who taps Account ends up in R1 with no link back to P3.
3. Anyone with **one or more pages** still lands in R1 after sign-in, claim, invite-without-id and `/account/new`
   (evidence in Q1). Only 0-page people are sent to P3.
4. Go live is built, wired and the RPC is live on prod. A real Go live has never run.
5. Server side of the onboarding arc: S1, S2 and the Go live RPC are on prod; the gate flag is OFF; **S8 (tickets)
   and S7 (switch ON) are not started**. The Website **A1 gate screen** (what an `onboarding_incomplete` refusal opens) is
   not built, and must be before S7.

## Q1. Old routes vs P3

P3 reuses R1 screens under `/account/p3/you/*` through `P3_SURFACE` (`p3/you/surface.tsx:36-41`: "More (Account and
help), the profile wizard and Add an event stay R1 screens"). P3 route list: `P3Routes.tsx:60-86`.

| R1 route (`/account/o/...`) | P3 route | State | Evidence |
|---|---|---|---|
| `team`, `team/add`, `team/:userId` | `you/team`, `you/team/add`, `you/team/:userId` | built (R1 screens in P3 frame) | `P3Routes.tsx:77-79` |
| `handover`, `handover/:userId` | `you/handover`, `you/handover/:userId` | built | `P3Routes.tsx:80-81` |
| `switch` | `you/switch` | built | `P3Routes.tsx:74` |
| `welcome` | `you/welcome?o=` | partial: its **Add an event** goes to R1 `new/what` | `P3Routes.tsx:75`; `switch/Welcome.tsx:48` (`paths.newWhatFor`, not overridden in `P3_SURFACE`) |
| `page`, legacy `profile` | `you/page` | built | `P3Routes.tsx:76` |
| `done` | `you/done` | built | `P3Routes.tsx:82` |
| `complete` (ProfileWizard) | `start?o=&at=review` (P3 onboarding) | built as a different flow; no `complete` route in P3 | `P3Routes.tsx:61`; `page/index.tsx:23,29-35` |
| `go-live` (R1 GoLiveFlow) | `start` (OnboardingFlow Review > Live) | built | `P3Routes.tsx:61`; `OnboardingFlow.tsx:99` |
| index, 0-page onboarding | `/account/p3` Home; 0 pages > `start` | built | `p3/screens/HomeScreen.tsx:50-56` |
| `?add=1` (Add a page, has pages) | `you/add` (wraps R1 `OnboardingView`) | built (R1 look) | `p3/you/AddPageScreen.tsx:7,49` |
| **`new/*` create wizard** | **NONE** | **missing** | no new-event key in `p3/shell/paths.ts:10-44`; nothing in `p3/**` imports `flows/new` |
| `change/*`, `add/*`, `cancel/*` | sheets on `events/:id` and `events/:id/dates` | built as sheets (no per-step URL) | `p3/screens/DateSheet.tsx`, `RepeatSheet.tsx`, `CancelEventSheet.tsx` |
| `cover/:seriesId` (flows/fix) | cover field on `events/:id/details` | built (no route) | `p3/screens/DetailsScreen.tsx:64,117` |
| `events`, `events/:id`, `events/:id/details` | same | built | `P3Routes.tsx:65-68` |
| `events/:id/programme` | Lineup / Session sheets in EventPage | built as sheets | `p3/screens/LineupSheet.tsx`, `SessionSheet.tsx` |
| **`events/:id/organisers`** (co-organisers) | **NONE** | **missing** | not in `P3Routes.tsx:60-86` |
| **`more`** (Account) | **NONE** (You > Account links R1) | **missing** | `p3/you/YouScreen.tsx:64` |
| **`more/help`** | **NONE** (Team "Message us" links R1) | **missing** | `team/index.tsx:69`, `team/GateReason.tsx:11` |
| `/account/settings*` | outside both areas | n/a (reachable only via R1 More) | `AnimatedRoutes.tsx:230-232` (agent read) |
| `/account/new` | redirects to R1 `new/what` | **R1 only** | `shell/legacyPaths.ts:23` |
| invite `/join` Done, with organiser id | `you/welcome?o=` | built | `p3/shell/paths.ts:55-56`; `JoinScreens.tsx:168` |
| invite `/join` Done, **no** organiser id | R1 Home | **R1 only** | `JoinScreens.tsx:168` |
| claim at sign-in | R1 Home always | **R1 only** | `lib/claimSignInLanding.tsx:20` |
| sign-in / Continue as, 1+ pages | R1 Home (`/account/o[?o=]`) | **R1 only** | `lib/accountRouting.ts:29,352`; asserted by `src/lib/__tests__/p3LandingWelcome.table.test.ts:89-95` |
| sign-in / sign-up, 0 pages | P3 `start` | built | `lib/auth-otp-routing.ts:164-186` |

P3-only routes with no R1 twin: `events/:id/prices`, `history`, `door` (ticketing flag), `stats`, `you/details`, `you/get-paid`.

## Q2. Go live

- **Screen:** P3 `OnboardingFlow` at `/account/p3/start` (Review > Live), `P3Routes.tsx:61`.
- **Wired into onboarding:** yes. `OnboardingFlow.tsx:99` defaults `goLive = REAL_GO_LIVE`; `p3/onboarding/pageApi.ts:65`
  calls `complete_organiser_onboarding_v1(p_organiser_id)` (#1144, merged as `2afd8d9c`). Every server answer is mapped
  (`docs/handovers/p3-golive-wiring.md:7-20`). Entry points: 0-page Home (`HomeScreen.tsx:56`), sign-up and sign-in
  landings (`auth-otp-routing.ts:172-186,210`), R1 Home handoff with 0 pages (`home/index.tsx:118-120`), page editor's
  required line (`page/index.tsx:23-35`).
- **Live on prod (pg_proc, read 2026-10-30):** `complete_organiser_onboarding_v1(p_organiser_id uuid)`, SECURITY DEFINER,
  ACL `postgres, authenticated` (no anon). Helpers present: `_onboarding_missing_v1`, `_city_requires_review_p5`
  (service_role only, as designed).
- **Not verified:** a real Go live (never called, by rule); the `pending_review` path (0 of 319 cities have an
  ambassador, per the handover). Owner phone test with P3 on is still the named next step (`p3-golive-wiring.md:64`).

## Q3. Onboarding arc S1-S8 (plan `docs/plans/onboarding-arc.md:303-321`; its RUN STATE at `:377-384` is stale)

Server state read on prod 2026-10-30 (catalog only):

| Slice | State | Evidence |
|---|---|---|
| S1 schema + write paths (admin) | **applied** | tables `organiser_onboarding_progress`, `onboarding_audit`; column `teacher_role_details.levels_taught` |
| S2 status + gate OFF + guard | **applied**; Website guard merged | `organiser_onboarding_status_v1`, `_require_onboarding_complete_v1` called by `organiser_save_event_v1`, `series_command_p5`, `occurrence_command_p5`, `organiser_set_occurrence_programme_v1`, `organiser_undo_last_change_v1`, `organiser_save_festival_v1`, `check_organiser_onboarding_gate_v1`; flag `organiser_onboarding_gate` = **false** (updated 2026-10-29); Website G1 guard #1194 (`81f1bc75`) |
| S3 nationality + languages | merged | #1113, #1117 (plan `:313`) |
| S4 admin person editor | **not verifiable** from this repo | admin #1101 / #1103 |
| S5 screen spec | done (Appendix A) | plan `:406-449` |
| W4b build 2 screens (A0, A2-A8) | **merged** | `p3/onboarding/PersonFlow.tsx`, `OnboardingFlow.tsx`; A0 banner `p3/screens/GraceBanner.tsx` with "never 0 things left" (`p3/onboarding/graceModel.ts:41-45`, #1181) |
| **A1 gate screen** (Website) | **missing** | `isOnboardingRefusal` (`shared/selfServeErrors.ts:155`) has no caller outside tests; a refusal only shows the copy `ONBOARDING_REFUSAL` ("Finish your details first...") as a save error, with no Continue control; no "A few details first" screen anywhere in `src/` |
| S6 live on completion | **done as an RPC** (not the planned trigger) | `complete_organiser_onboarding_v1` live + wired (Q2); no onboarding/go-live trigger in `pg_trigger` |
| Grace stage (Q1 date) | **missing server-side** | `graceModel.ts:43` "No grace end date exists on the server yet (plan Q1)" |
| **S7 switch ON** | **not started** | flag false; `organiser_onboarding_progress` has **0 rows** (0 completed) against 63 `entity_members` rows |
| **S8 tickets read the signal** | **not started** | `ticket_type_upsert_v1` / `ticket_type_set_status_v1` exist but do NOT call `_require_onboarding_complete_v1` |

## Q4 and Q5: dead ends with organiserP3 ON (from code and routing tables, not guessed)

| # | Path a signed-in organiser can take | What happens | Evidence | Test that pins it today |
|---|---|---|---|---|
| D1 | P3 You > **Account** | R1 More; back = R1 Home; R1 Home (has pages) has no link to P3: **stuck in R1** | `YouScreen.tsx:64`; `more/index.tsx:88,91,95` | `p3/you/__tests__/you.matrix.test.tsx:153` asserts `ORG_PATHS.more` |
| D2 | P3 Home / Events "Add an event", "Do it", "Sort these" | R1 Home | `parts.tsx:10,76`; `HomeScreen.tsx:75,107,127`; `EventsScreen.tsx:27,48`; `tickets/GetPaid.tsx:105` | `p3/screens/__tests__/screens.matrix.test.tsx:244` asserts `/account/o` |
| D3 | P3 Welcome (accepted invite) > **Add an event** | R1 `new/what?o=` | `switch/Welcome.tsx:48` | none |
| D4 | P3 Team > **Leave this page** | R1 More (then D1) | `team/index.tsx:103`, `team/Person.tsx:105` | `you.matrix.test.tsx:251,643` |
| D5 | P3 Team > **Message us** | R1 Help (back goes to R1) | `team/index.tsx:69`, `GateReason.tsx:11` | `you.matrix.test.tsx:594,728` |
| D6 | R1 More > **Add a page** (person with pages) | R1 `OnboardingView`, not P3 `you/add` (handoff fires only for 0 pages) | `more/index.tsx:100`; `home/index.tsx:118-131` | `home/__tests__/p3Handoff.wiring.test.tsx:52-67` |
| D7 | Sign in with 1+ pages; claim at sign-in; invite Done with no id; `/account/new` | R1 | Q1 rows | `p3LandingWelcome.table.test.ts:89-95`; `loginDeadEnds.table.test.tsx:69` |
| D8 | Any event write once S7 turns the gate ON, by an incomplete person | error copy "Finish your details first..." with **no control that goes there** (copy points at a missing control) | `selfServeErrors.ts:152-158` | `shared/__tests__/selfServeErrors.onboarding.test.ts` (copy only) |
| D9 | Co-organisers of a series | only in R1 `events/:id/organisers` | `OrganiserRoutes.tsx:132` | none |

No loop found inside P3 itself: the catch-all goes to Home (`P3Routes.tsx:86`), 0-page Home goes to `start`
(`HomeScreen.tsx:56`, pinned by `p3/screens/__tests__/noPageHome.test.tsx`), and every lazy route sits in
`P3RouteBoundary` with a back link (`P3Routes.tsx:47-48`). D1-D7 are not dead ends in the strict sense (R1 works); they
are exits from P3 with no way back, so "finish the rebuild" means closing them. With P3 OFF none of this is reachable.

Not covered by any test today: D3, D6 with P3 on, `/account/new` with P3 on, claim landing with P3 on, the round trip
You > More > back, and a loop test of the P3 catch-all.

## Remaining slices (ordered)

| # | Slice | Lane / model | Files owned | Depends on | Parallel? |
|---|---|---|---|---|---|
| 1 | **P3-NEW** create an event in P3 | Website, BUILD-visual, careful + Design Gate; Opus / high | new `p3/new/*`; adds `P3_PATHS.newEvent*` in `p3/shell/paths.ts` and routes in `P3Routes.tsx`; `P3_SURFACE.paths.newWhat*` override in `p3/you/surface.tsx` | owner call: rebuild vs reuse R1 `flows/new` in P3 frame | owns `P3Routes.tsx` + `paths.ts` + `surface.tsx` first |
| 2 | **P3-MORE** Account and Help inside P3 | Website, BUILD-visual, normal; Sonnet / high | `P3Routes.tsx` (`you/account`, `you/help`), `p3/shell/paths.ts`, `p3/you/surface.tsx` (`more`, `help`, `home` back), `more/index.tsx` back link via `useOrgSurface`, `YouScreen.tsx:64`, `team/index.tsx:69,103`, `team/Person.tsx:105`, `team/GateReason.tsx:11` | none | **serial with 1** (same three shell files) |
| 3 | **P3-LINKS** retarget the "current organiser area" links | Website, BUILD-visual, small; Sonnet / medium | `p3/screens/parts.tsx`, `HomeScreen.tsx:75,107,127`, `EventsScreen.tsx:27,48`, `tickets/GetPaid.tsx:105`, `screens.matrix.test.tsx:244` | 1 (Add an event target) | after 1; parallel with 4 |
| 4 | **P3-GATE** A1 gate screen + refusal routing | Website, BUILD-visual, careful; Opus / high | new `p3/onboarding/GateScreen.tsx`; callers of save errors in `p3/screens/EditTray.tsx`, `CancelEventSheet.tsx`, `Toast.tsx`, `p3/data/*`; `isOnboardingRefusal` wiring | S2 (applied) | **parallel with 1/2** (no shell files) if it mounts as a sheet; if it needs a route, queue its `P3Routes.tsx` line after 2 |
| 5 | **P3-COORG** series co-organisers in P3 | Website, BUILD-visual, normal; Sonnet / high | `P3Routes.tsx` (`events/:id/organisers`), EventPage row, reuse `events/SeriesOrganisers` | none | serial with 1/2 on `P3Routes.tsx` |
| 6 | **P3-LAND** page-holders land in P3 | Website, careful (auth routing); Opus / xhigh | `lib/accountRouting.ts:352`, `lib/claimSignInLanding.tsx:20`, `admin-organisers/join/JoinScreens.tsx:168`, `shell/legacyPaths.ts:23`, R1 Home redirect when P3 live (`home/index.tsx:118-120`), tables `p3LandingWelcome.table.test.ts`, `loginDeadEnds.table.test.tsx` | 1, 2, 5 (else P3 lacks create / More / co-orgs) | last Website slice |
| 7 | **post-flip cleanup** (brief exists: `brief/p3-post-flip-cleanup`) | Website, normal; Sonnet | P3 Home banner + its tests; tests under `src/modules/admin-organisers` | none | parallel with everything |
| 8 | **W4c Going** organiser side | Website after admin | per `claude/p3-w4c-going` handover (PR #1199) | **admin:** `public_event_id` bridge | blocked |
| 9 | **S8** tickets gate | admin + small Website | admin `ticket_type_upsert_v1`, `ticket_type_set_status_v1`; Website Get paid prompt waits for complete | S2 (applied); plan Q3 | parallel (other repo) |
| 10 | **Grace date** (plan Q1) | admin + Website copy | admin flag/date; `graceModel.ts` | owner date | parallel |
| 11 | **S7** gate flag ON | ops; orchestrator | one `admin_set_feature_flag_v1` call | 4, 10, owner phone check, shape survey of who is incomplete | last |

Serial chain on the shell files (`P3Routes.tsx`, `p3/shell/paths.ts`, `p3/you/surface.tsx`): **1 > 2 > 5** (or one
builder takes 2 and 5 together), then 3, then 6. Disjoint and parallel now: **4, 7, 9, 10**. 8 waits for admin.

## Builder briefs (one paragraph each)

**1 P3-NEW.** Goal: an organiser can create an event without leaving `/account/p3`. Owner decision first (genuine fork):
rebuild the create steps in the P3 look, or mount R1 `flows/new` under `/account/p3/new/*` with `P3_SURFACE` (as Team was
done in W4a). Own `p3/new/*`, the new `P3_PATHS` keys, the `P3Routes.tsx` lines and the `newWhat`/`newWhatFor` override in
`surface.tsx` (which also fixes D3). Tests: a route matrix (each step URL renders inside P3 and every back stays in P3),
Welcome "Add an event" lands in P3, cancel mid-flow returns to P3 Events. Real shapes: organiser with 0 events, 1, many
(>100-row API cap), weekly series with and without a stored rule, festival (R1 has festival off), draft vs live page,
manager vs owner, gate flag OFF and (simulated) ON. 390x844 walk; perf budget (P3 chunk).

**2 P3-MORE.** Goal: You > Account and Team > Message us / Leave stay in P3 and come back to You. Mount R1 More and
Help under `you/account` and `you/help` through `P3_SURFACE` (add `more`, `help` keys); make More's back link read
`useOrgSurface()` instead of `ORG_PATHS.home`; More's "Add a page" goes to `P3_PATHS.youAdd` under P3. Update the
asserting tests (`you.matrix.test.tsx:153,251,594,643,728`). New test: You > Account > back lands on `/account/p3/you`.
Shapes: one page, several pages (switcher), owner vs manager (Leave rules, ownerless-page guard from #1107), no dancer row.

**3 P3-LINKS.** Goal: no "current organiser area" link left in P3. Point "Add an event" at slice 1's path; "Do it" and
"Sort these" at the P3 event page of the row in question (or Events). Remove `CHANGE_IT_PATH`. Update
`screens.matrix.test.tsx:244`. Add a guard test: no `ORG_PATHS` import under `src/modules/organiser/p3/**` except an
allow-list. Shapes: no events, nothing coming up, Needs you with 1 and many rows, Get paid not connected.

**4 P3-GATE.** Goal: Appendix A1. When a P3 write fails with `isOnboardingRefusal`, or a create/edit entry is opened
while `organiser_onboarding_status_v1` says not complete, show "A few details first" with the missing groups, Continue
(to `P3_PATHS.youDetailsFor(o)` / `start`) and Not now. Use the ONE count in `graceModel.ts` (never a second mapping).
Tests: table over every P3 write surface x {refusal, plain error, success}, status {complete, 1 missing, many missing,
admin, read failed}. Red first against main (D8). Shapes: incomplete owner, incomplete manager, admin (never gated),
person on two pages with one complete. Gate flag stays OFF in prod; simulate refusals.

**5 P3-COORG.** Goal: series co-organisers manageable in P3. Mount `events/SeriesOrganisers` at
`/account/p3/events/:id/organisers` via the surface, add an Event page row. Tests: route renders in P3, back to the
event; owner vs contributor. Shapes: series with 1 organiser, several, an organiser page you do not manage.

**6 P3-LAND.** Goal: once P3 is live every organiser entry lands in P3, and R1 `/account/o` redirects to its P3 twin.
Change `accountRouting.ts:352` (keep `/app` first-load size: it is on the app shell), `claimSignInLanding.tsx:20`,
`JoinScreens.tsx:168`, `legacyPaths.ts:23`, and add an R1 Home redirect for page-holders. Flip the asserting rows in
`p3LandingWelcome.table.test.ts:89-95` and `loginDeadEnds.table.test.tsx:69` to P3, with P3-OFF rows unchanged. Shapes:
0/1/many pages x open request x dancer complete/incomplete/no row x claim pending x invite with/without id. Rollback =
flag off. Only after 1, 2, 5 merge.

**7 post-flip cleanup.** Follow `brief/p3-post-flip-cleanup` as written (banner label centring, invite landing tests).
Also re-check the tap targets from `docs/review/p3-flags-on-walk.md` D4 (sheet Close 38x44, "It's free" switch 22x22,
page Edit 32x44, "Back to the team" 314x40): not re-verified in this audit.

**8-11** are admin or ops; their contracts are in the plan (`onboarding-arc.md:303-321`) and the W4c handover.

## Verified / Not verified

**Verified:** every R1 and P3 route line cited above, read on `main` @ `21364be`; the old-area links D1-D7 by grep and
read of each line (a subagent's route walk, each claim spot-checked by hand; its P3Routes line numbers were wrong and
were replaced with mine); 0-page Home goes to `start` (fixed by #1195, review F1 no longer reproduces at
`HomeScreen.tsx:56`); merged PRs #1118 #1143 #1144 #1157 #1159 #1162-#1165 #1179-#1183 #1191 #1194 #1195 (git log);
on prod (SELECT only): the onboarding / go-live functions and ACLs, the gate flag OFF, S1 tables and column, the seven
callers of `_require_onboarding_complete_v1`, ticket RPCs not calling it, 0 progress rows, 63 entity_members rows.

**Not verified:** admin S4 state (R1 Home/More/shell have no `P3_PATHS` or `/account/p3` link: grep, so D1 holds unless another R1 screen links back);
the A0-A8 screens' behaviour (relied on their merged tests and handovers, not re-run); no tests, build or browser walk run
(read-only audit); a real Go live; tap-target sizes; the Vercel values of `organiserSelfServe` / `organiserDetail`.
