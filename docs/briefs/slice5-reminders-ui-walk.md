# Brief: walk + finish Website PR #1774 (organiser slice 5, reminder switch row)

Branch: feat/organiser-slice5-reminders-ui (existing PR #1774, DRAFT, head 9afdb18). Push fixes to this same branch/PR.
Read first (on the branch): docs/briefs/organiser-slice5-reminders-ui-handover.md. UI is behind a flag, flag stays OFF in prod.

Do, in order:
1. Browser walk at 390x844 of the One night sheet reminder row (src/modules/organiser/p3/reminder/NightReminderRow.tsx, wired in screens/DateSheet.tsx). Use a Playwright spec modelled on tests/e2e/organiser-date.spec.ts (mocked RPC routes, flag ON in the test only). Prod shapes (counts only, from the handover): 3369 nights, 154 cancelled, 0 settings rows, 0 log rows (all default ON). Cover: default ON, switched OFF, saving, save error with rollback, disabled with reason, cancelled night (row hidden), past night, no paid orders. Take screenshots into the PR.
2. Fix anything the walk finds in the same PR (tap targets use explicit px, HTML entities not raw unicode punctuation, no copy pointing at a missing control, saving an untouched row sends no command).
3. Add the new spec to the explicit test:e2e list in package.json only if it is stable.
4. Run npm run pre-ship, and every applicable CI step locally; fix red.
5. Fill the PR body "Verified on real data" block incl. an honest Not verified; mark the PR ready (gh pr ready 1774). Do NOT merge.
Stop rules: if the walk needs a signed-in admin session you do not have, use mocked routes only and say so under Not verified.
