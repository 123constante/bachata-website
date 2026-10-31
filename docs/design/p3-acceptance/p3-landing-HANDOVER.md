# p3-landing handover (PARTIAL, worker dt_2b1b5b6062ff, 2026-10-31)

Brief: `brief/p3-landing:docs/briefs/p3-landing.md` (blob fd8ce92). Branch `claude/p3-landing` (made from main 3677c6d).
Owner decision 1 (c) is built. The flag is NOT flipped. Vite env is untouched. `perf-budgets.json` and `vite.config.ts` are untouched.

## Done
- `src/lib/organiserAreaHome.ts` (new leaf, no imports): `organiserAreaHome(flags, o?)`, `p3AreaLive`, `isOrganiserAreaPath`,
  `LEGACY_UNTIL = '2026-11-08'` (old area honoured through 7 Nov, London day), `legacyAreaHref`, `r1ToP3Path` (the full R1 -> P3 map),
  `r1AreaRedirect`.
- `/account/o/*` -> P3 while live: `shell/OrganiserRoutes.tsx` redirects before AuthGuard and the dancer-first gate. This is inside the lazy chunk,
  so AnimatedRoutes, LegacyRedirect and legacyPaths are unchanged (no bytes on first load). `?legacy=1` is stored per tab in sessionStorage
  (`organiser.legacyArea`) so R1's own links keep it. `/account/o/complete` stays in R1 because it is the F-06 link target.
  Old `/account/new|series|team` links go legacyAccountPath -> R1 URL -> the same redirect (2 hops). The brief asked for a direct map in legacyPaths.ts.
  That was not done, to keep zero first-load bytes. The 2-hop chain is tested.
- Doors (F-01, F-04): accountRouting gets a new `organiserHomeTo` fact (absent = /account/o, as before), supplied by useProfileSides.
  Also changed: ContinueAsPage `hasSwitcher`, claimSignInLanding, DancerHome (3 links), optionsModel `ORGANISER_AREA_PATH`, NoProfileWayOut,
  areaStatus `AREA_HREF.organiser`, PublicClaimCard (adds `?o=` only while live, so flag OFF is byte-identical), JoinScreens Done (no-id branch).
- F-05: while live the Done button says `buttonP3` "Open your organiser area" (it lands on P3 Welcome / Home). With the flag off it says "Open your organiser home", as before.
- F-06: DetailsScreen and PricesScreen profile-lock links are `<RouterLink>` (testid `p3-profile-lock-link`).
- Dated fallback link: P3 You hub `p3-you-legacy-area` "Use the old organiser area (until 7 November)". It disappears from LEGACY_UNTIL.
- Tests: new `src/lib/__tests__/p3Landing.matrix.test.ts` (66 cases: entry x flag x person: 0 / 1 / 2 pages, helper/member, claimed-by-me;
  signed-out = the redirect runs before P3's AuthGuard). 5 of these were RED against main's code and are green here.
  Rewritten (not deleted): `p3LandingWelcome.table.test.ts` (P3-on column: 1 page / several / load error -> P3 Home; no-dancer-row and
  unfinished-dancer /account/o -> P3 Welcome) and `newOrganiserLanding.test.ts` (existing organiser on -> P3 Home).
  Also `loginDeadEnds.table.test.tsx` (invite Done id=null on -> /account/p3; label per flag).

## NOT done / left
1. **BLOCKER: the bundle budget is RED.** dancer-app is 375.7 KB against a 374 budget (main 371.8). All routes are about +1.8 KB.
   The chunk ratchet is over on home (+1), auth (+1) and dancer-app (+2). Likely cause: `@/lib/featureFlags` is newly imported by eager
   modules (useProfileSides, optionsModel, areaStatus, DancerHome, NoProfileWayOut, claimSignInLanding). Suggested fix: have
   organiserAreaHome.ts read `import.meta.env.VITE_ENABLE_ORGANISER_P3/SELF_SERVE` itself, adding a test that pins it equal to `flags`.
   Or pass a boolean in from callers that already hold flags. Then switch the matrix test's `doMock('@/lib/featureFlags')` to `vi.stubEnv`.
   Re-run `npm run build && npm run check:bundle-budget` and diff against main (saved numbers above). Never edit perf-budgets.json.
2. `organiserHomeHandoff` (auth-otp-routing:172) still has its `organiserCount === 0` guard. This is on purpose: the R1 redirect now carries page holders,
   and keeping the guard lets a `?legacy=1` page holder stay in R1. Confirm with the reviewer.
3. Behaviour change for review: P3 has no dancer-first gate, so with the flag on an unfinished dancer at /account/o now reaches P3 Welcome
   instead of /finish-profile (this is in the rewritten table).
4. No component test mounts OrganiserRoutes to prove the redirect wiring. Only the pure `r1AreaRedirect` is tested. Add one, plus an e2e at
   390x844 (flags on) for /account/o/events/:id -> /account/p3/events/:id and `?legacy=1`.
5. Not run: lint chain, pre-ship, e2e, the other CI job steps, `/code-review`, browser walk, prod shape survey (read-only), PR creation.
6. Full unit run: everything is green except tests/* contract and env suites (eventViewCompat, occurrenceProgram, publicEventPageLineup,
   ogBrandedCardLayout, integrityCouldNotRun). They do not touch these files and look like env/live-DB failures, but they were NOT checked against main.
   Typecheck: 101 pre-existing errors on the branch vs 103 on main. None are in the changed files.

---

# Round 2 (worker dt_2099a974b5a1, 2026-10-31) -- brief `brief/p3-landing-r2:docs/briefs/p3-landing-r2.md`

## Done
1. **Bundle budget GREEN, zero first-load bytes.** Root cause was NOT the featureFlags import. Two things:
   (a) passing the `flags` OBJECT as a function argument (`organiserAreaHome(flags)`, `r1AreaRedirect(flags, ...)`)
   makes it escape, which stops Rollup tracking `flags.*` constants, so every flag-gated branch on every route
   was kept (+1.8 KB everywhere: faq and landing pages too, which touch none of this code);
   (b) a helper module shared by eager callers became its own first-load chunk (+1 request; chunk ratchet).
   Also found: `import.meta.env?.VITE_X` (with `?.`) inlines Vite's WHOLE env object (~0.5 KB); only the exact
   `import.meta.env.VITE_X` form is replaced.
   Fix: `accountRouting.ORGANISER_AREA_HOME_PATH` is a build-time constant over the exact env form (folds to one
   string); first-load doors read it. `lib/organiserAreaHome` is lazy-only. PublicClaimCard / OrganiserRoutes
   pass the two booleans, never `flags`. Same-directory builds: every route equals main; dancer-app 371.8 KB
   both (-6 B gz by chunk walk), chunk counts equal main on every route. perf-budgets.json / vite.config.ts untouched.
   Tests: the door suite uses `vi.stubEnv`; a pin proves ORGANISER_AREA_HOME_PATH == organiserAreaHome(flags)
   for 7 env combinations.
2. `src/modules/organiser/shell/__tests__/p3Redirect.mount.test.tsx` mounts OrganiserRoutes (14 cases,
   mutation-checked). `tests/e2e/p3-landing-redirect.spec.ts` (390x844, 3 tests, passed locally with flags on),
   added by name to `test:e2e:p3`; check-p3-specs-not-skipped green.
3. Handover item 2 confirmed by a table in p3Landing.matrix (`?legacy=1` into R1 Home x page count). Item 3 is a
   DECISION for the lead in the PR body.

4. **Dancer-area isolation fix.** Round 1 changed two dancer-app files (optionsModel, NoProfileWayOut), which made
   this a dancer-area PR, and `check:dancer-area-isolation` (unit-tests job) then failed every other file. Both are
   reverted to main. Their organiser rows stay `/account/o`, and while P3 is live OrganiserRoutes redirects that to
   P3 Home: one more hop, through the lazy chunk. The matrix asserts this chain.

## CI steps run locally (head before the final docs commit = 5f6f3cb)
- architecture-guard (every npm/node step, check:images with AUDIT_STRICT=1), typecheck steps, perf-budget
  (build, bundle-budget, first-load-requests, chunk-cycles + self-tests), workflow-lint scripts,
  dancer-area-isolation (+ self-test): PASS.
- lint chain: 24/24 links green (eslint is informational). pre-ship: everything PASS except test:unit (below),
  so it skipped e2e. I ran e2e myself.
- test:unit: 5 failures in tests/integrityCouldNotRun.test.ts and 10 in 3 contract suites (eventViewCompat,
  occurrenceProgram, publicEventPageLineup). The SAME failures happen on main in this sandbox, so they are inherited
  (sandbox / live-DB env).
- test:e2e:p3: 87 passed, 2 failed in the full run (walk-p3-create-kinds 360x740, walk-p3-golive Review->Live).
  Both pass 24/24 in isolation on the branch AND on main, so they look load-flaky.
- test:e2e: 179 passed, 6 skipped, 3 failed in the full run (home-nights, organiser-onboarding signed-out @1280,
  organiser-profile). They pass 19/19 in isolation on the branch and on main, so they look load-flaky.
- Not runnable here: db-contract-check (needs secrets), ci-budget-guard (needs a token), phone-qa-section (needs the
  PR body in env), check:doc-weight (needs GITHUB_REPOSITORY), lighthouse, seo/og (need a live deploy).

## Left / next
- `/code-review` was not run (Ricky types it). No browser walk beyond the e2e at 390x844. The flag is NOT flipped.
- Lead decision in the PR body: an unfinished dancer at /account/o with the flag on now reaches P3 Welcome.

# Round 3 fix (worker dt_3c0015a296ab, 2026-10-31) -- brief `brief/fix-1237-r1:docs/briefs/fix-1237-r1.md`

Review: `origin/claude/review-1237-r1:docs/review/pr-1237-r1.md` (verdict BLOCK). One fix round.

## Done
- F2: merged origin/main; `test:e2e:p3` keeps BOTH `walk-p3-series-pictures.spec.ts` and `p3-landing-redirect.spec.ts`.
- F1: `ORGANISER_AREA_HOME_PATH` reads the two env keys inside try/catch (default `/account/o`), the
  `goingCheckin.ts` pattern; exact `import.meta.env.VITE_X` form kept, vite.config.ts untouched.
  Phone config `--list`: 534 tests in 21 files (same as main).
- F3: `/account/o/new/<seriesId>/<step>` (and `new/<seriesId>`) -> `/account/p3/events/<seriesId>`, as P3Routes NEW_STEPS.
- F4: `/account/o/go-live?series=<id>` -> `/account/p3/events/<id>` (`series` dropped, rest kept); `/start` only without a series.
- F5: `onboardingEndLabel` treats `/account/p3` like P3 start (no dancer-app file touched); switcher shape added to newOrganiserLanding.test.
- N2/N3 copy: the P3 You link now says the old area stays only through its own links in this tab.

## Two behaviours to know (review N2, N3)
A legacy tab (`?legacy=1`) stays in the old area only through the old area's own links: every door
(dancer home, Options, Your areas, sign-in landing, claim card, Done screen) still goes to P3.
With storage blocked (private mode, site data blocked) the choice cannot be remembered, so only the
exact `?legacy=1` URL renders the old area and its first in-area link redirects to P3 with no message
-- accepted for the 7-day window.

## Not done (nits, deliberately out of this round)
N1 (`stickyLegacy` writes during render), N4 (`more`/`more/help` -> P3 Home, not `you/account|help`), N5 (DancerHome alias name).
