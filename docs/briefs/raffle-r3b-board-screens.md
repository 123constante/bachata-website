# Brief: Raffle v2 board screens, tile copy and /raffles winners board (R3b-2)
Brief-version: 2
Branch: claude/raffle-r3b-board-screens
Lane: normal, Sonnet. Website only; no SQL, no p3 or onboarding files, no routing file, no calendar density-exclusion file
Serves: a dancer on an event page or /raffles who sees one raffle, who won this night, and that they are already in
## What main lacks
- The tile has no D16 copy: marquee "Win a free night", the "won this night" winner strip, "You're in" inside the cabinet, a "See who won" link to /raffles -- grep: raffle-see-who-won
- The raffle tile is hidden when get_event_raffle says disabled; with flags.raffleV2 ON it shows on every event page, entry-only "Win a free night elsewhere" when the night is not in the raffle -- grep: raffle-elsewhere-heading
- /raffles still shows per-event cards; it needs the winners board (in the draw, nights open, winners so far, this week's winners, Enter button, retry on error) -- grep: raffles-board-counters
- No footer link to /raffles, shown only when flags.rafflesPage is ON -- grep: footer-raffles-link
- extends: useRaffleBoard, parseRaffleBoard, boardForEvent and thisWeeksWinners already exist (PR #1424); consume them, do not duplicate -- src/hooks/useRaffleBoard.ts
## Files
src/modules/event-page/bento/blocks/RaffleBlock.tsx
src/modules/event-page/bento/blocks/RaffleBlock.css
src/modules/event-page/bento/BentoPage.tsx
src/pages/Raffles.tsx
src/pages/Raffles.css
src/components/layout/GlobalFooter.tsx
src/modules/event-page/bento/blocks/__tests__/RaffleBlock.board.test.tsx (new)
src/pages/__tests__/Raffles.board.test.tsx (new)
## What to build
0. Write INVENTORY.md first: every field, state and option from the admin app, the current Website and the public page, each with file:line. Build only after it exists and report the coverage count (covered / total) at the end.
1. RaffleBlock (flag ON, keep the cabinet and CSS): marquee, winner strip from boardForEvent, persistent You're in from rafflePoolJoinedKey, See who won link, and the "elsewhere" variant when the event is not in the raffle. BentoPage never hides the tile and does not call get_event_raffle when the flag is ON. Flag OFF is unchanged. All copy as HTML entities.
2. /raffles (flag ON): three counters from the board, "This week's winners" list (first name, night, venue), Enter button opening the pool entry dialog, You're in state; empty week says "No winners yet this week. Enter now and you could be next."; board error shows a retry button.
3. GlobalFooter link to /raffles only when flags.rafflesPage is ON; no BottomNav change.
## Tests
Table-driven, red first: board shape (empty, pool only, night open no winner, locked winner, attended winner, event not in raffle, board error) x screen (tile, /raffles); one fixture must give the tile and the page the same pool count and winner name; You're in x (key set, key absent); flag OFF renders as main; rerun tests/bentoCellContract.test.ts.
## Done when
- Table green, and red against unfixed main. Screenshots at 390x844 of tile (open, winner, entered, elsewhere) and /raffles (counters, empty week, error). Waits for R3b-1 (branch claude/raffle-r3b-pool-entry) to be merged first (rafflePoolJoinedKey).
- PR body carries a Verified / Not verified block. Not verified: the real raffle_public_board_v1 reply (admin PR #1135 is not applied) and a real phone.
