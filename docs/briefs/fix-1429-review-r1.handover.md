# Handover: PR #1429 review r1 fix round (done)

Brief: `docs/briefs/fix-1429-review-r1.md` (brief/raffle-r3b-board-screens). Review:
`docs/review/review-door-raffle-1439-1429.md`. Flag `VITE_ENABLE_RAFFLE_V2` untouched (stays OFF).

## Live RPC (read-only `pg_proc` read on prod, 2026-11-10)
`raffle_public_board_v1()` returns jsonb `{pool_count, winners_this_month, total_winners, nights[]}`;
each night is `jsonb_build_object('occurrence_id', 'public_event_id', 'title', 'start_local'
(to_char(materialised_start_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'), no zone),
'venue_name', 'winner_first_name' (locked/attended wins only))`. RPC itself NOT called (it writes: sweep).

## State on arrival
Previous fix round (9695f23, merged main a9438d6) had already fixed review items 1-7 (real keys,
UTC start, loading/error/empty states, "Winners listed" not total_winners, no yesterday night,
"See who won" hidden with no winners, You're in in localStorage).

## This round
- Blocker hardened: parser reads ONLY `start_local` / `venue_name` (the `start` / `venue` fallbacks hid
  wrong-key fixtures). New `RAFFLE_BOARD_NIGHT_KEYS` (one shared list) + contract test: every fixture
  night's key set must equal it; a night with `start`/`venue` is dropped.
- Time-bomb tests fixed: `raffleBoard.test.ts` shape table and "earliest night" called `boardForEvent`
  with the real clock (the 2026-11-10 night would flip to "yesterday" on 11-11). Now pinned to NOW.

## Mutants (all killed, 4 raffle test files)
parser reads old keys: 27 red; fixtures use old keys: 11 red; no UTC `Z`: 4 red; yesterday allowed: 1 red;
`elsewhere = !inRaffle` (loading/error flash): 4 red; "See who won" always: 5 red.

## Checks
- 4 raffle test files: 52 pass. Full `test:unit`: 29474 pass, 15 fail in 4 files
  (eventViewCompat / occurrenceProgram / publicEventPageLineup live-DB contracts, integrityCouldNotRun);
  the same files fail on the tree without this change (env: no DB creds / worktree layout).
- `check:bundle-budget` main vs branch: /app/* 375.2 KB both (0 bytes); /event 378.4 -> 378.5 KB (flag-gated tile).
- `check:mojibake` clean; `check:integrity` 0 issues.
- tsc run on 53fb9ef: 0 errors in branch files (0 errors repo-wide).

## Not verified / owner calls
- No 390x844 browser walk, no phone. CI per job not watched from here (no gh).
- Review item 4 label: "Winners listed" counts nights with a winner; what `total_winners`/`raffle_attendance`
  should mean is an admin call before the flag flips.
- Item 7: no anon RPC says "this person is in the pool"; needs admin RPC.
- Admin: board RPC runs `raffle_sweep_no_shows_v1()` (a write) on every anon read.
- `public_event_id` == BentoPage `eventId` not proven on prod.
