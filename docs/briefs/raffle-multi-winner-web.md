# Brief: raffle nights with more than one winner (Website)

Branch: claude/raffle-multi-winner-web
Size: 5 files, 250 lines
Lane: normal (UI read only, no DB change). Builder: Sonnet.
Design: decided 2026-11-25 under the owner's "I decide product" rule (test: intuitive, easy, fast). No mockup.
Depends on admin migration `raffle_multi_winner_readers_v1` (applied on prod): `raffle_public_board_v1` nights[] now
also carries `winners_count` (int 1..5), `seats_left` (int), `winners` (array of `{first_name}`, locked/attended,
oldest first). `winner_first_name` is unchanged (= the first winner). Before building, confirm the keys on prod with
a read-only `SELECT pg_get_functiondef('public.raffle_public_board_v1'::regproc)`; if absent, stop and say so.

## Step 0: INVENTORY.md first (before building)
Write `docs/briefs/raffle-multi-winner-web-INVENTORY.md`: every place the Website decides a night is open/taken or
shows a night's winner (file:line), today's text in each state, the admin night-row states it mirrors, and the
`raffle_public_board_v1` keys, with GAPs listed. Known: `src/pages/Raffles.tsx:71,74`,
`src/components/raffles/RaffleRedesignA.tsx:187`, `src/modules/event-page/bento/blocks/RaffleBlock.tsx:457`,
`src/lib/raffleBoard.ts` (`boardForEvent`, `nightsWithWinner`). End with a coverage count.

## Product rule
- A night is open while it has a free seat: `seatsLeft > 0`. Missing key (old reply) = today's rule
  (`!winnerFirstName`). A default night (count 1) behaves exactly as today.
- Where the Website names a night's winner, it names every winner: `Ana, Ben` (2), `Ana, Ben and Cleo` (3+ joined
  with commas and a final "and").
- "Winners listed" counter counts winners (people), not nights.
- Flag: `VITE_ENABLE_RAFFLE_MULTI_WINNER`; anything but `'false'` = ON. `'false'` = exactly today's behaviour.

## Checklist (tests assert each)
- [ ] `src/lib/raffleBoard.ts`: parser reads `winners_count`, `seats_left`, `winners` into `winnersCount?`, `seatsLeft?`,
      `winnerNames: string[]` (empty when none; falls back to `[winnerFirstName]` when `winners` absent). Add the three
      keys to `RAFFLE_BOARD_NIGHT_KEYS`. Export `nightIsOpen(n)` and `winnerNamesLabel(n)`. `boardForEvent`'s winner
      name becomes `winnerNamesLabel` (so RaffleBlock needs no edit; verify it renders the label unchanged otherwise).
- [ ] `src/pages/Raffles.tsx`: both filters use `nightIsOpen`; week list row shows `winnerNamesLabel`; counter sums names.
- [ ] `src/components/raffles/RaffleRedesignA.tsx:187`: filter uses `nightIsOpen`.
- [ ] Night with count 3, 1 winner: listed as open AND its winner shows in the week list.
- [ ] Flag `'false'`: every case above behaves as today (one test).
- [ ] Tests in `src/lib/__tests__/raffleBoard.test.ts` + fixtures in `src/lib/__tests__/raffleBoardFixtures.ts`
      (fixtures use only the real keys; the key-list test stays green).

## Rules
- Keep every existing line, counter, button and empty state; nothing else changes.
- Do not merge. PR body: list of states (night open/full/default) and what each page shows.
- Handover: `docs/briefs/raffle-multi-winner-web-handover.md`.
