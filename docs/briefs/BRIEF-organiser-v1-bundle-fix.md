# Brief: fix bundle-budget red on PR #1731 (organiser V1 shell)

Branch: `claude/organiser-v1-shell` (PR #1731 already open; push fixes here, no new PR).

## Failure
Perf Budget job `bundle-budget` at head b3b5dd9d8:
`[OVER BUDGET] event (/event/:id): 383.6 KB first-load JS across 40 files (budget 381 KB)`.
Main at fffedcca4 (green): `[ok] event (/event/:id): 380.4 KB ... across 39 files (budget 381 KB)`.
The PR adds ONE extra file (+3.2 KB gz) to the `/event/:id` first-load graph. The PR touches no event-page code, so the extra file arrives through a shared module or a chunk reshuffle.

## Likely suspects
- `src/lib/featureFlags.ts` (+4 lines, new flag `organiserShellV2`): is the shape of `flags` or its import changing which chunk it lands in?
- `src/modules/organiser/p3/shell/P3Routes.tsx` and `src/modules/organiser/p3/v2/*` (static imports of V2Shell and V2Tabs): did a module shared with the event route move into a new chunk?

## Do
1. Build the PR head and main, list the `/event/:id` first-load file sets (see `scripts/check-bundle-budget.mjs` and the way to re-measure in `vite.config.ts`). Diff them. Name the extra file and who pulls it.
2. Fix the cause in the PR (lazy-load the V2 module, or keep the shared module out of the event graph). Do NOT raise the budget in `perf-budgets.json` and do NOT move packages between the `vendor-ui*` groups without measuring.
3. Keep the V2 look as is: accent is coral (light #C93D20, dark #FF7A59). Do not touch `v2.css` colours.
4. Run the CI steps that apply; push; leave the PR body's "Verified on real data" and "Phone QA" sections filled in (the bot PR body still says TO FILL: fix that too, honest "Not verified").

Done = `bundle-budget` green at the head, other checks unchanged, a handover line in the PR body.
