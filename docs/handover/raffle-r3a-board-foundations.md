# Handover: raffle R3a board foundations

Done: `raffleV2` flag (default OFF); `src/lib/raffleBoard.ts` (parseRaffleBoard, boardForEvent, thisWeeksWinners); `src/lib/raffleWinState.ts`; `src/hooks/useRaffleBoard.ts`; tests (26) in src/lib/__tests__ and src/hooks/__tests__. No screen changed.
Left: R3b (items 5-11: screens). Notes: `start` accepted as ISO instant or London wall clock; week = London Monday-Sunday; nights with no winner are excluded from thisWeeksWinners.

Verified: 26 new unit tests pass; check:mojibake clean. tsc (tsconfig.app.json, no typegen) 135 errors total, 0 in branch files.
Not verified: the real raffle_public_board_v1 reply was never read (not applied; keys taken from the brief). No 390x844 walk (no screen changed). Full CI job set, pre-ship not run locally. Tests were written together with code, not red-first (new files; first run green).
