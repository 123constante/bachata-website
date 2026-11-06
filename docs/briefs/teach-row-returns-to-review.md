# Brief: One missing teaching item from Review returns to Review
Brief-version: 2
Branch: claude/teach-row-returns-to-review
Lane: normal, Sonnet. Website only; do not touch supabase/, the DJ path, or any calendar density-exclusion file
Serves: an organiser with "1 thing left" (Levels you teach, Years teaching or Styles you teach) who today is walked through three or four extra screens
## What main lacks
- Review rows teach_levels, teach_years and teach_styles enter the full teach path (Levels, Styles, Years, About), so one missing item costs 3 to 5 screens (walk: docs/walk/onboarding-field-rows, cases 13 to 15) -- grep: teachRowPath
- extends: PersonFlow picks its path with isDjStep(entry) ? djPath : personPath; a teach row entry needs its own one-step path like DJ genres has -- src/modules/organiser/p3/onboarding/personModel.ts
## Files
src/modules/organiser/p3/onboarding/personModel.ts
src/modules/organiser/p3/onboarding/PersonFlow.tsx
src/modules/organiser/p3/onboarding/OnboardingFlow.tsx
src/modules/organiser/p3/onboarding/__tests__/teachRowPath.matrix.test.tsx (new)
## What to build
0. Write INVENTORY.md first: every field, state and option from the admin app, the current Website and the public page, each with file:line. Build only after it exists and report the coverage count (covered / total) at the end.
1. In personModel add `teachRowPath(entry)`: for entry levels, styles or years from Review the path is that step alone; the answer step (teach) and the first-time person path are unchanged.
2. PersonFlow uses it when entered from Review (same trigger as the DJ steps); the step's save then calls onDone, which returns to Review, and the percent bar stays where Review had it.
3. Back from that step returns to Review, never to a teach step the person did not need.
## Tests
Table-driven, red first: entry step (levels, styles, years, teach, name) x teach answer (yes, no, unanswered) x write succeeds or fails: assert the next screen (Review, or the existing next step), the writes sent (one per saved step), and the Back target.
## Done when
- Table green, red against unfixed main; the full first-time person path test still passes untouched.
- Walk at 390x844: Review with only Levels left, save, land on Review at once. Verified / Not verified block in the PR body.
