# Handover: dancer-app-routing (ticket dt_bcf623c0cab0)

Brief: `briefs/dancer-app-routing.md` on `arc/briefs-dancer-rebuild` (sha 52e4675c). Branch `claude/dancer-app-routing` from `main` @ 2260d46b.

## Before / after (plain words)
- **Before:** after sign-in, a dancer landed on the old `/account` dancer home or the site home. An organiser who tapped "Your dancer profile" in the organiser menu got the OLD dancer dashboard (`/account/dancer`, "Your dancer profile") -- the owner's 2026-10-15 report. The /app redirect skipped every organiser.
- **After:** sign-in goes to `/account/continue`. That page reads ONE list of the person's sides (each organiser they run, first; then their dancer profile). One side: straight there (dancer -> `/app`). Two or more: a "Continue as..." screen. The picture at the top right of every /app screen and the organiser area opens the same "Switch profile" sheet (sides with a tick on the current one, Account settings, Sign out). `/account/dancer` now opens `/app` for anyone the gate lets in, organisers included.

## Owner workflow, as built
| # | Rule | Where |
|---|---|---|
| 1 | Explicit `returnTo` always wins, no chooser | `signInLanding()`; AuthCallback honours returnTo before the landing (unchanged) |
| 2 | One side -> straight there (dancer -> `/app/home`, or `/app/welcome` when unfinished; organiser-only -> `/account/o`) | `profileSides()` / `signInLanding()` |
| 3 | Two+ sides -> "Continue as...", organisers first and primary, every sign-in, never for one side | `ContinueAsPage.tsx` |
| 4 | Switch any time, ONE component in /app and the organiser area | `ProfileSwitcher.tsx`, mounted by `DancerAppShell` and `OrganiserShell` (lazy) |
| 5 | Old dancer home -> `/app` (replace), only when the gate lets the person in | `oldDancerHomeRedirect()` via `RedirectIfAllowed` |
| 6 | Sign-up dancer -> `/app` (via `/account/continue`); organiser roles -> organiser onboarding as before | `landingPathAfterAuth({ isSignup })` |
| 7 | "Run events? Become an organiser" row in /app Options (not Home) -> `/account/o` onboarding | `optionsModel.ts` |
| 8 | Admin-only (no dancer profile, no organiser) unchanged: site home | `signInLanding()` zero sides -> `/` |
| - | Account settings reachable from /app Options (already there) and from the sheet | `OptionsScreen.tsx:160`, sheet |
| - | Gate closed + not listed: dancer side opens today's `/account/dancer`, no redirect (never stranded) | `dancerSidePath()` |

## What changed (files)
- `src/lib/accountRouting.ts`: the ONE mapping -- `CONTINUE_AS_PATH`, `profileSides`, `signInLanding`, `switcherItems`, `oldDancerHomeRedirect`, `dancerSidePath`; `/account/continue` is not a gated path; dead `accountView` removed (its menu is gone).
- `src/lib/auth-otp-routing.ts`: `landingPathAfterAuth` -> `/account/continue` except an organiser-type SIGN-UP; `needsOrganiserLookup` removed.
- `src/pages/AuthCallback.tsx`: passes `isSignup`, drops the organiser lookup. `src/pages/Auth.tsx`: default returnTo -> `/account/continue`. `AuthStepper.tsx`, `ProfileEntryFlow.tsx`: the unrouted `/profile` -> `/account/continue`.
- New `src/components/account/profiles/`: `useProfileSides.ts` (facts), `ContinueAsPage.tsx`, `ProfileSwitcher.tsx`, `SideAvatar.tsx`, tests.
- `src/components/AnimatedRoutes.tsx` + `catchallClientPaths.ts`: `/account/continue` route.
- `src/modules/dancer-app/gate/{redirectModel,AllowedRedirect}.ts(x)`: delegate to `oldDancerHomeRedirect` with the page's view.
- `src/modules/dancer-app/shell/DancerAppShell.tsx`, `src/modules/organiser/shell/OrganiserShell.tsx`: the switcher, top right (lazy chunk). `src/modules/organiser/home/index.tsx`: the old `AccountMenu` replaced by the shell's switcher; `src/components/account/OrganiserHomeDancer.tsx` deleted.
- `src/modules/dancer-app/screens/options/optionsModel.ts`: Become-an-organiser row.
- `scripts/dancer-area-isolation-allowlist.json`: seams for this brief (see Decisions).
- Tests: new `src/lib/__tests__/accountSidesRouting.test.ts` (93 cases), `profiles.test.tsx` (14); updated auth-otp-routing, accountRouting, DancerFirstGate.matrix, navigateTargetsRoutable, dancerAppShell, OptionsScreen, authCallback.today, account.today snapshot, e2e dancer-home + options; new walk `tests/e2e-build/dancer-app-routing.build.spec.ts`.

## Decisions and INTERFACE deviations
- **Isolation guard seams widened** (INTERFACE section 5 protected list): `Auth.tsx`, `AuthCallback.tsx`, `AuthStepper.tsx` moved from protected to seams, plus the new/changed files above, each with a seamNote naming this brief. The brief names these files as work; without the move `check:dancer-area-isolation` fails. ORCHESTRATOR: mirror this in the INTERFACE file.
- An **open organiser access request is not a side** (owner: "each organiser the person runs"). Such a dancer goes to `/app`; the Options row "Run events? Become an organiser" opens `/account/o`, where the request shows. The public header icon (`/account`) still sends them to the organiser home, unchanged.
- **Per-organiser home is not supported** by the organiser area (Home shows all organisers). With 2+ organisers each button carries `?o=<id>` (the key Team/profile pages already read) so the switcher can tick the one tapped; with one organiser the plain `/account/o`.
- The Options "Become an organiser" row keys off the dancer profile's own `other_roles` (as the existing "I run events" row did), not a second organiser read in /app.
- The switcher is a lazy chunk declared in each shell (not a shared wrapper module): a shared wrapper became one more first-load chunk on /app and broke the chunk ratchet (59 vs 58).
- The sheet is portalled to `<body>`: in /app the bottom tabs covered "Sign out" (found in the walk, red-first below).
- A failed organiser or completeness read on `/account/continue` goes to `/account` (it has the error card); a closed / failed gate makes the dancer side the old dancer home.
- Not changed: `Onboarding.tsx` and `CreateVideographerProfile.tsx` `/profile` calls (retired pages, not on a sign-in path), dev-only buttons in `Auth.tsx`; `BottomNav.tsx` and `AppChrome.tsx` untouched (other worker).

## Shapes surveyed (prod, read-only, counts only, 2026-10-15)
Non-anonymous accounts: 12 dancer-only; 3 dancer + one organiser (owner via `claimed_by`; 2 of them admins); 2 admin-only (no dancer row, no organiser); 0 with two or more organisers. `dancer_area_access`: 1 row (gate open per the owner). Organiser managers (team rows) were not counted per account.

## Red-first proof
- `src/lib/__tests__/accountSidesRouting.test.ts` on unfixed `main` (2260d46): **81 failed | 12 passed (93)**. e.g. "dancer complete > sign-in with no returnTo" -> `AssertionError: expected '/account' to deeply equal undefined`; "organiser + dancer > the old /account/dancer URL" -> `TypeError: oldDancerHomeRedirect is not a function`. The behavioural one: `tests/client/dancerAppShell.test.tsx` "/account/dancer > allowed but organiser" asserted the old page stays (the owner's bug); now asserts `/app/home`.
- Walk check "switch sheet in the dancer app" (topmost element at Sign out's centre is Sign out) on the build before the portal fix: `Expected: true, Received: false`; passes after.

## CI per-job table (run in this sandbox)
| Workflow / job | Command | Exit | Result |
|---|---|---|---|
| unit-tests | `npx vitest run` | 1 | 8203+ passed; 15 failed = the same 15 that fail on `main` here (live-DB contract tests need network/secrets: eventViewCompat, occurrenceProgram, publicEventPageLineup; integrityCouldNotRun needs an exec-bit/TS helper). None in touched code |
| unit-tests / dancer-area-isolation | `check-dancer-area-isolation.mjs --self-test`, `npm run check:dancer-area-isolation` | 0, 0 | OK |
| architecture-guard | `bash bin/check-integrity.sh`, `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture`, `AUDIT_STRICT=1 check:images`, `check:plan-hygiene:self-test` | 0 each | pass (images needed `loading` on the avatar img: fixed) |
| lint chain | `npm run lint` | 1 in sandbox | 15/16 links pass; `check:integrity` exit 126 = `bin/check-integrity.sh` not executable in this checkout (CI chmods it); run via bash = ok |
| typecheck | `check:rpc-typing`, `check:wallclock-brand`; `tsc -p tsconfig.app.json` | 0, 0 | no tsc error in a touched file (repo has a pre-existing backlog elsewhere) |
| perf-budget | build, `check:bundle-budget(:self-test)`, `check:first-load-requests(:self-test)`, `check:chunk-cycles(:self-test)` | 0 each | event 376.3/381 KB; dancer-app 359.1/360 KB, 58/58 chunks |
| e2e-smoke | `npm run test:e2e` | 0 | 148/148 on the clean rerun (a first run beside a production build: 3 timeouts + 1 stale options spec, fixed) |
| phone-qa build-smoke | build with phone-qa env + `playwright.build.config.ts` (new walk spec) | 0 | 8/8 |
| ci-budget-guard | `check-ci-budget.mjs --self-test` / run | 0 / 2 | needs `CI_BUDGET_GITHUB_TOKEN` (not in sandbox) |
| workflow-lint | masking, notification (+self-test) | 0 | pass |
| seo-check, pr-mergeable | self-tests | 0 | pass; live `check:seo` / `check:og` need a deploy |
| db-contract-check | `check-migration-stamps.mjs` | 0 | others need live DB secrets |
| real-data-verified, phone-qa-section | PR-body checks | - | run on the PR |

## 390x844 walk (production build, mocked backend)
`tests/e2e-build/dancer-app-routing.build.spec.ts`, 8/8. Screenshots here: 01 dancer-only sign-in landing (straight to /app), 02 Continue as (1 org + dancer), 03 Continue as (2 orgs + dancer), 04 switch sheet in /app, 05 switch sheet in the organiser area, 06 /app Options with "Become an organiser", 07 old /account/dancer -> /app. Each asserts scrollWidth = 390; the chooser and sheet assert every control >= 44 px.
Run: build as `playwright.build.config.ts` says plus `VITE_ENABLE_ORGANISER_SELF_SERVE=true`, then `VITE_SUPABASE_URL=https://phoneqafakenotaproject.supabase.co npx playwright test --config playwright.build.config.ts tests/e2e-build/dancer-app-routing.build.spec.ts`.

## Verified / Not verified
- Verified: the mapping for every shape x entry point (table test); the chooser and sheet render only real sides, organisers first, tick correct, sign out works (component tests); the production build walk at 390x844 on prod-shaped mocks; bundle budgets; isolation guard.
- NOT verified: a real sign-in through `/auth/callback` in a browser (the callback's hop is unit-tested; the walk starts at `/account/continue`); a real phone; 360x640; live Supabase (fake backend only); Vercel preview (no token used); organiser managers (non-owner team members) in the prod survey; GitHub Actions results (they run on the PR).

## Ship
The PR body is in the PR; `PR_BODY` passes `check-pr-real-data-verified.mjs` and `check-pr-phone-qa.mjs` locally.

## What is left
Nothing in the brief's order (1)-(5) is left. Follow-ups for the orchestrator: mirror the isolation seam change into INTERFACE section 5; decide whether the organiser Home should honour `?o=` to show only that organiser.
