# Dancer Rebuild R0 handover (regression baseline + isolation check)

Branch `arc/dancer-app-r0` (from `origin/main` @ `4a63921`). No PR (the orchestrator merges). Status: **PARTIAL**,
stopped at the context gate. Suite and isolation check are built and green; the red-first mutants and most
CI gates are NOT run. See "What is left".

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
**NOT DONE** (context gate). Run these three, each applied locally and reverted (never commit), and quote the failing test names:
- (a) one word of copy in `src/pages/FinishProfile.tsx` -> expect `finishProfile.today` snapshots (and the existing `FinishProfile.test`) red.
- (b) change the organiser redirect in `src/pages/Account.tsx` (`legacyAccountPath("home", ...)` target) -> expect `account.today` organiser/open-request rows red.
- (c) drop `isAccountPath(pathname)` from `BANNER_HIDDEN_ON` in `src/lib/profileCompletion.ts` -> expect `reminderBanner.today` `/account*` rows red.
The isolation check WAS proven able to fail: a real edit to `src/pages/Account.tsx` made it exit 1 naming the file, and `--self-test` breaks every rule on purpose (55 cases).

## CI per-job table (what I ran in the sandbox)
| Job / command | Result |
|---|---|
| `npx vitest run tests/regression` (x4 incl. after a flake fix) | 368/368 pass, stable |
| `node scripts/check-dancer-area-isolation.mjs` | exit 0 |
| `node scripts/check-dancer-area-isolation.mjs --self-test` | exit 0 (55 cases) |
| `node scripts/check-dancer-area-isolation.mjs --bogus` | exit 2 |
| `node scripts/check-script-conventions.mjs` | exit 0 |
| `npm run check:dancer-area-isolation` | exit 0 |
| full `npx vitest run` on main BEFORE my files | 4 env-failing files, see above |
| full `npm run test:unit` WITH my files | NOT RUN |
| `npm run typecheck`, `npm run lint` (chain), `npm run build` | NOT RUN |
| other `.github/workflows/*.yml` jobs (integrity/check:images, architecture-guard, perf-budget, ...) | NOT RUN |

## 390x844 walk
Not a browser walk: jsdom with innerWidth/matchMedia set to 390x844 and 1280x800. NOT RUN in a real browser; this is a regression suite, not a UI change.

## Verified / Not verified
Verified: the 368 regression tests pass repeatedly on `4a63921` with no source file changed; the isolation check passes on this branch,
fails on a protected edit, and its self-test passes; `check-script-conventions` accepts the new script.
Not verified: red-first mutants; typecheck, lint chain, build, full unit run with the new files, every other workflow job; live prod shapes;
the new workflow job on real GitHub (needs `origin/main` fetched via fetch-depth 0); a real phone/browser.

## What is left
1. Run the 3 mutants and add the quotes above.
2. `npm run test:unit`, `npm run lint`, `npm run typecheck`, `npm run build`; read `.github/workflows/*.yml` and run the applicable steps.
3. Confirm the snapshot suite also passes on the finished B1a branch (it must pass UNCHANGED; the only intended flip is W1's own `/app/home` banner row).
