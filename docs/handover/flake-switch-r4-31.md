# Handover: flake-switch-r4-31 (PR #1856)

**Done.** Root cause of `dashboard-switch-r4.spec.ts:31`: the Vite dev server (e2e web server) had no up-front dependency scan in RR7 framework mode (`optimizeDeps.entries` = []). Each lazily found dependency set triggered "optimized dependencies changed. reloading", which **full-reloads every open page**. The sheet opening (@radix-ui/react-dialog, cmdk, ...) reloaded the page under `expectNoHorizontalScroll`. Fix (4ba3f19): `optimizeDeps.entries` over `app/**` + `src/**` (minus tests), in `vite.config.ts`. Dev server only; `vite build` is unchanged.

**Numbers.** Before: 3/3 cold runs of :31 failed, 3 reloads each. After: 18/18 (dashboard-switch-r4 + dancer-home) and the full `test:e2e` (212 passed, 8 skipped) on a cold server, 0 reloads.

**Left / next.** `dancer-home.spec.ts:189` and `organiser-onboarding.spec.ts:143` have the same "navigation" signature in the same runs and are likely fixed by this too. Re-check them after merge before you dispatch tickets for them. The Vercel preview URL was not fetched (api.vercel.com is blocked from the sandbox). `test:e2e:p3` was not run locally.

tsc run on 4ba3f19: 0 errors in branch files (`tsc -p tsconfig.node.json` covers vite.config.ts; the app config errors are all pre-existing and outside the branch files).
