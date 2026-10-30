# Brief: F4 follow-up -- end-of-onboarding button label for a new organiser with P3 live, plus missing test rows

Repo 123constante/bachata-website. Branch `claude/p3-f4-label-fix`. Normal lane, Sonnet. Max 3 source files plus tests. No migration, no Auth.tsx, flags stay OFF.

## Context
PR #1159 (merged) sends a new organiser whose dancer profile is unfinished to `/app/welcome?returnTo=%2Faccount%2Fp3%2Fstart`. Independent review `docs/review/pr-1159-r1.md` (branch `claude/review-1159-r1`) finding 1: `onboardingEndLabel` in `src/lib/accountRouting.ts` (~L269-275, read by `src/modules/dancer-app/screens/onboarding/OnboardingScreen.tsx` ~L48) knows `/account/o*` ("Next: set up your organiser page") and `/invite*` but not `/account/p3/start`, so it shows "Continue". On main the same person saw the specific label.

## Do
1. Teach `onboardingEndLabel` the P3 start path with the same wording style, e.g. "Next: find or create your page" (match the P3 Welcome screen's own wording; read `src/modules/organiser/p3/onboarding/` for the exact words).
2. Add rows to the table in `src/lib/__tests__/newOrganiserLanding.test.ts` (or a sibling test) asserting the LABEL for every end path, red first (run it against the unfixed code and say it failed).
3. Add the missing rows from review finding 3: areaAllowed false with organiser intent (dancer done, and dancer incomplete), organiser intent with no dancer profile, openRequestCount null and undefined, deletion set. They document today's behaviour; do not change behaviour.
Do not change any landing path. Do not touch Auth.tsx or p3/*.

## Done =
Run the touched tests and every CI step that applies. Open via push only (the bot opens the PR). PR body must contain "## Verified on real data" with lines "Shapes surveyed:", "Checks run:", "NOT verified:", and "## Phone QA". Final commit subject ends with [worker-done f4-label]. Stop at 30% context with a PARTIAL marker.
