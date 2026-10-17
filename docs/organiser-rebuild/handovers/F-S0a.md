# Handover F-S0a -- fix pass on slice S0a (shell)

Ticket `dt_b8627881bc9e`, brief `arc/briefs-organiser-r1:docs/organiser-rebuild/briefs/F-S0a.md`.
Branch `claude/org-r1-shell`, base of this pass `ecfe6b3`. Review: `claude/org-r1-review-S0a:docs/organiser-rebuild/reviews/REVIEW-S0a.md`.

## Done (the three SHOULDs, nothing else)

- **SHOULD-1** `shell/OrganiserShell.tsx`: the `org-content` scroller now carries
  `style={{ paddingBottom: actionBar ? undefined : 'env(safe-area-inset-bottom)' }}` (it had no style before;
  the action bar keeps its own). New case in `shell/__tests__/routes.test.tsx`
  ("pads the scroller for the bottom safe area only when no action bar does") asserts the inline style string
  for both cases, plus that the action bar still pads. It reads the style from `renderToStaticMarkup`, because
  jsdom's CSS parser silently drops `env()` (`getAttribute('style')` returned `''` even for the action bar).
  RED against the unfixed shell (`git stash` of `OrganiserShell.tsx` only):
  ```
  FAIL  src/modules/organiser/shell/__tests__/routes.test.tsx > OrganiserShell (no tabs, D32) > pads the scroller for the bottom safe area only when no action bar does
  AssertionError: expected '' to be 'padding-bottom:env(safe-area-inset-bo…' // Object.is equality
        Tests  1 failed | 36 passed (37)
  ```
- **SHOULD-2** `shell/__tests__/paths.test.ts`: `DAY = 'day 1'`, `addDate` expected
  `'/account/o/add/s%201/day%201'` (the series constant was already `'s 1'`). `routes.test.tsx` row
  `/account/o/add/s1/day-1` unchanged.
- **SHOULD-3a** `shell/paths.ts`: `ORG_PATHS.profile` and its `@deprecated` line deleted, comment now says
  "main's two keys"; its expectation removed from `paths.test.ts`. `/account/o/profile` legacy route and
  `moduleLegacyPath('profile')` untouched. `newEvent` and `date` kept.
  Caller check before deleting: `grep -rn "ORG_PATHS.profile" src tests` -> **empty output** (no caller).

## RED-first evidence for SHOULD-2

Test changed first, then the mutant in `shell/paths.ts` line 27:
`` addDate: (seriesId: string, date: string) => `${ORG_BASE}/add/${id(seriesId)}/${date}`, ``
`npx vitest run src/modules/organiser/shell/__tests__/paths.test.ts`:
```
 FAIL  src/modules/organiser/shell/__tests__/paths.test.ts > ORG_PATHS (v2) > is the pinned table
-   "addDate": "/account/o/add/s%201/day%201",
+   "addDate": "/account/o/add/s%201/day 1",
      Tests  1 failed | 2 passed (3)
```
Reverted with `git checkout -- src/modules/organiser/shell/paths.ts` (before the SHOULD-3a edit), rerun:
`Tests  3 passed (3)`. The mutant was never committed.

## Shell suite

`npx vitest run src/modules/organiser/shell` -> `Test Files 6 passed (6)`, `Tests 68 passed (68)`
(was 67: +1 safe-area case; the `profile` row was a key inside one `toEqual`, not its own test).

## Per-job CI table (sandbox, this branch head)

| Job | Command | Exit | Note |
|---|---|---|---|
| typecheck | `npm run check:rpc-typing` | 0 | |
| typecheck | `npm run check:wallclock-brand` | 0 | |
| unit-tests | `node scripts/check-dancer-area-isolation.mjs --self-test` | 0 | |
| unit-tests | `npm run check:dancer-area-isolation` | 0 | first run said COULD NOT MEASURE on a stale local `origin/main`; 0 after `git fetch origin main` |
| unit-tests | `npm run test:unit:offline` | 1 | 338 files, 8524 passed, 5 failed, 16 skipped. All 5 reds are `tests/integrityCouldNotRun.test.ts`, the same sandbox-environment reds the review recorded on `origin/main` |
| lint | `npm run lint` | 0 | after CI's `chmod +x bin/*.sh` |
| architecture-guard | `bin/check-integrity.sh`, `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture`, `AUDIT_STRICT=1 check:images`, `check:image-widths(:self-test)`, `check:plan-hygiene:self-test`, `check:workflow-artifact-policy(:self-test)`, `check:mojibake:self-test`, mojibake `git grep` (no hit), `prove:entry-point(:self-test)` | all 0 | |
| perf-budget | `check:bundle-budget:self-test`, `check:first-load-requests:self-test`, `check:chunk-cycles:self-test`, `npm run build`, `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | all 0 | production build OK |
| perf-budget | `check:lighthouse`, `check:doc-weight` | not run | need a Vercel preview deploy (`doc-weight`: `GITHUB_REPOSITORY is not set`) |
| e2e-smoke | `npx playwright test tests/e2e/organiser-layout.spec.ts tests/e2e/organiser-legacy-redirects.spec.ts` | 0 | 19 passed |
| e2e-smoke | `CI=1 npm run test:e2e` | 1 | 141 passed, 5 failed, 2 flaky, 1 skipped. The 5 reds are exactly review NOTE-1's S8-owned set: `organiser-home.spec.ts:11,31,57`, `organiser-events.spec.ts:257`, `organiser-loop.spec.ts:14`. Nothing new. Flaky (passed on retry, not organiser): `dancer-app/home-nights.spec.ts:63`, `dancer-home.spec.ts:105` |
| types-drift | `npm run gen:types` | not run | needs the Supabase token; this pass changes no types |

## Left / next steps

- Nothing left in F-S0a's scope. NOTES 1-6 and SHOULD-3b stay with the orchestrator, untouched.
- No fourth change needed.

## Verified

- All three SHOULDs fixed; each test fails against the unfixed code (output above) and passes after.
- Every runnable CI step above green or red the same way as the review's baseline; production build passes.

## Not verified

- No browser walk at 390x844 of the new padding: Chromium resolves `env(safe-area-inset-bottom)` to 0, so the
  only proof possible here is the inline style string. A real iPhone with a home indicator is the confirmation.
- `check:lighthouse`, `check:doc-weight`, `gen:types` (deploy / token needed). GitHub-hosted CI not observed.
