# Handover: CI speed (profile first, then trim)

Brief: `docs/briefs/ci-speed-profile-and-trim.md` (branch `brief/ci-speed`). Branch `claude/ci-speed`, one PR.

## Done

1. **Profile** (numbers below).
2. **Phone QA shards rebalanced** by per-test time: `PWTEST_SHARD_WEIGHTS: '5:6:12'` on the
   suite step (`.github/workflows/phone-qa.yml`). Playwright 1.63 reads that env
   (`node_modules/playwright/lib/runner/index.js` `filterForShard`): shards are contiguous
   slices of the project-major test list, sized by weight x test count. Simulated on the
   local profile: 1:1:1 = 1262/784/442 test-seconds, 5:6:12 = 831/835/823 (117/139/278 tests,
   confirmed with `--list --shard=i/3`). Slowest shard -34%.
3. **Dominant unit file fixed**: `tests/routeRunner.test.ts` 84 s -> 28 s. Its mutant case
   waited out the full 60 s `spawnSync` timeout (the mutant leaves the run lock held, so
   every later shell case waits on it); it now stops at the first `FAIL MUTANT` line and
   kills the process group.
4. **Wall-clock budget**: `scripts/check-ci-wallclock.mjs` + `ci-wallclock-budgets.json`,
   canary + measure steps in `ci-budget-guard.yml` (no new workflow). p90 of the last 40
   completed pull_request runs per workflow; red over failSeconds, warning over
   warnSeconds, exit 2 under 10 runs. Budgets are ceilings, set loose on purpose.
5. **CI-only PRs** (`ci_light` output of `scripts/ci/docs-only.mjs`: workflows,
   `scripts/ci/`, `scripts/check-*.mjs`, `ci-*.json`, plus paths the suites cannot see):
   Phone QA shard 1 runs ONE spec (`organiser-save-bar.phone.spec.ts`, 390x844, ~2 min
   with warm-up), shards 2-3 skip, and `build-smoke` runs in full. Before: other-workflow
   PRs skipped both entirely; own-workflow and scripts/ci PRs ran everything.

## Not done, on purpose

- **Unit `timeout-minutes`**: the brief says raise 10 -> 15, but main already has **20**
  (since 2026-11-04, #1328). Lowering it to 15 would be the opposite of the decision, so it
  is unchanged.
- **Unit split**: contract tests total ~8 s on main's London leg (threshold ~200 s). No split.
- **E2E Smoke**: profiled (below) but not restructured. Its two steps run in series
  (legacy 461 s + P3 601 s on main run 44095226194). Running P3 as its own parallel job
  would cut ~8 min of wall-clock, but adds a new check name that the branch ruleset /
  `tests/automationFoundations.test.ts` required-check list would have to adopt:
  **owner decision**.
- No install caching (decision 6). No `cancel-in-progress` change.

## Profile

### Phone QA (local, 3 workers, CI=1: 534 tests, 2489 test-seconds; 128 skipped)

| spec | tests | test-seconds |
|---|---|---|
| keyboard.phone.spec.ts | 80 | 412 |
| invite-join.phone.spec.ts | 56 | 298 |
| front-door.phone.spec.ts | 74 | 255 |
| contrast.phone.spec.ts | 24 | 247 |
| invite-w2-golive.phone.spec.ts | 30 | 182 |
| people-nationality-flag.phone.spec.ts | 64 | 153 |
| organiser-name-city-create.phone.spec.ts | 18 | 118 |
| overlap.phone.spec.ts | 28 | 112 |
| teachers-city.phone.spec.ts | 14 | 110 |
| organiser-contact-sheet.phone.spec.ts | 24 | 101 |
| scroll-reset.phone.spec.ts | 14 | 94 |
| organiser-team-picker.phone.spec.ts | 24 | 83 |
| small-queue-gaps.phone.spec.ts | 18 | 79 |
| organiser-hero-owner.phone.spec.ts | 16 | 56 |
| site-nav-top.phone.spec.ts | 20 | 51 |
| organiser-refusal-copy.phone.spec.ts | 4 | 35 |
| invite-w2-walk.phone.spec.ts | 10 | 32 |
| organiser-save-bar.phone.spec.ts | 4 | 31 |
| account-crumbs.phone.spec.ts | 4 | 19 |
| route-transition-clip.phone.spec.ts | 4 | 16 |
| announce-banner.phone.spec.ts | 4 | 5 |

No single test dominates (max 34 s, a flaky-retried one); the imbalance was count-based
slicing, which the weights fix. Local run: 1 failure (`organiser-contact-sheet.phone.spec.ts:86`
360x640, keyboard-up case) and 2 flaky (`invite-w2-golive`), on unchanged product code.

### Unit (main push run 44095226450, London full leg: step 570 s, vitest 565.6 s;
transform 35 s, collect 241 s, environment 339 s, tests 801 s summed over workers)

| file | seconds |
|---|---|
| tests/routeRunner.test.ts | 84.2 |
| tests/integrityCouldNotRun.test.ts | 19.3 |
| src/modules/person-page/worlds/dancer/__tests__/dancerWorld.matrix.test.tsx | 18.5 |
| tests/ogWholeFlyerCard.test.ts | 15.9 |
| src/modules/admin-organisers/duplicates/__tests__/join-two-people.test.tsx | 11.1 |
| src/modules/dancer-app/__tests__/journeyConsistency.test.tsx | 10.9 |
| tests/regression/today/dancerPage.today.test.tsx | 10.4 |
| src/modules/organiser/p3/door/__tests__/door.listShape.test.tsx | 10.3 |
| src/modules/profile/__tests__/organiserPage.matrix.test.tsx | 9.9 |
| src/modules/dancer-app/public-page/__tests__/page.test.tsx | 9.4 |
| src/pages/__tests__/AuthSignInOrganiserClaim.test.tsx | 9.1 |
| src/modules/dancer-app/public-page/__tests__/route.test.ts | 8.3 |

Contract tests (all `*.contract.test.ts`): 8.2 s total.

### E2E Smoke (main push run 44095226194, 19.4 min)

| step | seconds |
|---|---|
| npm ci | 66 |
| Run E2E smoke suite (216 tests, 2 workers) | 461 |
| Run E2E P3 walk specs (139 tests, 2 workers) | 601 |

CI's reporter prints no per-test time, so no per-spec split for E2E here.

## How to re-profile Phone QA

```bash
CI=1 PLAYWRIGHT_JSON_OUTPUT_NAME=phone.json npx playwright test --config playwright.phone.config.ts --workers=3 --reporter=json
CI=1 npx playwright test --config playwright.phone.config.ts --list | grep '›' > order.txt
```

Then sum per-test durations (`results[].duration`) in `order.txt` order and pick weights
that minimise the largest slice (`floor(w_i * n / sum(w))` tests per shard, remainder
to the first shards).

## Next steps

- Watch the first Phone QA runs after merge; the weights came from a 4-vCPU sandbox.
- Owner: parallel P3 job for E2E Smoke (new required check name).
- Tighten `ci-wallclock-budgets.json` once a few weeks of post-merge numbers exist.
