# B-WEB4 handover: sign-up roles, intent, landing, "Already listed?" step

Branch `claude/people-b-web4`, from `origin/main` at `fb91b8a4` (Release A web on it). Brief:
`123constante/bachata-admin` `brief/people-d89:briefs/people-arc/B-WEB4.md` (sha f1065e72). Ticket dt_6d2f4e67a62f.
No PR opened (brief: "Open NO PR"). One push.

## What I built

| File | What |
|---|---|
| `src/lib/areaPaths.ts` | NEW, the pinned bytes exactly (`AREA_PATHS`, `AreaKey`). The index stores LF, like every other `src/lib/*.ts`, so it matches B-WEB3's add. |
| `src/lib/auth-otp-routing.ts` | The pure rules (no React): `SignupRole`, `SIGNUP_ROLE_OPTIONS` (Dancer, Organiser, Teacher, DJ), `DEFAULT_SIGNUP_ROLES` (`['dancer']`), `SIGNUP_ROLES_REQUIRED_ERROR`, `parseSignupRoles(raw)` (known values only, deduped, in screen order; else null), `toggleSignupRole`, `signupUserType(roles)` (organiser if ticked, else dancer), `PENDING_ROLE_INTENT_KEY` / `ROLE_INTENT_META_KEY`, `readSignupRoles(stored, meta)` (this browser's stash first, then metadata), `SET_MY_ROLE_INTENT_RPC`, `parseRoleIntentResult`, `holdsSeatFromOrganiserHome`, `choseTeacherOrDj`, `signupIntentLanding({roles, holdsOrganiserSeat, todays})`, `showsAlreadyListedStep({roles, claimStatus})`, and the C13 copy plus WhatsApp URL (built with `dancerMessageUsUrl` from `contactLinks.tsx`). |
| `src/pages/Auth.tsx` | Step 1 is now **"What do you do?"**, a multi-select (`role="group"`, each choice a 44 px `aria-pressed` button with a tick box). Dancer is on by default; a `?userType=` link for one of the four also pre-ticks that role. Videographer and Vendor are no longer offered (the brief names four). With nothing chosen, Continue is disabled and the reason "Choose at least one to continue." shows above it (`aria-describedby`). On send, a sign-up puts `role_intent: [...]` in the sign-up metadata and in `localStorage.pending_role_intent` (for the typed-code path). The older `user_type` is `organiser` if Organiser is ticked, else `dancer`. A sign-in sends nothing and clears the stash. The #789 focus mode (top bar "Not now") is unchanged, and the step still sits inside it. |
| `src/pages/AuthCallback.tsx` | After the dancer claim and `claim_my_organisers_v1`, a **sign-up only** reads the roles and calls `set_my_role_intent_v1({p_roles})` **once**, through `rpcLoose`, the one string-named boundary that the two claim calls already use. It has a 4 s timeout, never throws, and logs only "not recorded" (no roles, nothing private). If Teacher or DJ was chosen and no pages were claimed, it reads `organiser_home_v1` to tell whether the person holds a seat (4 s timeout; a failed read counts as unknown). The landing then goes through `signupIntentLanding`. C13: `land()` takes a first detour to the "Already listed on Bachata Calendar?" screen (WhatsApp "Ask us to link your profile" plus Continue, both 44 px). Continue then lands where that landing was going. |

Rules, as built:
- Landing (sign-up, no honoured returnTo): seat (pages claimed now, or `organiser_home_v1` lists any) -> today's landing; else Teacher -> `/account/t`; else DJ -> `/account/dj`; else today's landing. Today's landing for an Organiser sign-up is `/account/o` (the existing claim/ask/create path); for anyone else it is `/account/continue`. An explicit returnTo, then a stashed one, still wins over all of these (that code is untouched and runs first).
- C13 shows only when Teacher or DJ was chosen and the dancer claim answered `no_match`. It never shows after `linked`, and not after `already_linked`, `ambiguous`, `email_unproven`, `not_applicable` or `unavailable`. It also shows before a returnTo landing (it is about the person, not the destination).
- Organiser intent grants nothing (C12). It is recorded and only sets `user_type`, as the existing organiser link already does.
- No second meter (D95, C15).

## Decisions I made (reviewer: please check)
1. **Organiser + Teacher with no seat lands on `/account/t`**, following the brief's order literally (seat -> Teacher -> DJ -> today's). The organiser create/ask path is still reachable from today's surfaces, but this person does not land on it first. If the owner wants Organiser to win here, swap two lines in `signupIntentLanding`.
2. **A failed seat read keeps today's landing** rather than guessing Teacher/DJ (`/account/continue` then routes by sides).
3. **C13 only on `no_match`.** "Found no existing person" is read strictly. `ambiguous` (several matches) is not shown the screen.
4. **The failure fallback (profile could not be filled) still lands on returnTo / stash / claim / `/`**, unchanged. C13 still detours it, but Teacher/DJ does not move it, because an unfilled profile means the existing recovery route.
5. The C13 screen uses the auth pages' own shadcn `Button`/card look (same screen family as `/auth` and the callback skeleton), not organiser `ui/**` primitives.
6. **frontend-design skill: NOT loaded.** It is not available in this cloud session's skill list. I applied the existing auth-page styles and tokens; no new palette, fonts or primitives.
7. Changing the step's markup broke existing tests that pinned the old wording ("What brings you here?" / "Continue as Dancer"). I updated them to the new step: `AuthJourneyFixes`, `AuthOtpDisabled`, `AuthSignupDanceRole`, `pickerAccessibleName`, `tests/client/authPage`, `tests/regression/today/auth.today` (+ its snapshot: only the role-step tree changed), `tests/e2e/auth-stepper-{smoke,email-routing}.spec.ts` (in the e2e-smoke gate), `tests/e2e-build/helpers/journeyHarness.ts`.
8. The new callback test mocks `claimMyOrganisers` at its module boundary, because `lint:architecture` forbids the raw `organiser_id` field outside an allowlist I do not own.

## Proof

### Red first (new tests against `main`'s Auth.tsx / AuthCallback.tsx / auth-otp-routing.ts, no areaPaths.ts)
`npx vitest run src/pages/__tests__/AuthCallbackRoleIntent.test.tsx src/pages/__tests__/AuthSignupRoleIntent.test.tsx`
```
Test Files  2 failed (2)
Failed Tests 132
  AssertionError: expected '/account/continue' to be '/account/t'
  AssertionError: expected '/account/continue' to be '/account/dj'
  TestingLibraryElementError: Unable to find an element with the text: Already listed on Bachata Calendar?
  AssertionError: expected [] to deeply equal [ [ 'set_my_role_intent_v1', ... ] ]
```
(The 9 that pass on main are rows where the landing doesn't change: sign-in rows and "no roles carried".)
On this branch: **141 passed** (129 callback + 12 sign-up screen).

### The table (`AuthCallbackRoleIntent.test.tsx`)
7 role sets {dancer; dancer+organiser; dancer+teacher; dancer+dj; dancer+teacher+dj; organiser+teacher; dj} x seat yes/no x claim linked/no_match x returnTo set/unset x carried by link-metadata / typed-code storage = 112 rows. Each row asserts the landing path (against a rule written out independently in the test, with literal paths), whether C13 shows first (with 44 px targets and a wa.me link), exactly one `set_my_role_intent_v1` call with the cleaned roles, and that the stash is cleared. Plus: 7 sign-in rows (zero intent calls, zero seat reads, no C13); RPC missing / throwing still lands; failed seat read -> today's; claimed pages -> `/account/o` with no seat read; no roles -> no calls; attacker-shaped roles cleaned to `['teacher']`; C13 hidden for ambiguous / unavailable / already_linked / email_unproven.

### Screens (`docs/people-arc/screens/B-WEB4/`, 390x844 and 360x640, dev server + fake Supabase from the phone suite)
`signup-roles-default-*`, `signup-roles-teacher-dj-*`, `signup-roles-none-disabled-*`, `callback-already-listed-*`. In the same run, the temporary spec (not committed) measured every choice, Continue, the WhatsApp link and C13's Continue at >= 44 px tall at both sizes, with no sideways scroll. In the browser it saw `set_my_role_intent_v1` posted once with `{p_roles:['dancer','teacher']}`. C13's Continue then left the callback; in the fake, the profile is unfilled, so it took the existing fallback to `/`.

### CI, every job step that applies (run locally; Actions not relied on)
| job | step | command | exit |
|---|---|---|---|
| architecture-guard | integrity guard | `bash bin/check-integrity.sh` (CI chmods first) | 0 |
| architecture-guard | legacy tables | `npm run check:legacy-tables` | 0 |
| architecture-guard | legacy program RPCs | `npm run check:legacy-program-rpcs` | 0 |
| architecture-guard | runtime architecture | `npm run lint:architecture` | 0 (after fix 8) |
| architecture-guard | image audit | `AUDIT_STRICT=1 npm run check:images` | 0 |
| architecture-guard | plan-hygiene canary | `npm run check:plan-hygiene:self-test` | 0 |
| architecture-guard | mojibake canary + guard | `npm run check:mojibake:self-test`; `node scripts/check-mojibake.mjs` | 0, 0 |
| typecheck | RPC typing | `npm run check:rpc-typing` | 0 |
| typecheck | WallClock brand | `npm run check:wallclock-brand` | 0 |
| unit-tests | dancer-area isolation canary + check | `node scripts/check-dancer-area-isolation.mjs --self-test`; `npm run check:dancer-area-isolation` | 0, 0 |
| unit-tests | unit + contract suite | `npm run test:unit` | 1: see below |
| perf-budget | 3 canaries | `check:bundle-budget:self-test`, `check:first-load-requests:self-test`, `check:chunk-cycles:self-test` | 0, 0, 0 |
| perf-budget | build | `npm run build` | 0 |
| perf-budget | budgets | `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | 0, 0, 0 |
| e2e-smoke | smoke suite | `npm run test:e2e` | 1: 157 passed, 1 failed, 3 skipped; see below |
| perf-budget (preview) | Lighthouse, doc weight | `check:lighthouse`, `check:doc-weight` | NOT RUN: needs a deployed preview |
| phone-qa | phone suite / build smoke | `playwright.phone.config.ts` full suite | NOT RUN in full; only my temporary B-WEB4 spec ran on that config (4 passed) |
| phone-qa-section, real-data-verified | PR-body checks | | NOT APPLICABLE: no PR opened (brief) |
| local | lint chain | `npm run lint` | 1: only link `check:integrity` exit 126 (not executable in this sandbox); `bash bin/check-integrity.sh` = 0 |
| local | `npm run typecheck` (full tsc, not a CI step) | | 2: 99 errors, none in files I touched (app/ route types etc.) |

`npm run test:unit` failures, all outside this change:
- `tests/{eventViewCompat,occurrenceProgram,publicEventPageLineup}.contract.test.ts`: "Invalid API key", which means the live-DB key is not in this sandbox.
- `tests/integrityCouldNotRun.test.ts`: "typescript resolved in the temp repo -- precondition gone" (sandbox has a typescript reachable outside the temp repo).
- Every auth-step failure from my change is fixed (decision 7). Afterwards, a re-run of `src/pages src/lib` plus the touched test files had one failure, `DancerFirstGate.matrix` "returnTo round-trips", under parallel load. It passed alone (114/114).

`npm run test:e2e`: `organiser-home.spec.ts:55` "a load failure shows the error state and Retry recovers" timed out (15 s) under the full parallel run. It passed alone on its one re-run (16 s). It does not touch sign-up.

eslint on the touched source files: 7 errors, 4 warnings, all already on `main` (main had 8 errors; one setState-in-effect went with the removed effect). Nothing new.

## NOT verified
- `set_my_role_intent_v1` against a real database: it is not on prod (Release B admin PR). Tested only through the boundary fake. The response parser follows `claude/people-b-db1-roles` (`my_role_intent_v1() || {changed}`).
- `/account/t` and `/account/dj` pages: B-WEB3 adds the routes. The tests assert the paths only.
- A real e-mailed link (Supabase `options.data` on a brand-new user carrying `role_intent`), and a real phone.
- Real-data shape survey: this slice reads no listing data; the shapes it meets are claim statuses and seat counts, all covered by the table.
- Full phone-qa suite, Lighthouse, doc weight (see table).

## Next steps
- Reviewer: decisions 1 to 4 are the forks to confirm.
- After B-WEB3 merges: check that `/account/t` and `/account/dj` render for a new sign-up with no teacher/DJ record yet (the empty state must say what the person can do).
