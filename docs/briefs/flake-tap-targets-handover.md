# Handover: flake-tap-targets

Done: `expectTapTargets` in tests/e2e/organiser-layout.spec.ts no longer sleeps a fixed 400ms before measuring.
It polls until no finite animation is running and the control measure is identical on 3 consecutive reads, each a frame apart.

Root cause (by reasoning; not reproduced): a fixed sleep is a race with the 0.3s entrance motion plus data-driven re-render. On a loaded CI runner a control measured mid-transition reads under 44px. No retries, skips or timeout bumps.

Evidence limit: the CI logs reachable here (latest failing e2e-smoke runs 44564873070, 44542433386) failed in other specs (p3-add-profile, walk-p3-golive; a legacy shard), not tap-targets, and log tails carried no spec error. Exact tap-targets error NOT quoted.

Numbers: before, unfixed, 12/12 pass on a quiet box (flake needs load). After: 12/12, then 29/30 under 4 workers x3 repeats; the 1 failure was the separate "no screen or sheet scrolls sideways" test (not touched, not analysed).

Left: that sideways test has the same style of risk (11 navigations, fixed 300ms inside expectNoHorizontalScroll); separate flake, separate PR.

tsc: tsc -p tsconfig.app.json run: 0 errors in organiser-layout.spec.ts.
