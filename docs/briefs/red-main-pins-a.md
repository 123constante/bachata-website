# Brief: red main unit pins, part A (open problem P45)

Main 89b8a1c0 unit tests are red in all 4 shards; every PR inherits the red. Part A covers three tests whose pins drifted after merged PRs. Part B (another worker, branch claude/red-main-pins-b) covers automationRegister, cloudflarePurge and seoSoft404Matrix: do not touch those.

Rule for every item: first find the commit that changed the behaviour (`git log -S`). If that change was intended (a merged PR on purpose), update the pin/list and name the PR in the commit message. If the test caught a real bug, fix the code instead and say so in the PR body. Never delete or weaken a test.

1. `app/catchallGate.test.ts` "document cache headers ... skew true" (7 cases): expected cookie `__vdpl=dpl_test; HttpOnly`, received `__vdpl=dpl_test; Path=/; SameSite=Lax; Secure`. Find which PR changed the skew cookie (likely boot-watchdog #2455 or skew-first-visit). Update the expectation to the shipped cookie if intended.
2. `app/catchallGate.test.ts` "public/ holds exactly the pinned static files": new file `public/og-raffle-win.jpg`. Confirm it is served statically (link-preview image for raffle win), then pin it.
3. `tests/catchallClientPaths.test.ts`: CATCHALL_CLIENT_PATHS has 73 entries, AnimatedRoutes has 75 `<Route path>` literals. Add the 2 missing paths (or remove stale ones) so the list mirrors AnimatedRoutes exactly.
4. `tests/entryPointCoverage.test.ts`: `scripts/check-lazy-route-css.mjs` dispatches via isEntryPoint(import.meta.url) but is not in TARGETS of `scripts/prove-entry-point-dispatch.mjs`. Add it to TARGETS.

Done = those 4 test files green locally (`npx vitest run app/catchallGate.test.ts tests/catchallClientPaths.test.ts tests/entryPointCoverage.test.ts`), no other test newly red. One PR. Tests/pins only unless item rule says a real bug.
