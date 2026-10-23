# B-WEB3 handover: Your areas, area paths, routes, switcher, D91

Branch `claude/people-b-web3`, from `origin/main` (fb91b8a4) with `origin/claude/people-b-web1-areas` (6888ad6)
merged first (D94). Ticket `dt_2fad189bdb4f`. No PR opened (brief: "Open NO PR. ONE push").

frontend-design skill: **NOT loaded**. It is not in this cloud session's skill list. The screens use only the existing
`.org-theme` tokens and `src/modules/organiser/ui` primitives (Card, ErrorState, SkeletonRows, Chip via B-WEB1's step).

## B-WEB1 merge

`git merge origin/claude/people-b-web1-areas` was **clean: 0 conflicts**. B-WEB1 touched only `docs/` and
`src/modules/areas/**`; its `src/modules/areas/wizardStep.ts` is byte-identical to the copy Release A (#870) put on main,
so git saw one file. Main's Release A behaviour is unchanged by the merge itself.

What the merge did NOT do on its own, done by hand after it (the "plug into main's registry" part):

| piece | resolution |
|---|---|
| main's `wizard/registry.tsx` skipped every teacher/DJ step ("until Release B") | B-WEB1's `doYouTeachStep`, `teacherWizardSteps`, `doYouDjStep`, `djWizardSteps` added as they are, through one `roleEntry()` that adds `read()`: a field reads `sources.roleDetails[role][key]`; "Do you...?" reads `false` once declined, else `null` |
| `wizard/wizardApi.ts saveAnswer` had no teacher/DJ writer | new branch calls B-WEB1's `submitRoleWizardStep` (save_my_role_v1 one key, or set_my_role_declined_v1); `WizardWriters.saveRole` optional so the existing fakes keep working; untouched answer still sends nothing (`sameAnswer` first) |
| `ProfileWizard.tsx` loaded no teacher/DJ data | `my_role_details_v1` read only when the server lists a step of that area; loading / error states extended to it |
| B-WEB1 module defaults pointed at `/account/teacher` (not a route) | `areas/shared/paths.ts` defaults now come from `AREA_PATHS`; back goes to Your areas; area pages take an optional `backLabel` |
| A-WEB1b test "a teacher step is skipped" | that rule changed on purpose; the test now uses an unregistered dancer key for "skipped" and a new test proves a teacher step shows B-WEB1's question and sends ONE key to the role writer |

Unit suite right after the merge, before building: 10748 passed, 15 failed, 29 skipped. The 15 are all
`tests/*.contract.test.ts` (live prod DB from the sandbox: eventViewCompat, occurrenceProgram, publicEventPageLineup) and
`tests/integrityCouldNotRun.test.ts` (sandbox TS-helper precondition); none touch this slice. CI's PR leg runs
`test:unit:offline`, which excludes the contract suites.

## What I built

- `src/lib/areaPaths.ts`: the pinned bytes, exactly (B-WEB4 adds the same file).
- `src/modules/areas/home/rolesApi.ts`: ONE string-named boundary for `my_roles_v1` (array of `{role, active, complete}`;
  an unknown role is dropped, a bad shape throws), `my_role_intent_v1`, `set_my_role_intent_v1`. `answerDoYou(role, yes)`:
  diff-first, Yes = add role to the intent if missing + lift a stored No; No = record the No if not already stored.
- `src/modules/areas/home/areaStatus.ts`: THE status mapping (`areaStatus`, `areaAction`, `AREA_NAME`, `AREA_HREF`).
  Words: `Complete`, `N to finish`, `Not finished` (held, progress did not load), `Not added`, `You said no`.
  N = open steps of that area in `my_profile_progress_v1` (the wizard's own list); required ones only while any is open.
  Organiser held/complete is the server's seat rule via `my_roles_v1` (C12); `person_roles.organising` is never read.
- `src/modules/areas/home/StatusDot.tsx` (currentColor, decorative; the words carry the meaning).
- `src/modules/areas/home/YourAreasPage.tsx` at `/account/areas`: four rows, one action each (Open; Add = the wizard's own
  "Do you teach? / Do you DJ?" step in place; dancer Add = /finish-profile; organiser Add = /account/o, the same way in
  Options uses). States: loading, error with retry (also when the RPC does not exist yet), no-profile / signed-out
  (B-WEB1's BlockedState), progress failing = rows still shown.
- `src/modules/areas/home/AreaRoutes.tsx`: ONE lazy chunk, `AuthGuard` inside it exactly like `/account/o`; mounts Your
  areas, `/account/t` + `/account/t/details`, `/account/dj` + `/account/dj/details` with B-WEB1's lazy pages.
- `src/components/AnimatedRoutes.tsx`: ADDED only (1 lazy const, 3 route lines). `catchallClientPaths.ts`: the 3 patterns.
- `src/modules/areas/home/SwitcherAreas.tsx` + `ProfileSwitcher.tsx` (+10 lines, a lazy chunk loaded with the open sheet,
  so no route's first load grows; the dancer-app chunk ratchet stays 55/55): below the sides, the teacher/DJ areas the
  person holds with the same dot and words, then "Your areas". Every existing entry and test kept. It renders only under a
  QueryClientProvider (the existing switcher tests mount without one; there it shows exactly what it showed before).
- Options (`optionsModel.ts`): **NOT changed.** No hidden teacher/DJ/Your-areas rows exist to unhide (the code says L12:
  "not shown until those areas exist"; there is nothing hidden). Adding rows there was tried and reverted: any edit under
  `src/modules/dancer-app/` makes this a dancer-area PR, and `check:dancer-area-isolation` rule (a) then fails every
  changed file outside dancer-app that is not a listed seam (the wizard, NewFlow, areas). Adding seams is an orchestrator
  decision. Next step for whoever owns it: a dancer-area change adding `I teach` / `I DJ` / `Your areas` rows to
  `optionsRows` (paths from `AREA_PATHS`), with the L12 tests flipped to "real routes only".
- **D91**: `flows/new/model.ts finishReason(hasCover, server, a1)` reads the series' `series_go_live_check_v1` answer
  (`shared/goLiveCheck.ts useGoLiveCheck`, the event card's own call) for the draft series id, which the cover step
  always has. `session` code -> #885's `NO_SESSION_NEW_REASON` (and the leave link to the programme); another blocker ->
  its one label + " first."; profile rows -> `profileRowLabel`; loading -> CHECKING_REASON; a check that could not be read
  does not block (the server still refuses and that refusal is shown). `hasUpcomingSession` is gone from the New flow
  (a test asserts it). After a cover upload the check is re-read.

## Red first

D91 (`flows/new/__tests__/lastStepServerCheck.test.tsx`) against the unfixed NewFlow:

```
 FAIL  ... > '(1) a session with a start but no tit...': server says a session is missing -> Go live off, with the no-session reason
 FAIL  ... > '(2) an added session on one date, no ...': server says a session is missing -> Go live off, with the no-session reason
      Tests  2 failed | 3 passed (5)
```
Green after the change (5/5). The wizard plug-in: the old A-WEB1b test asserting a teacher step is SKIPPED failed after
the registry change (expected: that is the behaviour this slice changes), replaced as described above.

## Consistency matrix

`src/modules/areas/home/__tests__/areasConsistency.test.tsx`: 4 roles x {held complete, held N left, not held, declined}
= 16 cases; each renders Your areas AND the switcher entry from the same fake server answer and asserts identical words;
one action per row; every link matches `CATCHALL_CLIENT_PATHS`. Plus parser refusals, the 5 diff-first Add cases, the
Add->No screen flow, and the error / no-profile / progress-failed states. `areaRoutes.test.tsx`: each of the 5 paths opens
its page inside AuthGuard.

"Home": Home (organiser ProfileButton) shows ONE ring for the whole profile, no per-role line, so there is nothing per-role
to compare; the area counts come from the same `my_profile_progress_v1` it reads. Not invented a per-role Home line.

## Verified on real data (read-only prod survey, counts only)

- `my_roles_v1`, `my_role_intent_v1`, `set_my_role_intent_v1`, `set_my_role_declined_v1`, `save_my_role_v1`,
  `my_role_details_v1` are NOT on prod; `my_profile_progress_v1` and `series_go_live_check_v1` are.
- 6 claimed personas; 7 users hold an owner/manager seat; among claimed personas `person_roles`: teaching active 5,
  djing active 6, dancing 5 active + 1 null. All four row kinds therefore occur.
- Screens and the matrix use these shapes; the RPC-missing shape (today's prod) is a tested state (error + retry).

## Phone checks (Chromium, temporary harness, removed before commit)

Untracked `tmp-harness/` Vite root, Supabase client + useAuth aliased to fakes. 8 states x 390x844 and 360x640, reduced
motion on: every button/link/input: 0 under 44x44 except the visually hidden file input (1x1, existing); no horizontal
overflow in any of the 16 renders. Screens (390x844) in `docs/people-arc/screens/B-WEB3/`: your-areas filled / new
person / loading / error / no-profile / add-dj (the "Do you DJ?" step), switcher-areas (sheet stand-in around the real
SwitcherAreas), new-event-last-step-server-no-session (shape 1: start-only session, the server says no session).

## CI steps (run locally)

Base for comparison: the same step on `origin/main` (or with this branch's tracked changes stashed) where noted.

| job | step | command | exit |
|---|---|---|---|
| unit-tests | PR leg | `npm run test:unit:offline` | 1: 10705 passed, 5 failed, all `tests/integrityCouldNotRun.test.ts` ("typescript resolved in the temp repo -- precondition gone"); the same 5 fail on a clean `origin/main` worktree (sandbox) |
| unit-tests | full | `npm run test:unit` | 1: 10741 passed, 15 failed = the 5 above + 10 live-DB `*.contract.test.ts` (sandbox has no prod access); identical set right after the B-WEB1 merge, before any change |
| unit-tests | isolation | `npm run check:dancer-area-isolation` / `--self-test` | 0 / 0 ("not a dancer-area PR: rule c only") |
| typecheck | rpc typing, wallclock | `npm run check:rpc-typing`, `check:wallclock-brand` | 0, 0 |
| (local) | tsc | `npx tsc -p tsconfig.app.json --noEmit` | 99 errors, none in a file this branch touches (pre-existing: app/, ui/resizable, newpage test) |
| architecture-guard | integrity | `bash bin/check-integrity.sh` (CI chmods +x first; the lint chain's link exits 126 on the missing x bit only) | 0 |
| architecture-guard | images strict | `AUDIT_STRICT=1 npm run check:images` | 0 |
| architecture-guard | legacy, architecture, mojibake | `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture`, `check:mojibake(:self-test)`, `check:plan-hygiene:self-test`, `prove:entry-point` | all 0 |
| lint | chain | `npm run lint` | 1: only `check:integrity` (exit 126, execute bit, see above); the other 19 links PASS; eslint skipped by the chain because of that link |
| perf-budget | build | `npm run build` | 0 |
| perf-budget | budgets | `check:bundle-budget(:self-test)`, `check:first-load-requests(:self-test)`, `check:chunk-cycles(:self-test)` | all 0; dancer-app 55/55 chunks, 367.4/368 KB (a first version without the lazy switcher chunk was 59/55: fixed) |
| perf-budget | doc weight | `npm run check:doc-weight` | NOT RUN: needs GITHUB_REPOSITORY + a preview URL |
| perf-budget | lighthouse | `npm run check:lighthouse` | NOT RUN: needs a deployed preview |
| e2e-smoke | smoke | `npm run test:e2e` | INCONCLUSIVE: sandbox 10-min cap at 134/161; 6 failed, 5 were dev-server timeouts / ERR_CONNECTION_REFUSED; re-run of the failing specs on this branch: 1 failed (`organiser-home.spec.ts:55`), which also fails with this branch's changes stashed |
| phone-qa | phone / build specs | `playwright.phone.config.ts`, `playwright.build.config.ts` | NOT RUN (time); measured in the harness instead (above) |
| phone-qa-section, real-data-verified | PR body checks | | N/A: no PR (brief) |
| seo-check, db-contract-check | | | NOT RUN: need a preview / prod secrets; no SQL, no SEO surface changed (area routes are noindex) |

## Decisions

1. "Add" answers the wizard's own step in place on Your areas instead of sending the person into
   `/account/o/complete`: that wizard lives in the organiser shell (organiser choice, Finish later -> organiser Home), so a
   dancer-only person would land in the wrong area. Same component, same B-DB1 writers; Yes also records the intent so
   the server lists that area's steps (D40).
2. Switcher lists only held teacher/DJ areas (a switch list of sides you have); adding one is on Your areas.
3. Dancer area "Open" goes to `APP_HOME_PATH` (imported from `lib/accountRouting`, read only; B-WEB4 owns edits there),
   not `dancer-app/shell/routes`, because rule (c) of the isolation guard forbids importing the dancer-app module.

## Not verified

- Any of the new RPCs against a real database (none is applied anywhere I can reach); the exact `my_roles_v1` JSON shape
  is taken from the brief (`returns table(role, active, complete)`), parsed strictly.
- Whether the server's `my_profile_progress_v1` emits a `teacher:declined` / `dj:declined` step (the wizard shows it if so).
- The real Switch-profile sheet with areas in a browser (screens use a stand-in sheet; unit tests cover the real one).
- Vercel preview, phone-qa build specs on the routed pages, e2e-smoke (see table).

## Next steps

- Review worker, then the ONE fix pass. B-WEB4 adds the same `areaPaths.ts` bytes; it merges cleanly.
