# Dancer Rebuild R0 handover (regression baseline + isolation check)

Branch `arc/dancer-app-r0` (from `origin/main` @ `4a63921`). No PR (the orchestrator merges). Status: **COMPLETE** (finished by the R0-finish worker; see "Not verified" for what a sandbox cannot do).

## What changed (files)
- `tests/regression/today/**` (new; 12 test files, 368 tests, snapshots in `__snapshots__/`):
  `helpers/a11yTree.ts` (accessible tree as text: role, name, disabled, href, checked/expanded; leaf text),
  `helpers/viewports.ts` (390x844 + desktop via innerWidth + matchMedia),
  `finishProfile.today` (15 missing-field subsets + no-profile/done/error/loading; Save disabled; Skip),
  `account.today` (/account, /account/dancer, /account/o x signed-out, no profile, incomplete, complete, organiser, open request),
  `accountSettings.today` (home x none/visible/hidden, pending email, hide confirm/after, show, no_profile error,
  ownership + delete x plain/sole-owner/admin, DELETE-typed immediate erase flow, blocked/media_failed/failed outcomes, /account/deleted),
  `auth.today` (/auth sign-in, sent, generic error, otp_disabled switch, sign-up steps 1-3, no-role error, allowlist 403, link sent;
  AuthStepper name/email/8-digit code/403; EmailCode + EmailCodeProof),
  `authCallback.today` (25-row routing table, expected landing written out per row),
  `reminderBanner.today` (22 paths x incomplete + other states; `/app/home` row documents TODAY = SHOWN),
  `eventRsvp.today` (RsvpBlock x 5 viewers + 3 closed reasons + not-gated-by-completeness; LevelRatingPrompt x 5 gates x compact),
  `festivalHub.today` (4 viewers, signed-out prompt, not-gated Going; Date + Math.random pinned),
  `dancerRoute.today` (app/routes/dancers.tsx loader+meta+headers over 9 shapes: head, noindex, og:image, 301, 404s, cache tag, hidden surname, no JSON-LD),
  `dancerPage.today` (DancerProfile page x 8 shapes x visitor/stranger/owner; Date pinned),
  `directoryAttendance.today` (/dancers + /account/attendance), `existingSuites.today` (the 14 named suites exist, are included, not skipped).
- `scripts/check-dancer-area-isolation.mjs` (new): exported `RULES` (seams, protected, forbidden imports) at the top, pointing at
  INTERFACE section 5; rules (a) protected byte-identical + changed files must be folder/test/seam, (b) folder imports no legacy screen
  (import SPECIFIERS), (c) nothing outside seams imports the module; `--self-test` (55 cases in a throwaway git repo, drives `main()` for exit codes);
  exit 0/1/2. Diffs against the merge-base with `origin/main` (override `DANCER_ISOLATION_BASE`), incl. uncommitted + untracked.
- `.github/workflows/unit-tests.yml` (HARD-tier, owner approves at PR head): **the file already existed**; I ADDED a job
  `dancer-area-isolation` (checkout fetch-depth 0, node 22, self-test step, check step). No `npm ci`: the script is plain node + git.
- `package.json` (seam): ONE line `check:dancer-area-isolation`. (Not added: a `:self-test` twin; the workflow calls `--self-test` directly.)
- `docs/handover/dancer-rebuild-r0.md` (this), `docs/handover/session-handover-2026-10-15-dancer-r0.md`.

## Decisions and INTERFACE/brief deviations
1. `unit-tests.yml` is not new (brief says new): added a job to it instead of creating it.
2. Brief names `onboarding/EmailCodeProof.tsx`; it lives at `src/modules/organiser/shared/components/EmailCodeProof.tsx`. Both screens covered.
3. Brief item 8 "JSON-LD": `/dancers/:id` emits NONE today; pinned as "0 JSON-LD tags" so adding one is visible.
4. Brief item 9 "inline level-vote prompt in MyAttendance": there is none today, only a "Rate the dancing level" LINK to `/event/:id#level-rating`; pinned.
5. The isolation check allows `docs/handover/**` and `tests/**` changes outside the seam list (INTERFACE section 5 does not list handover docs; every worker must leave one). Say if you want it stricter.
6. Isolation (c) exempts test files (`tests/**`, `__tests__/`, `*.test.*`): they exist to import the module.
7. `BANNER_HIDDEN_ON` is not exported, so the banner is tested through the exported `bannerModel`.
8. Snapshots contain the existing source mojibake (`FestivalHub`, `Dancers` emoji) as-is; they are pinned, not endorsed.
9. Local `origin/main` was STALE at session start (`bc43fb6`, before #746/#752/#750); fetched, reset to `4a63921`. Everything here is on the real tip.

## Baseline failures on main (`4a63921`, fresh checkout): attributed
Full `npx vitest run`: 15 failed tests in 4 files, 6963 passed.
- `tests/eventViewCompat.contract.test.ts`, `occurrenceProgram.contract.test.ts`, `publicEventPageLineup.contract.test.ts`: **environment**
  (live-DB contract suites; sandbox has no Supabase key: "Invalid API key").
- `tests/integrityCouldNotRun.test.ts` (5): **environment** ("typescript resolved in the temp repo -- precondition gone": a typescript is
  resolvable from /tmp in this sandbox).
No real failure on main. (The brief's "44 failures in 7 files" was not reproduced here.)

## Shapes surveyed
NO live prod survey was run by me. Shapes come from plan section 3 (survey of 2026-10-15, read-only counts) and the existing
`dancerBackend.ts` shapes. Not re-measured today.

## Red-first proof
Each mutant applied locally, suite run (`CI=1 npx vitest run ...`), then reverted with `git checkout`; `git status --short` clean after each.
- (a) `src/pages/FinishProfile.tsx`: "Skip for now" -> "Skip it now". RED: `tests/regression/today/finishProfile.today.test.tsx > /finish-profile at '390x844' > 'missing first_name'` (and every other missing-field subset, both viewports); also the existing `FinishProfile.test.tsx` (3 tests) and `DancerFirstGate.matrix.test.tsx`. Quote: `- button "Skip for now"` / `+ button "Skip it now"`.
- (b) `src/pages/Account.tsx:55`: `legacyAccountPath("home", ...)` -> `legacyAccountPath("team", ...)`. RED (4 tests): `account.today > /account entry at '390x844' > /account > 'organiser-type (complete)'`, `... 'open access request (complete)'`, and the same two at `'desktop'`. Quote: `Tests  4 failed | 32 passed (36)` (the landing path in the snapshot changes). FINDING on the first attempt: mutating the target to `"settings"` stayed GREEN, because `legacyAccountPath` falls through to `ORG_PATHS.home` for any unknown target, so that mutant is behaviourally identical (not a test gap).
- (c) `src/lib/profileCompletion.ts:171`: dropped `|| isAccountPath(pathname)` from `BANNER_HIDDEN_ON`. RED (9 tests): `reminderBanner.today.test.ts > reminder banner: incomplete profile, by path > /account -> shown=false`, `/account/`, `/account/dancer`, `/account/o`, `/account/o/events/e1`, `/account/settings`, `/account/settings/delete`, `/account/attendance`. Quote: `AssertionError: expected true to be false // Object.is equality`.
All three mutants make the suite red; no assertion needed adding. The isolation check was also proven able to fail earlier (real edit to `src/pages/Account.tsx` -> exit 1; `--self-test` 55 cases).

## CI per-job table (sandbox, Node 22.22.0)
| Job (workflow) | Command | Exit | Result |
|---|---|---|---|
| unit-tests | `npm run test:unit` | 1 | 7266 pass, 15 fail in 4 files = the known env reds (3 live-DB `*.contract.test.ts`: "Invalid API key"; `integrityCouldNotRun.test.ts`). All 368 regression tests pass. |
| unit-tests / dancer-area-isolation | `node scripts/check-dancer-area-isolation.mjs --self-test` ; `npm run check:dancer-area-isolation` | 0 ; 0 | pass |
| typecheck | `npm run typecheck` | 2 | 96 TS errors, ALL in files this branch does not touch (app/routes/*, venue/*, calendar*, etc., Supabase Json typing); none in `tests/regression` or `scripts/check-dancer-*`. Not compared against a fresh main run: treated as pre-existing/environment, unverified. |
| typecheck | `npm run check:rpc-typing`, `check:wallclock-brand` | 0 ; 0 | pass |
| lint chain | `npm run lint` | 0 | 16/16 links green (incl. check:integrity once `bin/*.sh` are chmod +x as the workflow does; first run exit 126 was the missing exec bit, mode change reverted) |
| architecture-guard | `bin/check-integrity.sh`, `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture`, `check:mojibake:self-test` | 0 | pass (via lint chain); `AUDIT_STRICT=1 npm run check:images` exit 0. Remaining inline `run:` blocks (plan-hygiene etc.) NOT individually run. |
| build | `npm run build` | 0 | built |
| perf-budget | `check:bundle-budget`(+self-test), `check:first-load-requests`(+self-test), `check:chunk-cycles`(+self-test) | 0 | pass |
| perf-budget | `npm run check:doc-weight` | 1 | needs `GITHUB_REPOSITORY` + a live preview deploy: not runnable here |
| perf-budget | `check:lighthouse` | - | NOT RUN (needs Chrome/preview) |
| ci-budget-guard | `check-ci-budget.mjs --self-test` / live | 0 / 1 | self-test pass; live run needs `CI_BUDGET_GITHUB_TOKEN`: needs owner |
| workflow-lint | `lint-workflow-masking.mjs`, `lint-workflow-notification.mjs` (+ self-test) | 0 | pass |
| Vercel | - | - | not attempted (no token; needs owner: Vercel token / network allowlist) |

Running the full unit suite non-CI rewrites snapshot files with LF endings (CRLF autocrlf churn only, no content change); reverted, tree clean.

## 390x844 walk
Not a browser walk: jsdom with innerWidth/matchMedia set to 390x844 and 1280x800. NOT RUN in a real browser; this is a regression suite, not a UI change.

## Verified / Not verified
Verified: 368 regression tests green; all three red-first mutants turn the suite red (quoted above) and were reverted; isolation check passes, self-test passes; lint chain 16/16; build; bundle/first-load/chunk-cycle budgets; workflow lints; check:images strict; full unit run = only the 4 known env-red files.
Not verified: typecheck (96 pre-existing-looking errors, not compared to a fresh main run); check:doc-weight, lighthouse, live ci-budget (need preview/token); remaining inline architecture-guard blocks; the new workflow job on real GitHub; live prod shapes (no survey run); a real browser/phone; snapshot suite on the finished B1a branch (must pass unchanged, except W1's own `/app/home` banner row).

## What is left
Nothing for R0 itself. For the orchestrator: confirm the snapshot suite passes unchanged on the merged B1a branch; owner to supply `CI_BUDGET_GITHUB_TOKEN` / preview for the budget checks if wanted.
