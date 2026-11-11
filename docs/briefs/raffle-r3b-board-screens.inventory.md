# INVENTORY: raffle R3b-2 (board screens)

Admin app files are not in this checkout; admin rows come from the lib header
(`src/lib/raffleBoard.ts:1-4`, R0 migration keys). Coverage: 15 / 15 items built or already present.

| # | Item | Source (file:line) | Status |
|---|------|-------------------|--------|
| 1 | board fields pool_count, winners_this_month, total_winners, nights[] | src/lib/raffleBoard.ts:1-4,60-70 | consumed |
| 2 | night fields occurrence_id, public_event_id, title, start, venue, winner_first_name | src/lib/raffleBoard.ts:35-50 | consumed |
| 3 | useRaffleBoard (query, error, refetch) | src/hooks/useRaffleBoard.ts:17 | consumed |
| 4 | boardForEvent (inRaffle / winner) | src/lib/raffleBoard.ts:75 | tile |
| 5 | thisWeeksWinners | src/lib/raffleBoard.ts:100 | /raffles |
| 6 | pool joined key | src/lib/raffleSession.ts:46-53 | tile + page |
| 7 | marquee copy "Win a free night" | RaffleBlock.tsx Cabinet marquee prop | built |
| 8 | winner strip | RaffleBlock.tsx raffle-winner-strip | built |
| 9 | You're in (tile) | RaffleBlock.tsx raffle-youre-in | built |
| 10 | See who won link | RaffleBlock.tsx raffle-see-who-won | built |
| 11 | elsewhere variant | RaffleBlock.tsx raffle-elsewhere-heading | built |
| 12 | tile never hidden / no get_event_raffle when flag ON | BentoPage.tsx:191,366 | built |
| 13 | /raffles counters, week list, empty copy, Enter, You're in, retry | src/pages/Raffles.tsx | built |
| 14 | footer link, flag rafflesPage | src/lib/contactLinks.tsx:115 | already present (no change) |
| 15 | flag OFF unchanged | RaffleBlock.tsx dispatcher, Raffles.tsx dispatcher | tested |
