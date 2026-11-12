# Dancer slice 1: fix e2e-smoke red at 1b9cd103
Branch claude/profile-dash-dancer-build (PR #1577). Fix ONLY the e2e failures below; no new features.
## Failing (e2e-smoke job, run 43207078340; `gh` is not available to you: use git only)
1. tests/e2e/account-settings.spec.ts:64 and :75 (390x844): `settings-signout` and `delete-type-input` not found within 15s. Likely cause: SwitcherGate.tsx dropped the old `header-account` Link, so the tests (or the app route) no longer reach /account/settings. Make the Account strip button reach /account/settings (or update the test navigation to the new strip control), keep one tap target >=44px.
2. tests/e2e/dancer-app/profile-dash-home.spec.ts:81, three cases: home unclaimed, unclaimed-already-linked, unclaimed-ambiguous (Option A). Find whether the spec targets a Home that was changed/dropped in the rebase vs origin/main (#1576 landed this); restore the behaviour from origin/main, or fix the spec if the strip change legitimately altered it.
## Rules
Compare against origin/main (git show origin/main:<path>). Do not touch review-pack images or handover docs. Run the two specs locally with npx playwright test <file> --project=chromium if the browsers are installed, else say so under Not verified. Run npx tsc --noEmit -p . and npm run check:mojibake. Refresh the PR body head SHA line to the new head. contract-check red is pre-existing on main: ignore.
## Done
Push once, final commit subject ends with the worker-done marker given in your ticket. Handover: Verified / Not verified, the two specs named, results per spec.
