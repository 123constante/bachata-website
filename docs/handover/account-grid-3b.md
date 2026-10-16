# Handover: account-grid slice 3b (landing, invite card, re-entry, `/app/welcome`, `accountGate.ts`)

Branch `claude/account-grid-3b`, from `origin/claude/account-grid` head **c30e9d3**. No PR opened; `claude/account-grid` not pushed.

## Finding first
Most of 3b's screens were **already built** on the base: the invite card ("You are joining as <name>" + "Not you? Sign out",
bearer link), the "Continue as" list, `/app/welcome` resuming at the first missing card (`stageFor`), the end card for a 70% dancer,
`replace` navigation on every onboarding end, and `signInLanding`'s empty -> `/app/welcome` and organiser-intent -> claim screen.
So this slice adds the missing piece (the gate) and wires the deleted-first rule into the landing; it does not rebuild those screens.

## Done
- NEW `src/lib/accountGate.ts` (pinned shape, unchanged). Exact exports:
  `AccountGateStatus`, `AccountGate`, `SettledAccountGate`, `GateFacts`, `composeAccountGate`, `accountGateQueryKey`,
  `useAccountGate`, `fetchAccountGate`.
  `composeAccountGate` is the ONE mapping: signed out -> `signed-out`; `deletion` non-null -> `deleted` (wins over everything,
  loading included); any read loading -> `loading`; complete -> `complete`; incomplete / no profile / FAILED check -> `incomplete`
  (fails closed, like `dancerGate`); a failed deletion read is `null` (never strands a sign-in). Hook and fetcher both call it.
  Composes `useProfileCompletion`/`fetchProfileCompletion` and `fetchDeletionStatus`/`deletionLanding`; no new RPC. The hook shares
  `/account/restore`'s query key (`DELETION_STATUS_KEY`), which invalidates every query once restored.
- `signInLanding` (src/lib/accountRouting.ts): new optional fact `SidesFacts.deletion` (`DeletionLanding | 'loading'`). `'loading'` waits;
  non-null goes to `restorePathFor(returnTo)` BEFORE any side or returnTo. Everything else is unchanged (explicit returnTo still wins).
- `useProfileSides` passes `deletion` from `useAccountGate()`, so `/account/continue` honours it.
- Grid: `ol.org2.signed-in`, `si.org-only` now covered (U: accountGate.test.tsx) and removed from the baseline; `ol.admin-only.signed-in`
  has the U ref and stays baselined (reason updated: needs an admin fake person for a build walk). `JOURNEY-GRID.md` regenerated.
- Snapshot: `tests/regression/today/__snapshots__/auth.today.test.tsx.snap` updated (4 snapshots). Each diff was additions only: an empty
  `alert` live region on all four, plus on the two sign-up ones the "By continuing you agree to the Terms and Privacy Policy" text and its
  two links. That is exactly 3c's link-sent change (clickwrap + live region). No other snapshot changed.
- Test pin updated: `src/lib/__tests__/accountReviewRound1.test.ts` S2 said accountRouting must not mention `accountDeletion`; it now forbids a
  VALUE import (a type-only `DeletionLanding` import is allowed). Intent kept: accountRouting stays import-light.

## Lines I changed in files owned by earlier slices (list required by the brief)
- `src/lib/accountDeletion.ts`: `ACCOUNT_RESTORE_PATH` and `restorePathFor` MOVED to `src/lib/accountRouting.ts` (so `signInLanding` can name them
  without importing the RPC module) and are re-exported from `accountDeletion` (same names, same behaviour; import line changed, two definitions
  replaced by one `export { ... }`). Existing callers are untouched.
- No change to AuthCallback, Auth, AccountRestore, AccountSettings, termsConsent, trackAuthStep or anything in `src/modules/organiser/**`.

## Tests (red-first)
New `src/lib/__tests__/accountGate.test.tsx`: 33 tests = 11 rows x {hook == fetch, landing no returnTo, landing with returnTo}
(signed-out, deleted<30d, deleted>30d, empty, dancer incomplete, dancer complete, organiser 1, organiser 1 + dancer, organisers 2+,
organiser-intent, admin) + 2 gate edge tests.
- Base c30e9d3 (test copied into a clean worktree): `Failed to resolve import "@/lib/accountGate"` -> 1 file failed, no tests ran.
- Now: 33 passed.

## Commands (head of this branch before the final commit)
| Command | Exit | Note |
|---|---|---|
| `npm run build` | 0 | |
| `npm run check:bundle-budget` | 0 | all budgets respected |
| `npm run check:first-load-requests` | 0 | 6 routes match their pin |
| `npm run typecheck` | 2 | 96 errors, same count as the merge head; none in files I touched |
| `npx eslint` (5 changed/new files) | 0 | run directly; the lint chain skips eslint |
| `bash bin/check-integrity.sh` | 0 | 1705 files, 0 issues (the script is not executable here: `npm run lint` shows exit 126 for that one link only) |
| `npm run lint` | 1 | 17 of 18 links PASS incl. `check:journey-grid`; only `check:integrity` (126, see above) |
| `node scripts/check-journey-grid.mjs` | 0 | 87 rows, baseline 17 |
| `vitest run --pool=forks` (whole repo) | 1 | see below |
| playwright `playwright.build.config.ts` public-journeys.build.spec.ts | 0 | 33 passed (7.1 min) |

Full vitest: 68 failed / 8464 passed while Playwright ran in parallel. 59 are the base's known set (organiser DatePage + levelsByType,
eventViewCompat, integrityCouldNotRun, occurrenceProgram, publicEventPageLineup). The other 9 were: 8 timing flakes under CPU contention
(HomeFixes 1, ProfileFixes 6, festivalHub 1 pass when re-run alone) and 1 real one (`accountReviewRound1` S2, fixed above, 7/7 now).
The 4 auth.today failures are fixed by the snapshot update (40/40 pass).

## Screenshots (390x844, from the production-build walk, fake Supabase), `docs/handover/shots-3b/`
01 welcome setup resuming at the role card; 02 resume after a closed tab (photo card); 03 end card, finished dancer on `/app/welcome`;
04 "Continue as" list; 05 invite card signed in ("You are joining as ..."); 06 invite card signed out.

## Left / next steps
1. `ol.admin-only.signed-in` and the five `cl.*` claim-screen rows still have no build walk (baseline reasons stand; the claim screens are
   under `src/modules/organiser/**`, which this slice must not touch). Needs an admin fake person in `tests/e2e-build/helpers`.
2. Owner decision to confirm: a finished (100%) dancer opening `/app/welcome` goes straight on (M71 test pins it); only 70-99% sees the end
   card. I did NOT change it (brief D4 reads "sees the end card"; the existing tests and journey `bookmark-app-welcome-finished` say otherwise for 100%).
3. Empty account WITH a returnTo: `signInLanding` still returns the returnTo (existing test "explicit returnTo: always there"); the dancer
   gate on gated targets sends them through `/finish-profile` -> `/app/welcome?returnTo=`. `AuthCallback` never calls `signInLanding` with a returnTo.
4. The organiser session can import `useAccountGate` / `fetchAccountGate` now; nothing renders from them yet except the Continue-as landing.
5. `bin/check-integrity.sh` is not executable in this checkout (environment matter).

## Verified / Not verified
Verified: the matrix tests (red on base, green now), build, budgets, first-load, eslint on changed files, integrity, journey grid, 33 production-build
walks, auth.today snapshot diffs read line by line.
Not verified: typecheck count vs base on equal footing; Vercel preview; GitHub Actions (not run); no walk of a deleted account through the real
restore flow in a browser (unit-tested and AuthCallback unchanged); the hook/fetch parity is tested against mocked RPCs, not prod. No Supabase
queries were made.
