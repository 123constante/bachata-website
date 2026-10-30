# Brief: G2 page-size pin tightening (Option D)

Lane: normal. Model: Sonnet. Website repo only. Branch: claude/g2-pin-tightening. One PR. Context cap 50%.
Stopping rule: one build, one review (Opus, by the lead), one fix round, stop.

## Source
Read the doc on branch `claude/scope-g2-budget` (PR #1190), `docs/scoping/g2-page-size-budget.md` (git fetch it). Build Option D exactly as the doc recommends: pin `contactLinks.tsx` into the `lib-event-rules` chunk in `vite.chunks.ts`, then lower the eight affected route pins in `perf-budgets.json` by the amounts the doc lists (the doc says by 2, below the pins set in #1179). This is the one job where editing `perf-budgets.json` and `vite.chunks.ts` is the task; touch nothing else.

## Checks
- Run `npm run build` then `npm run check:bundle-budget` on main and on the branch; the PR must add 0 bytes to the dancer-app (/app) first load. Record both outputs. If a pin the doc names is not exactly as it says on current main (other PRs merged since: #1180-#1182, #1181, #1191), re-measure and say what you used.
- Recorded wins only: lower a pin only to a number you measured on a clean build, with headroom as the doc says. Never raise a pin.
- Run the request-count and chunk-cycle checks the doc names, and the architecture lint.
- PR body: "Verified on real data" block (shapes: route pins before/after, counts only), Phone QA section (Not applicable: build config only), Not verified.

## Done
Push with plain git (no --no-verify). End the final message with [worker-done g2-pins] and list the files and the before/after pin table.
