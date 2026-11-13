# Brief: merge main into PR #1623 (raffle row) and walk it

Repo: 123constante/bachata-website. Branch: claude/profile-dash-organiser-raffle-build (PR #1623).

Problem: #1624 merged and now conflicts with this PR (almost certainly scripts/onboarding-write-doors.json: keep BOTH sets of doors, i.e. the five guest-list doors from main plus organiser_raffle_night_set_v1; keep the file valid JSON and the guard green).

Do:
1. git fetch origin main; merge main into the branch (merge, not rebase); resolve conflicts keeping both sides.
2. npm ci --ignore-scripts if needed; run `node scripts/check-onboarding-write-doors.mjs`, the raffle test files only, and `npx tsc --noEmit -p .`.
3. Walk at 390x844 (Chromium harness with mocked RPC answers is fine; remove the harness before commit): Raffle row (flag on and off), sheet, confirm sheet. No sideways scroll, taps >= 44px, no console errors. Put the result in the PR body Phone QA section (replace "none").
4. Push ONCE. Do not add run-ci. Do not merge or approve.

Flag organiserRaffleLive stays default off.
