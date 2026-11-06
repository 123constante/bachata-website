# Handover dt_da5ee8c9ed7b: teach-row-returns-to-review merge conflict

Done: merged origin/main into the branch; resolved OnboardingFlow.tsx (imports, percentOf, onExit) and PersonFlow.tsx (path) keeping main's DJ-step path and this branch's teachRowPath/fromReview.
Left: nothing for the conflict. PR #1422 checks need to run on the new head.

## Verified
- All 21 onboarding test files pass (1055 tests), including teachRowPath.matrix.test.tsx.
- tsc --noEmit -p . : 0 errors on the merge result.

## Not verified
- Browser walk at 390x844; full CI chain (lint, pre-ship, check:mojibake) not run locally.
