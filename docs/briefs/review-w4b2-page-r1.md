# Review brief: Website PR #1132 (P3 W4b build 2 slices 2+3: page onboarding screens 1-9, full-path %, Review, go-live stub, Home banner, Settings), independent, read-only

You are NOT the builder. Review branch claude/p3-w4b2-page at its head (069d709 or later) against: docs/design/onboarding-prototype.md (+ .html; the APPROVED spec), docs/briefs/p3-w4b2-page.md and p3-w4b2-page-cont.md, docs/handovers/p3-w4b2-page.md, docs/handovers/p3-w4b2-page-prbody.md (the PR body, which makes the claims), docs/plans/onboarding-arc.md.
Check adversarially, with evidence (file:line):
1. Full-path progress: the % covers the FULL path (page screens + person screens); aria-valuenow equals the shown %; the teach=No and no-page paths; never goes backwards; ends at 100% on Review.
2. Spec fidelity: one question per screen, screens 1-9 present and in order, Review screen shows every answer and each edits back, px only (grep rem), 100dvh not 100vh, no page scroll, taps >= 44px.
3. Save paths: every screen sends exactly one thing and nothing when untouched; RPC argument shapes match the live prod function bodies (read-only SELECT pg_get_functiondef via the Supabase connector); error and save-failed states keep the answer.
4. Go-live: it is a STUB. Confirm it calls no RPC and cannot make a page live. (complete_organiser_onboarding_v1 was applied to prod today and merged in admin #1119, but is NOT to be wired in this PR.)
5. Home banner (GraceBanner) and Settings: nothing outside /account/p3 changes with organiserP3 OFF; the GraceBanner mock added to screens.matrix.test.tsx does not hide a real Home regression.
6. Tests: mutate two behaviours locally (not pushed) and say whether the matrix or geometry tests fail. Is the new e2e wired into test:e2e by name?
7. CI: the bundle budget with flags on is over on dancer-app and the auth/dancer-app chunk ratchets, and main is over the same way. Confirm the branch adds 0 bytes to the dancer-app first load versus main (run npm run check:bundle-budget on both). List which e2e failures are the same on main.
Do not fix anything. Output docs/review/pr-1132-r1.md on branch claude/review-w4b2-page-r1: verdict PASS / FIX FIRST / BLOCK, findings ranked block / should-fix / nit. Do not push to the PR branch. One round. Context under 50%.
