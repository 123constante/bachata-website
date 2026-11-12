# Events build fix round 2 (PR #1584, branch claude/profile-dash-organiser-events-build)
Normal lane, Sonnet, no migration, no new RPC. Continue on the existing branch (git fetch, check it out). Independent re-review of head e29274ed = FIX. Fix ALL, push once, end the last commit subject with the worker-done signal from your ticket. This is the LAST fix round.

## Fix list
1. HIGH, walk and CI evidence missing (fix1 item 9 not done): run the 390x844 walk with `node ~/.claude/bin/preview-deploy.mjs` style preview on the side laptop (see the original brief), screenshots on the PR: Home to Events, night sheet, cancel step, empty, past-only empty, 100+ rows. Put the per-job CI table in the PR body, wait for every job to finish and report red ones. Run `npm run pre-ship`; it failed locally last time: say exactly which stage and whether it also fails on main.
2. MEDIUM, "Every night" in the cancel scope is disabled with a false reason (DashEvents.tsx:43, eventsModel.ts:43 SCOPE.allWhy). The existing command `occurrence.bulk_cancel` via `bulkCancelCommand` (src/modules/organiser/flows/change/Pick.tsx:111) supports it. Wire "Every night" to `bulkCancelCommand(<coming occurrence ids>, reason)` with the reason picker, reusing Pick.tsx's mapping; confirmation names how many nights will be cancelled; add tests (success, error, zero coming nights).
3. LOW, eventsMatrix.test.tsx:18,39: the "100+ rows, paged" row builds only 60 nights. Use at least 50 series (or 3 dates each) and assert the "Show 30 more" button.
4. LOW, DashEvents.tsx:80: when the draft fails to load the confirm button is disabled with no aria-describedby: give the error text at :77 an id and point the button at it.
5. LOW, eventsModel.ts:37 orphan doc comment ("A story told once") above the SCOPE comment: delete; eventsModel.ts:222 `note: null` never set: remove the field.
6. Keep the ASCII-only test green; keep PR body labels exact (Verified on real data / Phone QA blocks); update the handover.

## Done = all fixed, every CI job green (or red proved also red on main), walk shots on the PR.
