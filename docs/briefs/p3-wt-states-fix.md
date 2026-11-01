# Brief: p3-wt-states FIX ROUND 1 (PR #1251)

Repo bachata-website, branch claude/p3-wt-states (SAME branch, PR #1251 exists), lane normal, Opus. One fix round only. Read the independent review first: `docs/review/pr-1251-r1.md` on branch `claude/review-1251-r1` (verdict BLOCK). The original brief and its "do NOT touch" lists still bind. Do NOT add scope. Keep worker context under 35%.

## Fix exactly this
1. F-24: the unsaved-changes guard loops forever on re-render (unstable `useCallback`). Make the callback stable (the review gives a variant that passes all 4 cases). Add the test that was red first.
2. F-06: the test passes even when the code is broken. Make it non-vacuous: prove it fails against the unfixed code, then passes.
3. F-22: an archived event page says "This has finished". OWNER DECISION (2026-11-01): an archived event that nobody removed reads "Finished" (not "Removed"). "Removed" only where someone actually removed it. Fix the body copy to match and make the one shared status mapping carry it; table-driven test over every status shape.
4. F-19 / F-17 nits from the review.
5. Missing items: the overlay e2e at 390x844 (sheet, buttons inside the viewport, no page scroll on open), the bundle-budget run on main AND the branch (0 bytes added to first load), and the shape survey (read-only counts on prod, project stsdtacfauprzrdebmzg).
6. Run every CI job step that applies; put a per-job table in the PR body. Fix the PR body so it has `- Shapes surveyed:`, `- Checks run:`, `- NOT verified:` and a `## Phone QA` section with the three lines `- Sizes checked:`, `- Walked:`, `- Not verified:`.
7. Early checkpoint push (subject ends [skip preview]); final push with the done marker. Update the handover `docs/handover/p3-wt-states.md`. Hard limits in the dispatch prompt apply.
