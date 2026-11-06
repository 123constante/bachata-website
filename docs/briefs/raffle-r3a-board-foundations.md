# Brief: Raffle v2 Website foundations (R3a) -- flag, board mapping, hook, win-state table; no screen changes

Brief-version: 2
Repo: Website. Branch: claude/raffle-r3a-board-foundations. Lane: normal, Sonnet. No database call added. LAST-TIER per READY-QUEUE rank 14 (owner: raffle after organiser and ticketing); this is only the part of R3 that needs nothing applied. The full R3 brief stays at docs/briefs/raffle-r3-board-and-raffles-page.md (items 1-4 and part of 12 are this slice; items 5-11 are the next slice, R3b).

## What main lacks
- No `raffleV2` flag, no board mapping, no win-state table (grep confirms none under src/): src/lib/featureFlags.ts has `rafflesPage` only -- grep: parseRaffleBoard
- `raffle_public_board_v1` is NOT on prod yet (prod read 2026-11-06: 0 rows in pg_proc). Admin R0 is PR #1135 (open, merges clean, awaits proof run, review pack, Approve and apply by the lead). So this slice must parse a reply it has never seen live: code to the JSON keys in the R0 migration on admin branch claude/raffle-r0-schema (`supabase/migrations/99990101000000_raffle_v2_schema_v1.sql`; its keys win over the R3 brief): pool_count, winners_this_month, total_winners, nights[{occurrence_id, public_event_id, title, start, venue, winner_first_name}]. -- grep: parseRaffleBoard

## Files
src/lib/featureFlags.ts (add `raffleV2: import.meta.env.VITE_ENABLE_RAFFLE_V2 === 'true'`, default OFF, nothing else changed), new src/lib/raffleBoard.ts (`parseRaffleBoard`, `boardForEvent`, `thisWeeksWinners`), new src/lib/raffleWinState.ts, new src/hooks/useRaffleBoard.ts (React Query, `rpcLoose`, POST only: the function is not GET-safe), tests under src/lib/__tests__/ and src/hooks/__tests__/. Do NOT edit any component, BentoPage, Raffles.tsx, RaffleEntryDialog, or src/integrations/supabase/types.ts. Leave alone p3/* and onboarding.

## What to build
1. Flag as above, with a comment naming the arc; a flagOff-style test that no existing screen imports the new hook yet.
2. `parseRaffleBoard(json)` pure and total: missing, null, wrong-type or extra keys return the empty board `{poolCount:0, winnersThisMonth:0, totalWinners:0, nights:[]}`, never throw; drops malformed night rows individually. `boardForEvent(board, publicEventId)` -> `{inRaffle, winnerFirstName|null, night|null}`, earliest upcoming matching night wins (reversible default, per R3 open question 1). `thisWeeksWinners(board, now)` uses the London week.
3. `raffleWinState.ts`: one table, one row per state (`contacted`, `locked`, `attended`, `no_show`, `released`, `cancelled`) -> `{showsPublicName}` true only for `locked` and `attended` (D6). R4/R5 extend it.
4. Table tests, RED FIRST where a file exists, otherwise first-run red noted: board shapes {empty, pool only, night open no winner, locked winner, attended winner, released, event not in raffle, null, array, garbage} x {parse result, boardForEvent, thisWeeksWinners}; win state x showsPublicName; 25 nights spanning two London weeks around a DST change.

## Out of scope
All screens, the entry dialog, WhatsApp verify, footer, SEO, flipping any flag. No visible change, so no Design Gate record; no 390x844 walk (say "no screen changed").
Hand-off: Verified / Not verified block; Not verified must state the real RPC reply was never read (not applied).
