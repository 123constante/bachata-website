# Handover: fix-join-outcomes-r1

Done
- `redeemAction()` in `joinModel.ts` is the ONE mapping of a redeem outcome; `applyRedeem` in `JoinPage.tsx` serves both the Join tap and the post-sign-in safety stop. The sign-in path no longer turns every non-done outcome into `not_linked`, so "We've told <inviter>" only shows for `not_linked`.
- "Send my code" is no longer disabled when the email is empty; tapping an empty or malformed email shows the bad-shape error. The reason line under the button stays. OTP request unchanged.
- Test: `join/__tests__/joinOutcomes.table.test.tsx` (outcome table, no false "told", Send tap).

Not done / not verified
- Not run: prod shape survey (counts of open invites), `check:bundle-budget`, join e2e at 390x844, pre-ship, full CI. The new tests were not run red against unfixed code. No page-level test of the post-sign-in path (only the shared mapping).
- Needs: independent Opus review, then the orchestrator walk.
