# PR #764 review fix (F1 + F2): handover

Brief: `briefs/public-journeys-review-fix.md` (sha 663b2b60) on `arc/briefs-dancer-rebuild`. Ticket dt_bc49daf45c35.
Review: `docs/review-packs/public-journeys/REVIEW.md` on `claude/review-764`.

## Done

- **Step 0.** Merged `origin/main` (#763) into the branch cleanly (e19863c).
- **F1 (required).** `resetDancerGate(qc)` in `src/modules/dancer-app/api/useMyDancerEdit.ts` is now the ONE place
  outside its hook that names `['profile-completion']`; `writeMyDancerEdit` calls it. `OnboardingScreen.tsx` leaves
  through `leaveFor()`, which calls it before navigating to any end other than `APP_HOME_PATH`. That covers the
  `start === 'done'` redirect (now an effect, not a `<Navigate>` during render) and both end buttons.
  Test: `tests/journeys/gateCacheReset.test.ts`. The cache says "incomplete", `my_dancer_edit` says done, the URL is
  `/app/welcome?returnTo=/account/o`, and the gate answer must be gone when the redirect lands. There is also a Home
  control row: a non-gated end leaves the cache alone.
- **F2, option (b)** (the orchestrator chose it for the owner; the owner can overrule). In `signInLanding`
  (`src/lib/accountRouting.ts`), a single finished dancer side with `organiserIntent`, no organisers and
  `openRequestCount === 0` goes to `/account/o`. While requests are loading it waits; a failed read keeps the plain
  landing. The dancer side's `to` is unchanged, so the switcher's dancer entry still opens the dancer app.
  `SidesFacts` gains an optional `openRequestCount`, which `useProfileSides` fills from the same requests query.
  - New journey row `organiser-link-closed-tab-after-required` (END `/account/o`). It is in
    `tests/journeys/publicEntryJourneys.ts`, the routing-model walk, the build walk
    (`tests/e2e-build/public-journeys.build.spec.ts`, new `closed-tab-after-required` midway) and the prose map.
  - Negative rows (`publicEntryJourneys.test.ts`, "organiser intent from the sign-up role"):
    - no intent goes to `/app/home`
    - intent with an open request goes to `/app/home`
    - intent with an organiser gets the "Continue as..." chooser (`signin-both`)
    - a failed request read goes to `/app/home`
    - the switcher's dancer side still points at `/app/home`
  - The old assertion "a finished dancer with organiser intent is not pushed anywhere" pinned the dropped behaviour,
    so it was replaced.
  - `docs/journeys/public-entry-journeys.md`, "Decisions made by the worker" item 2, now describes the new behaviour.
    That item lives in `docs/journeys/`, not `docs/review-packs/`.
- **Optional hardening.** In `Auth.tsx`, the signed-in redirect now skips `user.is_anonymous`.

## Red-first output (fix stashed; tests from this commit)

F1 (`npx vitest run tests/journeys/gateCacheReset.test.ts`, with the `src/modules/dancer-app` changes stashed):
```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  tests/journeys/gateCacheReset.test.ts > onboarding already done on arrival, with a stale gate > a gated end (/account/o): the gate answer is gone before the redirect lands
AssertionError: expected { status: 'incomplete' } to be undefined
      Tests  1 failed | 3 passed (4)
```
F2 (`npx vitest run tests/journeys/publicEntryJourneys.test.ts`, before the `accountRouting.ts` fix):
```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  tests/journeys/publicEntryJourneys.test.ts > public entry journeys: every row ends on its END screen (routing model) > organiser-link-closed-tab-after-required
AssertionError: expected { end: '/app/home', …(1) } to deeply equal { end: '/account/o', …(1) }
 FAIL  tests/journeys/publicEntryJourneys.test.ts > organiser intent from the sign-up role > one finished dancer side, intent, no organiser, no open request -> the claim screen
AssertionError: expected { kind: 'go', to: '/app/home' } to deeply equal { kind: 'go', to: '/account/o' }
 FAIL  tests/journeys/publicEntryJourneys.test.ts > organiser intent from the sign-up role > one finished dancer side, intent, closed dancer area -> still the claim screen
AssertionError: expected { kind: 'go', to: '/account/dancer' } to deeply equal { kind: 'go', to: '/account/o' }
 FAIL  tests/journeys/publicEntryJourneys.test.ts > organiser intent from the sign-up role > one finished dancer side, intent, open requests still loading -> wait
AssertionError: expected { kind: 'go', to: '/app/home' } to deeply equal { kind: 'wait' }
      Tests  4 failed | 54 passed (58)
```
After the fix, `npx vitest run tests/journeys src/lib/__tests__ src/components/account src/modules/dancer-app` passed:
37 files, 961 passed, 1 skipped.

## Per-job table (run locally; GitHub Actions not relied on)

| Workflow / job | Step | Exit | Note |
|---|---|---|---|
| typecheck | `check:rpc-typing`, `check:wallclock-brand` | 0 / 0 | |
| (extra) | `npm run typecheck` | 2 | 96 errors in 45 files. All are pre-existing and none is in a file this fix touches (the touched test files were re-checked too) |
| unit-tests London | live-db gate | 0 | decides RUN |
| unit-tests London | `test:unit` (live suites) | -- | needs DB secrets, not run |
| unit-tests London | `test:unit:offline` | 1 | 6 failures, all in `tests/integrityCouldNotRun.test.ts` (sandbox PATH layout). The same on `main` |
| unit-tests London | `test:unit:timing` | 0 | 65/65 |
| unit-tests New_York / Sydney | timezone vitest | 0 / 0 | 213/213 each |
| unit-tests | dancer-area-isolation self-test + check | 0 / 0 | |
| architecture-guard | integrity, legacy-tables, legacy-program-rpcs, lint:architecture, `AUDIT_STRICT=1 check:images`, image-widths, plan-hygiene, artifact policy, mojibake, entry points | all 0 | |
| perf-budget | self-tests, `npm run build` (production), bundle-budget, first-load-requests, chunk-cycles | all 0 | lighthouse / doc-weight need a preview + token, not run |
| phone-qa phone-qa | `playwright.phone.config.ts` | 0 | 174 passed, 64 skipped |
| phone-qa build-smoke | `npm run build` + `playwright.build.config.ts`, exactly as the workflow is written | **1** | **27 of 31 failed** (see below) |
| phone-qa build-smoke (diagnostic) | same, with `VITE_ENABLE_ORGANISER_SELF_SERVE=true` and the fake `VITE_SUPABASE_URL` | 0 | 31/31, including `organiser-link-closed-tab-after-required` (11.3 s) |
| e2e-smoke | `npm run test:e2e` | 0 | 146 passed, 2 flaky in `tests/e2e/dancer-home.spec.ts` (:105, :150) |
| workflow-lint | BOM, masking, notification | all 0 | |
| real-data-verified / phone-qa-section | `--self-test` | 0 / 0 | the real step reads the PR body, not run |
| db-contract-check | gate, migration-stamps, self-test canaries, script-conventions | all 0 | about 50 live checks need secrets, not run |
| (extra) `npm run lint` | chain | 1 | only `check:integrity` (exit 126: `bin/check-integrity.sh` is mode 100644). The same on `main` |

### Open blocker, not part of the F1/F2 fix (PR #764's own build specs; the brief says touch only the findings)
`phone-qa / build-smoke` goes red as the workflow is written. The build specs PR #764 added fail for two setup reasons:
1. The test step sets no `VITE_SUPABASE_URL`. `organiserFake.ts` stores the fake session under
   `sb-stsdtacfauprzrdebmzg-auth-token`, while the build reads `phoneqafakenotaproject`, so signed-in pages bounce
   to `/auth`.
2. The workflow's build does not set `VITE_ENABLE_ORGANISER_SELF_SERVE=true`. `HANDOVER.md` already flagged this.

With both set, the suite runs 31/31. The fix is a two-line `phone-qa.yml` change, or defaulting the key in
`playwright.build.config.ts`. **Needs an orchestrator decision.**

Also seen: one new eslint error at `src/components/account/profiles/__tests__/profiles.test.tsx:32`
(react-hooks/globals). The file was added earlier on #764, not by this fix. Informational eslint does not gate.
`pre-ship`'s ratchet may flag it.

## Verified / Not verified

**Verified**
- F1 is red on the unfixed code and green after the fix, in a jsdom render of the real `OnboardingScreen` in the shell.
- F2's new rows are red on the unfixed code and green after the fix.
- The production build passes.
- Every runnable PR job passes, except build-smoke (above).
- The build walk passes the new row with the env fixed.

**Not verified**
- A real phone.
- A real inbox (magic link).
- Real Supabase auth.
- Live-DB contract suites (secrets).
- Lighthouse and preview checks.
- GitHub Actions runs on this head.
- The PR body: `gh` was not used, so this file carries the table and the red output.
- A new prod shape count for F2. The earlier survey in `HANDOVER.md` stands: 4 `organiser`-type accounts, 2 of
  them unfinished. Option (b) changes where the finished ones with no organiser and no open request land.
- The new row's screenshot folder was not committed. The local run left screenshot churn in the working tree, which
  is not part of this commit.
