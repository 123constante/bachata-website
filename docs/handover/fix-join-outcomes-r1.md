# Handover: fix-join-outcomes-r1 (continuation done)

Done
- `redeemAction()` / `applyRedeem` is the one mapping for Join tap and post-sign-in stop; "told" copy only for `not_linked`.
- "Send my code" never disabled by an empty email; tap shows the bad-shape error.
- Tests: `joinOutcomes.table.test.tsx` + 5 page-level rows in `joinJourney.test.tsx`. Against main's source: 15 red (10 table, 1 Send-tap, 4 page; the page `not_linked` row is green on old code by design). All green on the branch.
- `docs/handover/INVENTORY.md`: 15 outcomes, 15 mapped.
- Gates run: see PR body.

Not verified: full `npm run test:e2e` (exceeded the worker time limit), `pre-ship`, 390x844 visual walk by a human.
