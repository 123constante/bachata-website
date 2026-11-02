# Handover: fix-join-outcomes-r1 (continuation done)

Done
- `redeemAction()` / `applyRedeem` is the one mapping for Join tap and post-sign-in stop; "told" copy only for `not_linked`.
- "Send my code" never disabled by an empty email; tap shows the bad-shape error.
- Tests: `joinOutcomes.table.test.tsx` + 5 page-level rows in `joinJourney.test.tsx`. Against main's source: 15 red (10 table, 1 Send-tap, 4 page; the page `not_linked` row is green on old code by design). All green on the branch.
- `docs/handover/INVENTORY.md`: 15 outcomes, 15 mapped.
- Gates run: see PR body.

Not verified: full `npm run test:e2e` (exceeded the worker time limit), `pre-ship`, 390x844 visual walk by a human.

Round 2 (review nits, PR #1257)
- Dropped the 27 unrelated dancer-rebuild PNGs from the PR; INVENTORY.md kept (it is this fix's join outcome inventory).
- N1: `applyRedeem` invalidates ORGANISER_HOME_KEY on every `done`; claim-path test row added.
- N2: unit test renamed; page row "empty Send -> join-email-error = badShape, nothing sent". Review mutation D (no error on `empty`) now goes RED (1 failed, 341 passed); reverted.
- N3: `invalid` (dead screen) and thrown-RPC (network stop -> Try again -> done) rows on the post-sign-in path.
- `npx vitest run src/modules/admin-organisers/join`: 7 files, 342 passed.
Not verified: tsc/lint chain, full CI steps, e2e, pre-ship, browser walk.
