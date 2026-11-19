# Handover: flake dancer-home-189 (PR #1855)

**Done**
- Root cause: the e2e dev server (react-router dev = Vite) had no dep-scan entries. The reactRouter() plugin passes none while `future.unstable_optimizeDeps` is off. Vite therefore found deps lazily and ran a full page reload ("optimized dependencies changed. reloading") mid-test on each fresh CI shard. CI log: "2 x navigated to /account/o", then profile-switcher-button not found.
- Fix: `optimizeDeps.entries` in vite.config.ts (dev only; build unaffected).
- Numbers (fresh server, retries 0): legacy shard 2/2 went from 7 reloads and 4 failed to 0 reloads and 109/109 passed. Shard 1/2 after: 0 reloads, 102 passed. dancer-home:189 passed 5/5 on repeat.

**Left / next steps**
- `tests/e2e/dancer-app/photo.spec.ts:135` is a separate flake (about 1 in 5, zero reloads). It asserts `order` straight after `toHaveURL` without polling. It needs its own brief; the fix is likely `expect.poll(() => order...)`.
- The p3 e2e shards were not run locally; CI covers them.
- tsc run on e64f57f: 0 errors in branch files (vite.config.ts).
