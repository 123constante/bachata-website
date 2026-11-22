# Handover: flake walk-p3-w4b-onboarding:151 (dark) -- PARTIAL, no fix landed

Status: NOT fixed. No failing log for this test was found, so no root cause is claimed.

## Done
- Read brief (docs/briefs/flake-walk-w4b.md on brief/flake-walk-w4b).
- Line 151 = `dark > brand new: no match, create name step, city step (Which city?)`.
- Local repro (VITE_ENABLE_ORGANISER_SELF_SERVE/P3 = true, chromium, trace off):
  - 6 reps, 4 workers: 6/6 pass (~18s each).
  - 16 reps, 8 workers on 4 cores (about 2.4x slower, heavy load): 16/16 pass.
  So: not reproducible locally; failure rate 0/22.
- CI evidence: listed the last 30 completed e2e-smoke runs via the GitHub MCP. Failed on main:
  44569490076, 44564873070, 44560477329, 44560001454; also PR run 44542433386. Only 44569490076
  was read (p3 1/2 shard): its failures were p3-add-profile:51, dashboard-switch-r4-p3:55,
  p3-gate-sheet:61, walk-p3-golive:82 -- NOT w4b:151. The other four runs were not read.

## Left / next steps
1. Read the job logs of the other four failed runs (get_job_logs, tail ~250 lines, find the
   "walk-p3-w4b-onboarding.spec.ts:151" block) and quote the exact error.
2. Candidate causes read from the code (unproven): `check()` awaits only animations that exist
   at the moment of `getAnimations()`; the screen slide-in (`p3ObInR`, translateX(40px)) overflows
   width to 430 while running, which would fail `a.width <= 390` / no-horizontal-scroll. The
   `toBeVisible` on the new screen can resolve before the animation is registered under load.
   A deterministic fix would wait for the settled state (e.g. poll until `[data-dir]` screen has
   no running animations) instead of a one-shot snapshot. Only apply if the logged error matches.
3. Show before/after failure rates over reruns, then one PR (body per template; Phone QA section
   deleted for a tests-only PR).

## Verified / Not verified
- Verified: local repro counts above.
- Not verified: root cause; tsc not run; no PR opened; check:mojibake not run.
