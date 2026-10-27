# A1 fix round 3: PR #1086 must add NOTHING to the /app first load (branch claude/ambassador-a1-build)

Continue on the SAME branch (update it onto current main first: `git fetch origin main` and merge it). Lane normal, Opus.

Problem: after main went green again (Perf Budget fix #1092, then #1094 merged, main now d14a58c), the PR's `bundle-budget` check fails: `[OVER BUDGET] dancer-app (/app/*, lazy chunk via catchall): 374.3 KB first-load JS across 49 files (budget 374 KB)`. Main has only about a 22 byte margin, so this PR must add 0 bytes to the dancer-app first load. Other budgets ([ok] lines) pass.

Do:
1. Run `npm run check:bundle-budget` locally (build first as the script needs) on main and on the branch; diff the dancer-app first-load file list and the byte counts. Identify EXACTLY which change in this PR lands in /app's first load (suspects: `src/lib/breadcrumbs/siteIa.ts` ids, `src/components/catchallClientPaths.ts`, `src/components/AnimatedRoutes.tsx` `routesKey`, anything imported by `ambassadorApi.ts` or `ambassadorModel.ts` that is not in the lazy ambassador chunk). Put the evidence (before/after bytes per file) in the PR body and in `docs/design/ambassador-a1-build.md` under "Fix round 3".
2. Move or shrink the cost so the PR adds 0 bytes to dancer-app (for example put the ambassador breadcrumb ids into the lazy ambassador module and register them on load, or shorten the strings, or reuse existing helpers). Do NOT edit `perf-budgets.json`, `vite.config.ts` or any budget/ratchet; do NOT touch the baseline. Behaviour must not change.
3. Run ambassador unit tests, `tests/e2e/ambassador-queue.spec.ts`, the breadcrumb tests, lint, tsc, and `npm run check:bundle-budget` green. One push; the final commit subject ends `[worker-done <ticket>]`.
