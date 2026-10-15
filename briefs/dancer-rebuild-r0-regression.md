# Brief: Dancer Rebuild R0, regression baseline for TODAY's pages + isolation check -- PR B1a sub-branch

Repo `123constante/bachata-website` (PUBLIC: no secret or email in any commit). Model Sonnet 5.5.
NEVER run `gh api` in this repo (it waits on an approval prompt forever); read other branches with
`git fetch origin <branch>` + `git show FETCH_HEAD:<path>`. Read `briefs/dancer-rebuild-COMMON.md` and
`briefs/dancer-rebuild-INTERFACE.md` (section 5: routes, seams, protected files) on
`arc/briefs-dancer-rebuild` FIRST, then the plan sections 2.2, 6, 7.2 and Appendix A.
BRANCH: `arc/dancer-app-r0`, created FROM `main`. Push only this branch. Do NOT open a PR: the
orchestrator merges you into `claude/dancer-app-r1a` (PR B1a) with the W1 worker on `arc/dancer-app-w1`,
which owns `src/modules/dancer-app/**` and the seam files 1-4. You own NOTHING under `src/` except
tests; you never edit a seam or a protected file (that is the point: you prove they are unchanged).

## Goal
A characterisation suite that pins TODAY's behaviour of every page the rebuild touches or sits next to,
so that every later slice is proved not to change them; plus the CI isolation check that enforces the
seam list. Must pass unchanged on `main` now and on the finished B1a branch later.

## Files you OWN
- `tests/regression/today/**` (new): table-driven vitest DOM/route snapshots at 390x844 and desktop.
- `scripts/check-dancer-area-isolation.mjs` (new) + `.github/workflows/unit-tests.yml` (new; HARD-tier
  files: say so in your handover; the owner approves them at the PR head).
- `package.json`: ONLY a `check:dancer-area-isolation` script line and, if a `test:e2e` spec list exists,
  no change (W1 owns that line).
- `docs/handover/dancer-rebuild-r0.md`: YOUR handover.

## The suite (tests/regression/today/)
Use the repo's existing test utilities (look at `src/pages/__tests__/FinishProfile.test.tsx`,
`tests/client/rsvpBlock.test.tsx`, `src/components/__tests__/LevelRatingGate.test.tsx`,
`DancerFirstGate.matrix` for the auth/profile-gate mocking pattern; reuse them, never a new mock layer).
One table per page; each row = one shape; each test renders at 390x844 and desktop and snapshots the
accessible tree (roles + names + disabled + href), NOT raw HTML:
1. `/account`: signed-out (redirect target), no profile, incomplete, complete, organiser-type (goes to
   `/account/o`), open access request.
2. `/account/settings`, `/account/settings/ownership`, `/account/settings/delete`, `/account/deleted`:
   every view incl. the hide/show switch states and the immediate erase flow (mocked RPCs).
3. `/finish-profile`: every missing-field combination of first name / city / role / photo; Save disabled
   until filled; Skip rule; no-profile message.
4. `/auth`: sign-in, each sign-up step (role -> name/city/role -> email), each error copy (allowlist 403,
   `otp_disabled` switch), the 8-digit code entry; plus the two organiser email-code screens
   (`src/modules/organiser/home/onboarding/EmailCode.tsx`, `.../EmailCodeProof.tsx`).
5. `AuthCallback` routing decisions: the full matrix (self-claim yes/no, first sign-in hop, returnTo,
   pending return, dancer -> `/`, organiser-type -> `/account/o`) from the existing `AuthCallback*` tests
   extended to a table; the file itself is untouched.
6. Reminder banner (`profileCompletion.ts`): shown/hidden on every path in `BANNER_HIDDEN_ON` plus `/`,
   `/account`, `/finish-profile`, and (so W1's seam is proved) a row for `/app/home` that documents TODAY's
   value (shown) and will be flipped by W1 in ITS test, not yours.
7. Event page Going/Interested + level vote states (`RsvpBlock` + `LevelRatingPrompt`) for signed-out /
   incomplete / complete; festival hub Going (`FestivalHub.tsx`) for the same.
8. `/dancers/:id` (`DancerProfile.tsx` + `app/routes/dancers.tsx` loader): head tags, JSON-LD, og image,
   noindex rule, sections, hidden-surname names, for the plan's section-3 shapes (fixtures you write).
9. `/dancers` directory, `/account/attendance` (`MyAttendance` + the inline level-vote prompt),
   `/account/o` entry.
Also: a list test that asserts the existing suites below still exist and are included by the unit
runner: `DancerFirstGate.matrix`, `FinishProfile`, `FinishProfileToRating`, `SignInSelfClaim`,
`AuthCallback*`, `AuthOtpDisabled`, `MyAttendance`, `AuthSignupDanceRole`, `AccountSettings`,
`accountSettings`, `rsvpBlock`, `catchallClientPaths`, `navigateTargetsRoutable`, `siteIa`.

Red-first proof (mandatory): for THREE deliberate mutations, applied locally and reverted (never
committed), show the suite going red and quote the failure: (a) change one word of copy in
`FinishProfile.tsx`; (b) swap the organiser redirect target in `Account.tsx`; (c) remove `/account` from
`BANNER_HIDDEN_ON`. Record mutant -> failing test names in the handover.

## The isolation check (`scripts/check-dancer-area-isolation.mjs`, exit 1 on any violation)
(a) Protected-files diff: every path in INTERFACE section 5 "Protected" must be byte-identical to
`origin/main` (`git diff --quiet origin/main -- <path>`); and every CHANGED file outside
`src/modules/dancer-app/**` and `tests/**` must be on the seam list (1-4, 8). Print each violation with
the path. (b) Nothing under `src/modules/dancer-app/**` imports `DancerDashboard`, `EditProfile`,
`Onboarding`, `Profile`, `FinishProfile`, `DancerHome`, `DancerProfileGate`, `EventAttendanceButtons`
(grep on import specifiers, not on words). (c) Nothing outside the seam files imports from
`@/modules/dancer-app` or `src/modules/dancer-app`. (d) A `--self-test` mode that creates a temp
violation of each rule and asserts exit 1, then cleans up (the check must be able to fail). The seam and
protected lists live in ONE exported constant at the top of the script, with a comment pointing at
INTERFACE section 5. Wire it as a job in `.github/workflows/unit-tests.yml` next to the unit run (read
the existing workflows for the runner, Node version and `npm ci` conventions; mirror `typecheck.yml`).

## Gates (per-job table in the handover)
`npm run test:unit` (or the repo's unit runner; Node 22 as CI uses), the lint chain, `npm run typecheck`,
`node scripts/check-dancer-area-isolation.mjs` and `--self-test`, `npm run build`, every applicable job
in `.github/workflows/*.yml`. Known flaky under full-suite load (pass alone; say so, never skip):
`DancerFirstGate.matrix` "returnTo round-trips", organiser shell "/account/o renders".

## Failures this brief exists to prevent
A snapshot that pins raw HTML (brittle) instead of the accessible tree; a suite that cannot go red
(prove the three mutants); an isolation check whose lists drift from INTERFACE; `gh api` in a command.

## Done means
Suite green on `main`; three mutants red and quoted; isolation check + self-test green; workflow file;
handover with the list of every existing test relied on, CI table, Verified / Not verified. Commit, push
ONCE with `[worker-done <ticket>]`, report head SHA. Stop after the push.
