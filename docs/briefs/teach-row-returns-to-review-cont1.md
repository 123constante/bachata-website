# Brief: teach-row-returns-to-review continuation 1 (Website, normal, merge conflict only)

Brief-version: 2
Repo: website (123constante/bachata-website). Branch: claude/teach-row-returns-to-review (PR #1422). Lane: normal, Sonnet. No new feature.

## What main lacks
- PR #1422 conflicts with origin/main in two files, so none of its checks run: src/modules/organiser/p3/onboarding/OnboardingFlow.tsx and src/modules/organiser/p3/onboarding/PersonFlow.tsx (found with `git merge-tree origin/main origin/claude/teach-row-returns-to-review`). Main changed both after the branch was cut. -- src/modules/organiser/p3/onboarding/PersonFlow.tsx

## Files
Only the two conflicted files, plus docs/tickets/ handover (new). Keep both sides: main's changes AND this branch's `teachRowPath` / `fromReview` wiring.

## What to build
1. `git fetch origin main` then `git merge origin/main` on the branch. Resolve the two conflicts keeping main's newer behaviour and this branch's teach-row one-step path (see docs/briefs/teach-row-returns-to-review.HANDOVER.md on the branch).
2. Run the branch tests `src/modules/organiser/p3/onboarding/__tests__/teachRowPath.matrix.test.tsx` and all onboarding tests; tsc 0 errors in the two files.
3. Push once. Handover: Verified / Not verified.

## Out of scope
Anything not needed to resolve the conflict.
