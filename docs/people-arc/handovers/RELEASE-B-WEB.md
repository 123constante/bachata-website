# RELEASE-B-WEB handover (integration of B-WEB3 + B-WEB4)

Branch `claude/people-release-b-web`, from `origin/main` (fb91b8a). No PR opened.

## Merges
1. `git merge origin/claude/people-b-web3` (54fbbda): merge commit, no conflicts.
2. `git merge origin/claude/people-b-web4` (a8c8dd8): merge commit, no conflicts. `src/lib/areaPaths.ts` was byte-identical on both sides.

No other conflict; nothing to resolve.

## Seams
New tests in `src/modules/areas/__tests__/releaseBSeams.{routes,empty}.test.tsx` (11 tests, all green).

| Seam | Result | Where |
|---|---|---|
| (a) New sign-up chose Teacher / DJ, empty record: `/account/t` and `/account/dj` render | PASS: "No details added yet", ONE button ("Edit details"), line-up card says "No line-ups yet" + what fills it; no blocked or error state | empty.test |
| (b) `/account/areas` for the same person | PASS after the fix pass (B1): all four roles listed, one action each; the Teacher chosen at sign-up reads "7 answers left" with Open on Your areas AND the switcher; DJ (not chosen) reads "Not added" with Add. (The first integration asserted "Not added" for both, which was the bug.) | empty.test |
| (c) Every area link, sign-up landing and Your areas open target is a REGISTERED route | PASS: each `AREA_PATHS` value is a `<Route>` in `AnimatedRoutes.tsx` and in `CATCHALL_CLIENT_PATHS`; `signupIntentLanding` returns only those or today's landing | routes.test |
| (d) Signed out, each area path goes through `AuthGuard` and returns there | PASS: `/auth?mode=signin&returnTo=<path>` for areas, t, dj | routes.test |

Seam bug fixed (test-only): `ProfileWizard.test.tsx` (B-WEB3) typed `saveRole` with no parameters, so `saveRole.mock.calls[0][1]` was a new tsc error (TS2493). Typed the mock's two parameters. Typecheck is back to the main baseline.

## CI steps run locally (job | step | command | exit)
| job | step | command | exit | vs origin/main |
|---|---|---|---|---|
| typecheck | tsc | `npm run typecheck` | 2 (99 errors) | main also 99 errors: inherited (the +1 above is fixed) |
| typecheck | rpc typing | `npm run check:rpc-typing` | 0 | |
| typecheck | wallclock | `npm run check:wallclock-brand` | 0 | |
| architecture-guard | integrity | `bin/check-integrity.sh` (after `chmod +x bin/*.sh` as CI does) | 0 | |
| architecture-guard | legacy tables / program rpcs | `npm run check:legacy-tables`, `check:legacy-program-rpcs` | 0, 0 | |
| architecture-guard | architecture | `npm run lint:architecture` | 0 | |
| architecture-guard | images | `AUDIT_STRICT=1 npm run check:images` | 0 | |
| unit-tests | dancer isolation | `npm run check:dancer-area-isolation` | 0 | |
| unit-tests | vitest | `npm run test:unit` | 1: 15 failed in 4 files | the same 4 files, same 15 failures on origin/main: inherited (live-DB contract tests `eventViewCompat`, `occurrenceProgram`, `publicEventPageLineup` need network; `integrityCouldNotRun` is sandbox-bound) |
| lint | chain | `npm run lint` | 1: only `check:integrity` exit 126 (script not executable in this checkout) | passes with the chmod above; every other link PASS |
| build | production | `npm run build` | 0 | |

Not run (need secrets, live deploy or live DB): `ci-live-db-gate`, `db-contract-check.yml`, e2e-smoke, perf-budget, og-image, seo.

## Verified
- Merges clean; both slices' own tests pass inside the merged tree (areas, wizard, AuthSignupRoleIntent, AuthCallbackRoleIntent).
- Seams (a)-(d) above, with a prod-shaped fake server at the RPC boundary.
- Production build green; typecheck at main's baseline.

## Not verified
- ~~**Screens at 390x844** (a)-(b) under `docs/people-arc/screens/RELEASE-B-WEB/`: NOT produced.~~ Produced in the fix pass (below). Needs a signed-in session against the Release B RPCs, which are not on prod; no harness built in this run. Next worker: render the two pages with the fake server from `releaseBSeams.empty.test.tsx` in Playwright.
- **Real server behaviour**: `my_role_details_v1` for a person with NO teacher record is not specified in B-DB1 (the brief for it was not in the files I read). The tests assume it returns the role with empty details. If it instead refuses (e.g. an unknown code), the page shows the generic "did not save/load" error with Retry, not an empty state. Check once the RPC is on a branch DB.
- ~~**(b) intent**~~ (fixed in the fix pass, B1): Your areas read only `my_roles_v1`; it does not read `my_role_intent_v1`. A sign-up that chose Teacher shows "Not added" + "Add" unless the server's `my_roles_v1` counts intent as active. Product call: if the owner wants the choice reflected, that is a server change (or a client read of intent), not done here.
- Browser walk, phone test, the `real-data-verified` block (Release B RPCs are unapplied, so prod-shape survey of the new RPCs is impossible).
- Supabase read-only: no query was run.

## Fix pass (FIX-RELEASE-B-WEB, D99/D100; review `claude/review-people-release-b-web` 2a16dda)

Base 9a469d9. Every fix was red first: the new rows were written, run on 9a469d9 (12 failed: the 2 S2 rows, both seam (b) tests,
dancer/organiser `n-left` and teacher/DJ `intent-only` matrix rows, the one-wording and `isAreaShown` tests, the 2 N1 tests),
then the code was changed and the same suites ran green (172 files, 4488 passed in areas + pages + organiser).

| Finding | Outcome | Test that proves it |
|---|---|---|
| B1 (blocking) Teacher/DJ chosen at sign-up read "Not added" | **Fixed.** `areaStatus.ts` exports ONE `isAreaShown(role, row, progress)`: active, or a teacher/DJ with steps in `my_profile_progress_v1` (the server already drops declined roles). Such a role reads the open count with Open. `areaStatus` and the switcher's `held` filter both use it; no second copy. | `releaseBSeams.empty.test.tsx` (b): prod-shaped fake (teacher `active:false`, 7 open optional teacher steps) -> "7 answers left" + Open on Your areas AND the switcher, DJ "Not added" + Add, no DJ switcher entry. `areasConsistency` `teacher/dj, intent-only` rows and the `isAreaShown` table. |
| S1 two wordings for the open count | **Fixed.** `toFinishWords = requiredLeftText` (imported from `organiser/shared/profileProgress.ts`, not copied). Header comment now names its real importers (YourAreasPage, SwitcherAreas). | `areasConsistency`: `toFinishWords` is `requiredLeftText`; new Home/wizard column renders `ProgressBar` (wizard) and `profileTodoSub` (Home) from the SAME progress fake and expects the same "N answers left" as the row. Note: Home/wizard count only REQUIRED answers; teacher/DJ have none, so for an intent-only teacher Home shows no count while Your areas shows "7 answers left" (its open optional steps, as B-WEB3's `stepsLeft` defined). Same wording, different scope; the column asserts that explicitly. |
| S2 sign-up form on an existing account overwrote intent | **Fixed.** `AuthCallback.tsx` records intent only when `isFirstSignIn(user)`. Landing is unchanged. | `AuthCallbackRoleIntent` new rows "sign-up mode, existing account -> zero intent calls" (link and code carriers). The 112-row table now runs with a brand-new account (`email_confirmed_at` ~ `last_sign_in_at`) and still expects exactly one call. |
| S3 matrices used unreachable teacher/DJ shapes | **Fixed.** Matrix cases per role: teacher/DJ = complete, intent-only, not-held, declined; dancer/organiser = complete, n-left, not-held (`required_left` now equals the open required steps). The "progress fails" row moved to dancer. B-WEB3 `your-areas-filled.png` re-taken on a reachable shape (dancer complete, organiser 2 answers left, teacher complete, DJ said no). | `areasConsistency.test.tsx` |
| S4 unreadable sign-up screenshots | **Fixed.** The blur was a capture taken mid page-enter; re-taken after the page settled (the "Not now" header link is not an overlay). Six `B-WEB4/signup-roles-*` re-taken; none-disabled scrolled so the reason and the disabled Continue show. New `RELEASE-B-WEB/seam-a-teacher-area-new-{390x844,360x640}.png`, `seam-b-your-areas-new-{390x844,360x640}.png`. All 13 PNGs looked at before commit. Harness: a temporary phone spec on `playwright.phone.config.ts` (fake Supabase + routed Release B RPC answers), deleted before commit. | screenshots |
| N1 last step named the flyer after upload | **Fixed (both halves).** `model.ts` `serverCheckOf(query)`: a refetch in flight reads as pending (CHECKING_REASON); `finishReason` never names `cover` when the step has a photo. `NewFlow.tsx` uses `serverCheckOf`. | `goLiveSession.matrix.test.ts`: two new tests. |
| N2 failed server check leaves Go live enabled | Note only (below). | n/a |
| N3 Videographer/Vendor gone from sign-up | Note only (below). | n/a |
| Optional 8: route callback intent via `rolesApi` | **Not done.** `rolesApi.ts` lives in the areas module (its own chunk); importing it from `/auth/callback` would pull that chunk onto the callback's first load. Left as `rpcLoose` + `parseRoleIntentResult` (two parsers for one RPC, as the review noted). | n/a |

### Known differences / owner notes
- **N2**: on the New event last step, a server go-live check that FAILS to load leaves Go live enabled; the server refuses a series that is not ready and the refusal is shown. The event card instead shows an error state. This is the one remaining difference between the two surfaces.
- **N3**: Videographer and Vendor are no longer sign-up choices ("What do you do?" offers Dancer, Organiser, Teacher, DJ). Old `?userType=videographer|vendor` links still work silently (they set `user_type`, and AuthCallback still routes them).
- Product question from the review (S3): a held teacher/DJ with 0 of 7 details reads "Complete" because the server's `profile_requirements_v1` has no required teacher/DJ fields. Unchanged.

### Fix-pass gates (sandbox; job | command | exit)
| job | command | exit |
|---|---|---|
| perf-budget | `npm run build` (production) | 0 |
| perf-budget | `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | 0, 0, 0 |
| unit-tests | `npm run test:unit:offline` | 1: 470 files (1 failed), 10862 passed, 5 failed, 18 skipped. The 5 are all `tests/integrityCouldNotRun.test.ts`, the same 5 the review measured on `origin/main` fb91b8a: **inherited** (sandbox-bound) |
| unit-tests | `check:dancer-area-isolation` | 0 |
| lint (chain) | `npm run lint` (after CI's `chmod +x` on `bin/*.sh`, `scripts/*.sh`; modes restored before commit) | 0 |
| architecture-guard | `AUDIT_STRICT=1 npm run check:images`, `lint:architecture`, `check:legacy-tables`, `check:legacy-program-rpcs` | 0, 0, 0, 0 |
| typecheck | `check:rpc-typing`, `check:wallclock-brand` | 0, 0 |
| typecheck | `tsc -p tsconfig.app.json --noEmit` | 114 errors before AND after this pass (same count; none in touched files): inherited |
| e2e-smoke, phone-qa (full), db-contract-check, Vercel preview | not run: need the smoke build server / secrets / a deploy. GitHub Actions may also refuse jobs for billing; this table is the fallback. |

### Verified (fix pass)
- Red on 9a469d9, green after, for every finding with code (B1, S1, S2, S3, N1).
- Your areas and the switcher, in a real Chromium at 390x844 and 360x640, against the prod-shaped fake: Teacher "7 answers left" + Open, DJ "Not added" + Add (screenshots).
- Server shapes read from admin `claude/people-release-b-admin` migrations via the review (my_roles_v1 active only from person_roles; progress lists intent-only teacher steps).

### Not verified (fix pass)
- The Release B RPCs are still not on prod or a reachable branch DB: no live call; shapes come from the migration SQL as read by the review. No Supabase query was run in this pass.
- No real-device phone test; e2e-smoke, full phone-qa, Vercel preview not run.
- `isFirstSignIn` known miss (pre-existing, documented in `auth-otp-routing.ts`): an account pre-confirmed at creation is not "first", so its sign-up intent would NOT be recorded. OTP sign-up confirms on first verify, so the normal path is covered.
