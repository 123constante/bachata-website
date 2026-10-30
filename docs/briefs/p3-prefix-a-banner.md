# p3-prefix-a-banner: stop the "Finish your details" nag appearing for everyone

Lane: normal (no database change). Model: Opus (it touches how a rule is decided). One PR, branch claude/p3-prefix-a-banner from main.

## Owner words
"All four must be fixed before the organiser rebuild goes on." The real-data audit (docs/review/p3-real-data-shapes.md gap 1, and flags-on walk D3, branch claude/review-p3-real-data-shapes and claude/walk-p3-flags-on-audit) found:
- All 7 claimed owners would see the grace banner on every visit, because `organiser_onboarding_progress` has 0 rows and the status read treats that as unfinished (src/modules/organiser/p3/screens/GraceBanner.tsx:85-95, p3/onboarding/pageModel.ts:100).
- The banner can say "0 things left" with a Continue that goes nowhere (`graceShown` checks only `!complete`, the count comes from `missing`).
- The count of "things left" comes from two sources (You screen and the banner): one shared mapping please.

## Do
1. Prove the data source first: read `organiser_onboarding_status_v1` and the progress table read-only on prod (project stsdtacfauprzrdebmzg) and state what it returns for an owner who has a finished page but no progress row. Counts only, no personal data, never a write.
2. Decide from that: an owner whose page already has what onboarding asks for must not see the banner. If the server answer is wrong for them, say so in the PR and handle it client-side ONLY if it is safe; do not edit migrations (that is a separate careful-lane brief).
3. Hide the banner when `left === 0` (or show "Checking..." while unknown). One shared function for "things left" used by the banner and the You screen.
4. Table-driven test: every owner shape x banner/You count (no row, partial row, complete, malformed answer). Red first on current main; show the red.

## Standing rules
Zero bytes to /app first load (run `npm run check:bundle-budget` and `npm run check:first-load-requests` on main and branch; never edit perf-budgets.json or vite.config.ts). Compact copy, explicit px tap targets (html font-size is about 13.5px on phones). One independent review, one fix round, then the orchestrator walk. Never merge or approve.
Finish under 35% context, with the early checkpoint push, PR body with Verified on real data and Phone QA sections. Marker [worker-done p3-prefix-a].
