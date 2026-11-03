# Brief: fix round 1 for PR #1291 (continuation on the SAME branch claude/fix-join-first-batch)

Lane: normal. Model: Opus. Push ONCE. Do not open a new PR; the push updates #1291. Never add run-ci.
Review: fetch origin claude/review-1291-r1 then git show FETCH_HEAD:docs/reviews/1291-r1.md. Do F1, F2, F3, F4, F7 below, red first (show the new tests fail on the current head 655c43f9, then green). F5 and F6 are the orchestrator's.
- F1 (medium): on a USED link a server answer `used` is final. Keep the page-list (ownPageForName) fallback ONLY when attemptRedeem resolved profile_incomplete (or failed/network). On kind dead + reason used set member=false and show the other_account screen at once. Replace the joinJourney.test.tsx:797-799 cell (it pins the wrong contract: stub the refusal as the profile-gate refusal) and add the reviewer's same-name cell (signed in, preview used, redeem {ok:false, reason:'used'}, own list [{id:'mine-not-the-invites', name: ORG}] -> other-account dead screen, no navigation).
- F3: the used + signed in + hanging page list must not spin forever; the F1 fix removes the wait for that case; keep the 1.5 s give-up for profile_incomplete. Add a test with a never-settling fetchOrganiserHome if the harness allows (make it able to hang).
- F2: make the three e2e assertions exact (tests/e2e/p3-gate-sheet.spec.ts:105,:155 and p3-gate-overlays.spec.ts:93): Part 1 harness href ends &at=review&back=%2Faccount%2Fp3%2Fevents%2Fx; Part 2 and overlays: &back= + encodeURIComponent('/account/p3/events/' + FRIDAY). A missing or foreign back must fail.
- F4: add ['Salsa', null] (prefix mutant) to inviteModel.test.ts:210-218.
- F7: mark F-08 fixed by #1291 in docs/design/p3-acceptance/FIXLIST.md:27, FLIP-READINESS.md:76, AUDIT-gate.md:10,176.
## Rules
git fetch origin main, merge-base check before pushing. Run the unit tests that name these files and npm run check:bundle-budget. Update docs/handover/fix-join-first-batch.md with what changed. Supabase read-only. Never merge or approve.
