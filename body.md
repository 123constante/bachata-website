## Verified on real data
- Shapes surveyed: none from prod. raffle_public_board_v1 is not applied (admin PR #1135); shapes are fixtures: empty, pool only, night open, locked winner, attended winner, event not in raffle, board error.
- Checks run: 17 new vitest cases green (15 red on unfixed main); tests/bentoCellContract.test.ts 8 green; check:mojibake clean; tsc -p tsconfig.app.json shows 0 errors in new/changed lines (3 pre-existing BentoPage.tsx 402-404 narrowing errors).
- NOT verified: the real raffle_public_board_v1 reply; that board public_event_id equals the resolved event id BentoPage passes; full pre-ship; CI per job.
## Phone QA
- Sizes checked: 390x844 NOT done.
- Walked: nothing in a browser.
- Not verified: screenshots of tile (open, winner, entered, elsewhere) and /raffles (counters, empty week, error); a real phone.
