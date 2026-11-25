# INVENTORY: raffle multi-winner (Website)

Board keys (`raffle_public_board_v1`, prod-confirmed read-only 2026-11-25): nights[] = occurrence_id, public_event_id,
title, start_local, venue_name, winner_first_name, winners_count, seats_left, winners[{first_name}] (+ poster_url, not in the key list).

| Where (before change) | Decides / shows | Text today | Admin state mirrored |
|---|---|---|---|
| src/pages/Raffles.tsx:71 | nights-open counter: `!winnerFirstName` | "Nights open" | night open (no winner) |
| src/pages/Raffles.tsx:74 | open nights list: `!winnerFirstName` | (list) | night open |
| src/pages/Raffles.tsx:75 | winners listed: nights with a winner | "Winners listed" | locked/attended |
| src/pages/Raffles.tsx:115 | week row winner name (one) | "<name> - title" | locked/attended |
| src/components/raffles/RaffleRedesignA.tsx:187 | open nights: `!winnerFirstName` | (cards) | night open |
| src/components/raffles/RaffleRedesignA.tsx:189 | winners listed count | "Winners listed" | locked/attended |
| src/modules/event-page/bento/blocks/RaffleBlock.tsx:457 | strip name from `boardForEvent().winnerFirstName` | "<name> won this night" | locked/attended |
| src/lib/raffleBoard.ts boardForEvent / nightsWithWinner / thisWeeksWinners | winner name / filter | n/a | n/a |

GAPs: RaffleBlock needs no edit (boardForEvent now returns the joined label). thisWeeksWinners still filters on
winnerFirstName (= first winner, so a night with any winner is listed). Coverage: 7 call sites inventoried, 7 handled.
