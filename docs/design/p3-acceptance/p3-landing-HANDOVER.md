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
