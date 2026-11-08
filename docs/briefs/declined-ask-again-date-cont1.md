# Brief: declined ask-again date, continuation 1 (phone-qa shard 1 times out)
Brief-version: 2
Branch: claude/declined-ask-again-date
Lane: normal, Sonnet. CONTINUATION on the existing branch and PR #1489 (head 0ebaf5c6). Change only what the cause below needs.
Serves: the declined organiser request wording ("first day you can ask again"); the owner approved merging it unwalked, but CI job `phone-qa (1)` has timed out at the 15 minute limit three times in a row on this branch (shards 2 and 3 pass in 6 to 9 minutes; the same shard 1 passes on claude/connect-sheet-default and claude/public-ticket-lead).

## What main lacks
- The cause of the shard 1 timeout on this branch is unknown. Merge origin/main into the branch first (it is 3 commits behind), push once, and see whether shard 1 now passes. If you cannot tell from CI, run the shard-1 specs locally with the config in .github/workflows/phone-qa.yml (npx playwright test --config playwright.phone.config.ts --shard=1/3) and find the spec that hangs; if the hang comes from this branch's change (src/modules/organiser/shared/accessRequestModel.ts, onboardingModel.ts, OnboardingFlow.tsx), fix that code, otherwise report which spec hangs and why in the handover and stop -- grep: declinedAskAgainDate
- Handover file docs/handover/declined-ask-again-date-cont1.md stating cause, fix or not, head SHA, and the per-job CI table -- grep: declined-ask-again-date-cont1

## Files
- src/modules/organiser/shared/accessRequestModel.ts
- src/modules/organiser/home/onboarding/onboardingModel.ts
- src/modules/organiser/p3/onboarding/OnboardingFlow.tsx
- docs/handover/declined-ask-again-date-cont1.md (new)

Do not edit .github/workflows. Push once at the end; do not push [skip preview] on the final push. Last commit subject ends with the worker-done marker.
