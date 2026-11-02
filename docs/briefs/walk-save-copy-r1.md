# Walk: PR #1278 save toasts at 390x844 (Sonnet, walk worker)

Branch under test: claude/p3-save-copy-drafts-v2 (check it out, npm ci). Your own branch: claude/walk-save-copy-r1. No prod writes: Supabase read-only, and the app must run against MOCKED network (Playwright route mocks), never real prod saves.

Write a Playwright spec (viewport 390x844) that opens the P3 organiser event edit screens with a mocked workspace for each lifecycle: draft, live, paused, and one-date vs several-date series. Use the existing p3 test fixtures (src/modules/organiser/p3 __tests__, claimEdit.matrix.test.tsx) to build the workspace shape. For each, change one field on Details, tap Save, and screenshot the toast; same for Prices and for adding a session (SessionSheet).
Expected toast words: see src/modules/organiser/p3/model/saveWords.ts. Report per picture: toast text, whether it is clipped or hidden behind a sticky bar, tap targets >= 44px, sideways scroll, console errors.
Write docs/walk/walk-save-copy-r1/RESULTS.md with a table (lifecycle x screen -> toast text, pass/fail) and the pictures next to it. Any wording that does not match saveWords.ts, or a toast that cannot be read, is a FINDING. Do not edit src. Push once, last commit subject ends with the worker-done tag. Context cap 30%.
