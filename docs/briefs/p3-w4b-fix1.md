# Brief: fix round 1 for PR #1118 (P3 W4b build 1) on claude/p3-w4b-onboarding

Lane: normal. Builder: Opus (S2 is gate logic). One fix round, then the orchestrator walk. Stopping rule: this round only; a third round needs a stated reason.
Read first: docs/review/pr-1118-r1.md on branch claude/review-1118-r1 (Fable review, PASS with should-fix). Fix the three findings below and nothing else.

## S1 (must fix): real CI red on the PR head
- Failing: `unit (Europe/London, full)` on 32b6a78 (run 40714468151). Cause: src/modules/organiser/__tests__/draftOrganiser.matrix.test.tsx mocks `@/hooks/useAuth` without `ProfileGateContext`, and OnboardingView.tsx:49 now reads it.
- Fix: give that mock `ProfileGateContext: createContext(null)`, as OnboardingSignOut.test.tsx and addPage.matrix.test.tsx already do. Check the three other files that mock `@/hooks/useAuth` and reach the organiser home or switch tree: switch/__tests__/Switch.test.tsx, __tests__/consistency.render.matrix.test.tsx, src/pages/__tests__/AccountOrganiserAction.test.tsx.
- Check: run the FULL `npm run test:unit` and read the "Unhandled Errors" block, not only the failed-tests count. Exit must be 0.

## S2 (fix option a): admin is exempt on the client, as on the server
- Server `_require_complete_dancer_profile_v1` returns early for `is_admin()`. The client gate (profileGate.ts:19-24, useProfileCompletion.ts:28-50) has no admin notion, so an admin with no dancer row is blocked at the tap.
- Fix: carry `isAdmin` on ProfileGateValue (the app already knows admin status where it routes admins). tapGate returns `open` for an admin.
- Test (red first): add a matrix row "admin, no row / incomplete -> opens today's sheet". Run it against the current code first, see it fail, then fix.
- Keep the other seven completeness rows unchanged.

## S3 (record, do not fix here)
- The walk spec is not in any CI job that mounts P3. In the PR body, state plainly: "walk not protected in any CI job" for phone-qa, and that the e2e gate skips it. Do NOT change e2e-smoke.yml env; that is the owner's separate call.

## Definition of done
- Every CI job step of unit runs green locally (full test:unit), per-job table in the PR body updated with real results.
- Zero bytes to /app first load: `npm run check:bundle-budget` main vs branch.
- PR body: a "Fix round 1" section listing S1, S2, S3 with what changed. Do not change the Verified/Not verified claims except to correct them.
- Push an early checkpoint (subject ends [skip preview]), then the final push with a handover at docs/handovers/p3-w4b-onboarding.md (append "fix round 1").

Context cap 35%. Plain git only; never gh api for branch work; never --no-verify; never merge or approve. Supabase read-only.
