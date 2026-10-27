# A1 fix round 4 (PR #1086, branch claude/ambassador-a1-build)

Lane: normal. Model: Opus. Stopping rule: this is the 4th round; it is scoped to the failures below only, then stop. An independent Fable review follows.

## Why
Fix round 3 (hand paging, `@__PURE__` on the P3 lazy) made `bundle-budget` green but turned two REQUIRED checks red on head 0ba231e. `main` (d14a58c) is green on both.

## Failures to fix (read the CI logs: `gh run view --job <id> --log`)
1. unit (Europe/London, full): `src/modules/organiser/p3/__tests__/flagOff.test.ts` "the only P3 route is inside `flags.organiserP3 && flags.organiserSelfServe ? ... : null`": its regex expects `const OrganiserP3Area = lazyW...` in `src/components/AnimatedRoutes.tsx` and the `@__PURE__` marker broke the match. Keep the marker (it keeps the bundle at 0 bytes) and do NOT weaken the test beyond allowing the marker comment; show both are satisfied.
2. e2e-smoke `tests/e2e/ambassador-queue.spec.ts:185` "Back from a review returns to the list at the same scroll position; taps are at least 44px; no sideways scroll": scroll is not restored after fix 3's hand paging. Fix the page, not the test.
3. e2e-smoke also failed `account-settings.spec.ts:64`, `:75` and `organiser-onboarding.spec.ts:143` ("element(s) not found" / toBeVisible). main is green on them, so find the shared cause in this PR (route loading / AnimatedRoutes change is the first suspect) and fix it.

## Standing header lines
- Prove the cause from the logs and test-results screenshots before editing.
- Zero bytes to /app first load: run `npm run check:bundle-budget` before and after; never edit `perf-budgets.json` or `vite.config.ts`.
- Run the FULL `npm run test:unit` and `npm run test:e2e` (the explicit smoke list) before pushing; put the per-job table in the PR body, keep its `## Verified on real data` section with the labels `Shapes surveyed:`, `Checks run:`, `NOT verified:`.
- Overlay geometry rules from fix 2 stay as they are.
- Early checkpoint push after the first fix; one handover file `docs/briefs/ambassador-a1-fix4-handover.md`.
