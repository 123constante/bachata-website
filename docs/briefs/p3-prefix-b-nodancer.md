# p3-prefix-b-nodancer: owners with no dancer profile must not hit a dead end

Lane: normal if the fix is Website-only; STOP and report if it needs a database change (that becomes a careful-lane admin brief). Model: Opus. One PR, branch claude/p3-prefix-b-nodancer from main.

## Owner words
"All four must be fixed before the organiser rebuild goes on." Audit gap 2 (docs/review/p3-real-data-shapes.md, branch claude/review-p3-real-data-shapes): 2 of 7 claimed owners have no dancer row, and likely most brand-new organisers. For them the onboarding and `/account/p3/you/details` screens say "We couldn't load your details", and Retry fails the same way (src/modules/organiser/p3/onboarding/OnboardingFlow.tsx:215-216, PersonFlow.tsx:69-76, wizard/dancerApi.ts:24).
Recorded owner decisions that still hold: admins with no dancer row DO get through the P3 Welcome tap as the server allows; auto-create of the dancer row is a queued separate admin item, NOT part of this PR.

## Do
1. Prove the data source first (read-only prod, counts only): what the dancer read returns for an owner with no dancer row (error or empty?), and who writes the row today.
2. Replace the dead end with a screen that says what the person CAN do: say plainly that they have no dancer profile yet, with a primary action that leads somewhere real (create it, or skip this step if skipping is allowed by the owner decisions in docs/plans/onboarding-arc.md; read it and quote the decision you follow). No retry button that cannot succeed.
3. Table-driven test: owner shape (has dancer row, no row, read error, empty) x screen (Welcome, details, review). Red first on main.

## Standing rules
Zero bytes to /app first load (bundle checks on main and branch; never edit perf-budgets.json or vite.config.ts). Compact copy, explicit px tap targets, no copy pointing at a control that is not on screen, disabled controls say why. One independent review, one fix round, then the orchestrator walk. Never merge or approve.
Finish under 35% context, early checkpoint push, PR body with Verified on real data and Phone QA sections. Marker [worker-done p3-prefix-b].
