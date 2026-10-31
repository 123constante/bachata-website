# Brief: P3-LAND -- everyone who already has an organiser page lands in the new area (/account/p3)

Repo 123constante/bachata-website, branch `claude/p3-land` from origin/main. Lane normal (routing logic, no DB). Context cap 35%:
push + `PARTIAL [worker-done <ticket>]` handover if you cannot finish. Stopping rule: one independent review, one fix round, then the
lead's 390x844 walk.

## Owner decisions already made (do not ask again)
- 2026-10-30: "P3-LAND: people with 1+ pages land in the new area." Retiring the old R1 screens (`/account/o`) is a LATER slice,
  not before 2026-10-31 17:00Z, so `/account/o` itself keeps rendering R1 for now. Every OTHER entry point goes to P3 while the
  `organiserP3` flag is on. With the flag OFF nothing changes (table-driven test proves it).
- One person = one account, one You area; Switch page only for organiser pages.

## The audit rows this slice closes (cite each in the PR body with its result)
From `docs/design/p3-acceptance/AUDIT-gate.md` (origin/claude/p3-audit-gate) and `AUDIT-team.md` (origin/claude/p3-audit-team):
1. G-01 (A-team-1, A-gate J-d1.1, J-e2.1): `signInLanding` / ContinueAs (`src/lib/accountRouting.ts:352,396,405`) sends an organiser
   with a page to `/account/o`. Target: P3 Home (`P3_PATHS.home`, carry `?o=` for the chosen page).
2. `organiserHomeHandoff` (`src/lib/auth-otp-routing.ts:172-173`) fires only at 0 pages. Target: fires at any page count while the flag is on.
3. Claim landing (`src/lib/claimSignInLanding.tsx:20` returns `ORG_PATHS.home`); the claim done link `PublicClaimCard.tsx:212`.
   Target: P3 Home for the claimed page; the ClaimNotice (today drawn only in R1) is shown in P3 Home once (reuse its model, no copy of it).
4. Dancer home: `src/components/account/DancerHome.tsx:298,310,320` (three "Open the organiser area" links) and :330-352
   ("I organise events" opens R1's inline `OrganiserOnboardingPanel`). Target: links go to P3 Home; "I organise events" goes to P3 `start`.
5. `modules/dancer-app/screens/options/optionsModel.ts:42`, `NoProfileWayOut.tsx:31`, `modules/areas/home/areaStatus.ts:28`
   (`organiser: '/account/o'`). Target: P3 Home.
6. G-04 / G-26 legacy paths: `modules/organiser/shell/legacyPaths.ts:23-28` maps `/account/new`, `/account/series/<id>`, `/account/team`
   to R1; `/account/o/series/<id>` has no route at all and falls to R1 Home (the event is lost). Target: `/account/new` -> P3 new event
   entry, `/account/series/<id>` and `/account/o/series/<id>` -> P3 event page for that series, `/account/team` -> P3 Team.
   Bare `/account?o=` / `?from=` / `?claim=` (`pages/Account.tsx:42,56-57`, `lib/accountRouting.ts:71-75`) -> P3 Home keeping the query.
7. G-09 (A-team-29): invite accept `admin-organisers/join/JoinScreens.tsx:166-168` lands on You/Welcome while its copy says
   "Open your organiser home"; falls back to R1 with no organiser id. Target: P3 Home; fallback P3 Home too.
8. Profile-lock link "Complete your profile" in `p3/.../DetailsScreen.tsx:80`, `PricesScreen.tsx:45`, `shared/profileProgress.ts:45`
   leaves P3 for R1 `/account/o/complete` as a full page load. Target: the P3 "A few details first" sheet / P3 onboarding, in-app navigation.
9. A-team-3 (J-e3): a refused access request shows a silent Welcome in P3 `start` (`OnboardingFlow.tsx:401` keeps only `open`).
   Target: the declined line R1 shows (`declinedRequests()`), reused, not copied.

## Rules
- First step: write `docs/design/p3-land/ENTRY-INVENTORY.md`: EVERY entry point into the organiser area on main (grep `/account/o`,
  `ORG_PATHS`, `ORGANISER_HOME_PATH`, `organiserHomeHandoff`, `claimLandingPath`, `acceptedInviteLanding`, `legacyPaths`), file:line,
  today's target, new target, flag-off target. Rows above are the minimum; add every one you find. End with a coverage count.
- One shared mapping function (e.g. `organiserLanding({flagOn, pageCount, chosenPage, intent})`) that every entry point calls. No
  second copy of the rule anywhere. Table-driven vitest: every entry x flag on/off x page count 0/1/2 x with/without `?o=`.
- Do NOT edit `P3Routes.tsx` beyond adding redirect routes; do not touch the create-event files (another PR owns them).
- Standing lines: prove the data source (which RPC says "has a page", read-only); zero bytes to the dancer-app first load
  (`npm run check:bundle-budget` main vs branch; never edit perf-budgets.json / vite.config.ts); overlay geometry n/a.
- Run every CI job step locally (read `.github/workflows`), fill the PR body template incl. Verified / Not verified, and the per-job table.
- Walk at 390x844 with the test accounts in `docs/design/p3-acceptance/ACCOUNTS.md` (origin/claude/p3-acceptance-contract-3): one
  screenshot per entry point landing; list them in the PR body.
- Commit subjects: `feat(p3-land): ...`, last one ends `[worker-done <ticket>]`.
