# Continuation: PR #1132 (W4b2 slices 2+3), branch `claude/p3-w4b2-page`

Lane: normal, Sonnet. Do NOT rewrite features. The code and tests are done (see `docs/handovers/p3-w4b2-page.md`, "Left / next").
1. Fetch the branch, merge `origin/main` if behind (keep both sides; report conflicts).
2. Run EVERY CI job step for the PR (read `.github/workflows`; incl. `check:images` with `AUDIT_STRICT=1`, `npm run lint` chain, `typecheck` vs main's error count, `test:unit:offline`, `check:bundle-budget` on main AND branch with both flags off and on, `test:e2e` incl. `walk-p3-w4b2-page.spec.ts`). Never edit `perf-budgets.json` or `vite.config.ts`. A red you cause: fix it minimally and say so. A red also on main: say so, do not chase.
3. Rewrite the PR #1132 body (plain git cannot edit it: put the full body text in `docs/handovers/p3-w4b2-page-prbody.md` and say so; the orchestrator pastes it) with: What/Why, design-record link `docs/design/onboarding-prototype.md`, the per-job CI table, a "## Verified on real data" block (use the shape survey in the handover), and an honest Not verified list.
4. Push once, final commit subject ends `[worker-done <ticket>]` (no [skip preview]).
Context cap 50%. Never merge or approve; Supabase read-only.
