# Handover: P3 W4b build 2, slice 1 - onboarding shell + person screens 10-19

## Fix round 1 (2026-10-29, review `docs/review/pr-1130-r1.md`, brief `docs/briefs/p3-w4b2-fix1.md`)

Owner decision: the PERSONAL EMAIL screen (20) is DROPPED. The path now ends at About, or at years with no
page (or at Do you teach? with teach = No and no page). Removed: the step, its copy, its command
(`signinEmail`), the `save_my_signin_email_v1` call (it had no other importer, so it is gone from
`personApi.ts` too), the `.p3-ob-card` CSS it alone used, its tests and its e2e step. Tests pinning the old
path were changed first and failed on the unfixed code (20 red), then went green.

| Item | Done |
|---|---|
| Merge `origin/main` | merged (conflict: `package.json` `test:e2e`, kept main's `walk-w3c-1-repeat` then this `walk-p3-w4b2-person`) |
| S1 levels not prefilled | prod `my_role_details_v1('teacher')` has NO `levels_taught`. Database untouched. The invented key is gone from both fixtures (matrix + e2e); a "prod today" teacher shape (the seven keys `_role_details_v1` emits) pins `levels = []`. **Levels are NOT prefilled yet**: a returning teacher answers Levels again. Queued admin item: emit `levels_taught` from `_role_details_v1` (+ a Website contract check pinning the key) |
| S2 PR body | "Verified on real data" reformatted to the three one-line labels; `check-pr-real-data-verified.mjs` run on it |
| S3 nationality six | `NAT_FEW = ['GB','ES','DO','IT','PL','BR']` (the prototype's) are the on-screen chips; `POPULAR_NATIONS` (home nations first) stays the sheet's first section; tests pin both |
| S4 extra /app request | `PersonFlow` no longer imports `@/constants/countries` (a dynamic import of it split it out the same way: a dynamic entry is its own chunk). It reads `world-countries` through the existing `wizard/wizardCountries.ts`, which exists for this exact ratchet. Both flags on (`VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true`), `check:bundle-budget`: main /app 375.3 KB / 50 chunks, branch 375.4 KB / 50 chunks (dancer-app 31.7 KB on both; no `countries-*` chunk on the branch). Both are over the 374 KB / 49 budget with the flags on, on main too (the budget is tuned to the flag-off build); flag-off the branch passes every budget |
| S5 `dancer_area_open` | risk row in `docs/plans/onboarding-arc.md` section 10; `area_closed` maps to `AREA_CLOSED` ("Your dancer details are closed for now, so we can't load or save them. Try again later.") on the read-failed screen and on teacher / About saves. Dancer-field saves go through `saveWizardDancer`, which rewrites server codes into its own copy first, so there it still shows the generic "Couldn't save" |
| S6 percentage | for slice 3, below |
| N1 | toast `onDone` memoised (`useCallback`); a test types while the toast shows and the toast still goes |
| N5 | the geometry walk loops `[true, false]`: the EMPTY persona is measured on every screen before it is answered (14 tests) |
| Mutation (replaces the wrong evidence below) | the 700 px step's `.p3-ob-main { gap: 8px }` set to 60 px: 8 failed / 6 passed (both personas, every 360x640 and 320x568 cell; About up to 135 px, langs 15 px and levels 43 px in the empty persona), reverted. The old "base rule `gap: 60px`" mutation was NOT caught: the 700 px container step overrides it at every measured size |

**Left (skipped by the brief):** N2 (gone with the email screen), N3 (`?o=` not checked against the
person's own pages: scope it to `home.data.organisers` ids when slice 3 adds the link), N4 (`PERSON_STALE_KEYS`
misses the P3 home / organiser keys after an About save), N6 (Esc `preventDefault` on `window` also swallows
the native clear of the search field).

**For slice 3 (S6):** `progressPercent(step, personPath(...))` counts only the person steps, so it reads
100% on About. When slices 2 and 3 land, the percentage MUST be rebased onto the full path (contact,
WhatsApp, category, link, logo ... the person steps ... Review), or the bar shows 100% with Review still
ahead. Pass the full path into `progressPercent`.

---

The text below is the slice 1 handover as first written; where it says screens 10-20, personal email or
`save_my_signin_email_v1`, the fix round above supersedes it.

Branch `claude/p3-w4b2-shell-person` (from `main` at `3f8f373`). Brief: `docs/briefs/p3-w4b2.md` on
`brief/p3-w4b2-shell-person`. Design record: [`docs/design/onboarding-prototype.md`](../design/onboarding-prototype.md)
(+ `.html`). Flag `organiserP3` stays OFF; nothing outside `/account/p3` changes. No migration, no `supabase/**`.

## Done

- **Route** `/account/p3/you/details[?o=<organiser id>]` (`P3_PATHS.youDetails` / `youDetailsFor`), lazy
  (`lazyWithRetry` in `P3Routes`), mounted OUTSIDE `P3Shell` so it is full screen with no tab bar. Without
  `?o=` it uses the first page from `organiser_home_v1`; with no page at all, About is not on the path.
  Nothing links to it yet: slice 3 (Review / Home) is the way in. Walk it by URL.
- **Shell** (`p3/onboarding/ObShell.tsx`, `obEnv.ts`, `onboarding.css`): `100dvh` (never `100vh`); while a
  text field inside it is focused the height follows `visualViewport.height` (+ `offsetTop`) and the page is
  scrolled to 0 (`resize` + `scroll` + focusin/focusout listeners). The fit steps are container queries on
  the shell (`700 / 370w / 520 / 480 / 320`), ported 1:1 from the prototype. Top strip: Back (44x44), the
  4px bar and the PERCENTAGE (owner change 2): `role="progressbar"`, `aria-valuenow` = the shown % =
  round(step / path length x 100); the path drops levels/styles/years on teach = No and About with no page.
  Esc closes an open sheet first, else Back. Title gets focus on each screen with `preventScroll`.
- **Look**: playful (gold title, owner change 1), pill radii, 17/14/24px type with `--ts`, px only, light
  by default (`localStorage['p3-ob-theme']`, the key slice 3's Settings switch writes), true-black dark
  tokens from the prototype. Motion: slide-in, tick pop, Continue bounce + `navigator.vibrate(12)`; all off
  under `prefers-reduced-motion`.
- **Screens 10-20**, one question each: first name, photo (required; "Take a photo" `capture="user"` /
  "Choose from gallery", `uploadToR2('avatars')`), role (Leader / Follower / Both = `Lead and Follow`),
  nationality (search + six popular chips + "All countries" sheet; FLAG IMAGES on chips, chosen chip and
  sheet rows), languages (optional, 38, Skip), Do you teach?, levels (4 cards), styles (14 + held custom
  ones), years (0-60), About <page> (optional, starter sentence, Skip), personal email (optional).
- **Flags** (owner change 3): `<img src="https://flagcdn.com/<code>.svg" loading="lazy" width=24 height=18>`,
  `gb-eng / gb-sct / gb-wls / gb-nir` for the home nations; flagcdn is already used by CityBlock/CityCard.
  The full country list is the existing lazy `loadCountries()` (world-countries). All of it lives in the
  route's own chunk: zero bytes on `/app`'s first load (see bundle row below).
- **Data source, proven read-only on prod 2026-10-29** (`pg_get_functiondef`):

  | Screen | Reads | Writes (who writes it) |
  |---|---|---|
  | name, photo, role, nationality, languages | `my_dancer_edit_v1` | `save_my_dancer_profile_v2` one key (`dancer_profiles.first_name / avatar_url / dance_role / nationality` (trigger `_normalise_nationality_v1` keeps alpha-2) `/ languages`) |
  | teach | `my_role_intent_v1` | `answerDoYou` -> `set_my_role_intent_v1` / `set_my_role_declined_v1` (`account_role_intent`) |
  | levels, styles, years | `my_role_details_v1('teacher')` | `save_my_role_v1('teacher', {levels_taught / teaching_styles / years_teaching})` (`teacher_role_details`; `levels_taught` + `invalid_levels` are live) |
  | About | `organiser_profiles` public select (name, bio, category, city) | `organiser_profile_update_p5_v1 {bio}` (partial patch: the RPC iterates present keys); Skip = `skip_organiser_about_v1` (`organiser_onboarding_progress.about_skipped_at`) |
  | personal email | - | `save_my_signin_email_v1()` (private `dancer_profiles.email`; no-op while `show_contact_publicly`) |

  `my_dancer_edit_v1` and `save_my_dancer_profile_v2` call `_dancer_area_require_v1()`; prod flag
  `dancer_area_open` = true, so every signed-in account passes. If that flag is ever turned off, these
  screens refuse for anyone not on `dancer_area_access` (1 row).
- **Shape survey** (counts only): nationality null 173 / alpha-2 22; languages null 78 / [] 100 / 1-3 17;
  dance_role null 149 / Leader 21 / Follower 17 / Lead and Follow 8; email set 6 / null 189; teacher rows 21,
  `levels_taught` null on all, styles 0/1/2, years set on 1; role intent rows 10, none declining teacher.
- **Tests**: `personModel.matrix.test.ts` (63: path x teach x page, % rises to 100, reason per step,
  untouched = no command per step, one-key command per step, `heldAfter` stops re-sends, `heldFrom` over the
  prod shapes, six-chip filter, starter never invents) and `personScreens.matrix.test.tsx` (26: every screen
  x empty / filled, aria-valuenow = shown %, off-button toast, flag is an `<img>` not emoji, sheet portalled
  to body + focus moved in, Esc order, save failed keeps the answer, teach = No path both ways, About skip).
  E2E `tests/e2e/walk-p3-w4b2-person.spec.ts` (8, added to `test:e2e` by name): every screen at 390x844,
  360x640, 320x568, each at 100% and 130% text: `.p3-ob-main` and the shell have scrollHeight <=
  clientHeight, no horizontal overflow, every control >= 44x44; toast and nationality sheet boxes inside the
  viewport at 390x844, no page scroll when the sheet opens. Green twice in a row with both flags on.
  Mutation: `.p3-ob-main { gap: 60px }` makes it fail (About scrolls 83px at 320x568).

## Decisions taken here (say if wrong)

1. **Personal email screen differs from the prototype.** The live `save_my_signin_email_v1()` takes NO
   argument: it copies the SIGN-IN email to the private record. There is no RPC that stores a different
   typed address, so the screen shows "You sign in as X" with "Save it privately" / "Skip for now" instead
   of a free field. A typed second address needs an admin RPC (owner call).
2. **About is the organiser's About** (plan A7, prototype "About <page>"), so it needs a page id; with no
   page it is not on the path.
3. Every screen is on the path even when already answered (prefilled; an untouched Continue sends nothing).
   Jumping to the first missing one is slice 3's Review job.
4. No photo crop sheet and no Years "Add more (optional)" sheet (private lessons) in this slice.
5. Flags from flagcdn.com (already used and reachable) rather than bundling ~250 SVGs into the repo.

## Left / next

- Slice 2 `claude/p3-w4b2-page` (screens 1-9), slice 3 `claude/p3-w4b2-finish` (Review, go-live, Home banner,
  Settings sheet with the dark switch that writes `p3-ob-theme`, and the link into this route).
- The walk SKIPS in the e2e gate today (e2e-smoke's server has `organiserP3` off), same as build 1's walk.
- Orchestrator walk on the Vercel preview with `organiserP3` on; one independent review + one fix round.

## Verified / Not verified

Sandbox run of every PR job step (2026-10-29, branch vs `origin/main` worktree):

| Workflow / job | Result |
|---|---|
| architecture-guard / integrity (incl. `check:images` AUDIT_STRICT=1, mojibake, image-widths, entry-point) | PASS after fix (first run: photo preview `<img>` had no `loading`) |
| typecheck / wallclock-brand | PASS; `tsc` 99 errors on both main and branch, identical lists, none in changed files |
| unit-tests / unit London | 16 fail on BOTH main and branch (live-DB contract suites with no secrets, goingPhoto, integrityCouldNotRun); branch-only failure (B-N8 raw Unicode punctuation: the writer turned `\u2019`/`\u2026` escapes into raw characters) FIXED, consistency matrix + `src/modules/organiser/p3` 2095/2095 |
| unit-tests / New_York, Sydney, timing, dancer-area-isolation | PASS |
| workflow-lint, phone-qa (406 pass), build-smoke (73 pass), live-db-gate, contract-check (runnable steps) | PASS |
| perf-budget / bundle-budget | PASS: `/app/*` first load 373.7 KB on main AND branch, 49 chunks both, every route byte-identical |
| e2e-smoke `test:e2e` | 180 pass, 26 skip; `organiser-home.spec:55` timed out once and passed on rerun, flaky on main too; the new walk skips (P3 off) |
| new walk with both flags on | 8/8, twice in a row |
| db-contract-check secret steps, og/seo/lighthouse, phone-qa-section, real-data-verified | not runnable here (secrets / preview / PR body) |

`npm run lint`: only `check:integrity` fails, identically on main (bin/*.sh are mode 644 in this checkout; CI chmods them). eslint: 0 messages in changed files.

**Verified:** the data contract on prod (function bodies, read-only), the prod shapes (counts), the
table-driven matrix (89 tests), no page scroll on every person screen at 390x844 / 360x640 / 320x568 at
100% and 130% text in Chromium with prod-shaped fakes, tap targets >= 44, toast + sheet in viewport, zero
bytes on `/app` first load.

**Not verified:** a real iPhone keyboard (`visualViewport` path) and a real Android; the browser-viewport
heights (390x664 / 360x560 / 320x460) and keyboard-open cells in the app (the prototype measured them; this
walk did not); Safari / Firefox container queries; dark mode in the walk (the tokens are the prototype's
measured set); a real photo upload to R2 (stubbed in tests); real saves against prod (no writes allowed
here); the Vercel preview; `/code-review` and the independent Fable review (next step per the brief).
