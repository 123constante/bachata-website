# Handover: flake-layout-190 (dt_39e72f209af4)

PR #1857, branch `claude/flake-layout-190`. Brief: `docs/briefs/flake-layout-190.md` on `brief/flake-layout-190`.

## Done
- Root cause of `organiser-layout.spec.ts:190` "no screen or sheet scrolls sideways": the e2e webServer (`react-router dev`) starts with an empty `optimizeDeps.entries`, because RR `future.unstable_optimizeDeps` is off. Vite therefore discovered deps lazily per route and force-reloaded the open page ("optimized dependencies changed. reloading"). The reloaded page mixed pre-bundled React copies (`useContext` on null in `Layout`, giving "Application Error"), so `expectNoHorizontalScroll` read Infinity until it timed out.
- Fix: `optimizeDeps.entries` = `app/**`, `src/**` (tests and `.d.ts` excluded) in `vite.config.ts`. Dev server only; the build is unaffected.
- Numbers (cold `node_modules/.vite`, `--retries=0`): before 0/5 with 4 reloads per run; after 5/5 with 0 reloads. organiser-layout + dashboard-switch-r4 + dancer-home together, cold: 30/30.

## Left / next
- Watch PR #1857 CI (e2e-smoke shards). The same root cause likely explains the `dashboard-switch-r4` "one profile" and `dancer-home:189` flakes seen in the same runs. Re-check them after merge before opening separate flake tickets.
- If a new bare-import dep is only reachable outside `app/` or `src/`, add its glob to `entries`.
