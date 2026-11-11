# Review r2: PR #1429 (raffle board screens R3b-2)

grep: review-1429-r2

Independent, read-only review. No code changed on the PR branch, nothing approved or merged.
Reviewed 2026-11-10 by a cloud worker (ticket dt_1a78b5450f0f).

| Item | Value |
|------|-------|
| PR | #1429 `claude/raffle-r3b-board-screens` |
| Head reviewed | `b98e8931b14ce9fe5c5d5873ed8605c86798e916` (same as the brief's target) |
| Merge base | `f0f3b291` = current `origin/main`, so the PR is up to date |
| Prior review | `docs/review/review-door-raffle-1439-1429.md` (BLOCK at 27f0356) |
| **Verdict** | **PASS** (minor notes below; the flag `VITE_ENABLE_RAFFLE_V2` must stay OFF until the admin owner calls are settled) |

---

## 1. Prior review items: FIXED or NOT FIXED

| # | Prior finding | Status | Where (at b98e893) | What proves it |
|---|---------------|--------|--------------------|----------------|
| BLOCKER | Parser read `start` / `venue`; prod sends `start_local` / `venue_name` | **FIXED** | `src/lib/raffleBoard.ts:11-18` (`RAFFLE_BOARD_NIGHT_KEYS`), `:62` reads `raw.start_local` only, `:70` reads `raw.venue_name` only; fixtures `src/lib/__tests__/raffleBoardFixtures.ts:6-9` use the real keys | `raffleBoard.test.ts` "fixture keys = real RPC keys" (fixture key set must EQUAL the shared list; `start`/`venue` night is dropped; venue from `venue_name` only). Mutants M1, M2, M3, M7, M8 below all go red. Key list matches the live prod definition (section 2). |
| 2 | `start_local` is UTC with no zone, treated as London | **FIXED** | `raffleBoard.ts:51-53` (`asUtcInstant` appends `Z`), `:63`; `src/pages/Raffles.tsx:59` formats with `timeZone: 'Europe/London'` | `raffleBoard.test.ts` "BST: 23:30 London (22:30Z)..." and "a night starting 00:30 London today counts as today"; `Raffles.board.test.tsx:83`. Mutant M5 (no `Z`): 4 red. |
| 3 | Loading / error looked like "not in the raffle" | **FIXED** | `src/modules/event-page/bento/blocks/RaffleBlock.tsx:454-456` (`elsewhere` needs a loaded, non-empty board); error card `:465`, loading `:472` | `RaffleBlock.board.test.tsx:61` (loading) and `:67` (error, 44px retry) assert no elsewhere heading. |
| 4 | "Winners so far" would show ~766 (`total_winners`) | **FIXED (client side)** | `Raffles.tsx:73`, `:98`: label "Winners listed" = nights carrying a winner; `total_winners` is no longer shown | Fixture shape "prod: total_winners 766, no winner nights" in `raffleBoardFixtures.ts:27` drives both screen tests. What `total_winners` should mean is still an admin call. |
| 5 | Earliest night could be yesterday | **FIXED** | `raffleBoard.ts:94-103` (`k < today` skipped) | `raffleBoard.test.ts` "earliest night is skipped when it is yesterday". Mutant M6: 1 red. |
| 6 | "See who won" always shown | **FIXED** | `RaffleBlock.tsx:457`, `:516` (only when some night has a winner) | `seeWho` column of every `BOARD_SHAPES` row, asserted in `RaffleBlock.board.test.tsx:46`. |
| 7 | "You're in" was sessionStorage only | **FIXED (per device)** | `src/lib/raffleSession.ts:51-61` (localStorage, sessionStorage fallback) | `RaffleBlock.board.test.tsx:78` ("You are in from localStorage, a later visit"). Cross-device still impossible: no anon "am I in the pool" RPC (admin call). |

## 2. Prod contract (read-only)

One `SELECT pg_get_functiondef(...)` on prod `stsdtacfauprzrdebmzg` (plus `provolatile` of the two helper
functions, and one count query). The RPC itself was NOT called (it runs `raffle_sweep_no_shows_v1()`, a write).

Signature `raffle_public_board_v1()` returns jsonb `{pool_count, winners_this_month, total_winners, nights[]}`.
Each night is `jsonb_build_object(...)` with these keys:

| RPC night key | Parser reads (`raffleBoard.ts`) | Match |
|---------------|---------------------------------|-------|
| `occurrence_id` | `raw.occurrence_id` (:60) | yes |
| `public_event_id` | `raw.public_event_id` (:61) | yes |
| `title` | `raw.title` (:68) | yes |
| `start_local` (`to_char(materialised_start_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS')`) | `raw.start_local` (:62) + `Z` | yes |
| `venue_name` | `raw.venue_name` (:70) | yes |
| `winner_first_name` | `raw.winner_first_name` (:71) | yes |

Top level: `pool_count`, `winners_this_month`, `total_winners`, `nights` all read at `:77-83`. **No key the
parser reads is missing from the RPC. No BLOCK.** `RAFFLE_BOARD_NIGHT_KEYS` equals the RPC list exactly.

New detail since r1: the `nights` CTE now also UNIONs nights with a locked/attended win from `today - 7`, so
past winner nights (up to a week back) arrive for "This week's winners". The tile skips them (`k < today`).

Prod shape counts (2026-11-10 ~23:00 London): 148 open nights in the window, 21 public events, max 9 nights per
event, 0 nights with null start, 0 with null `public_event_id`, 0 with null venue, 0 nights dated yesterday,
0 locked/attended win rows (so no winner strip anywhere today), eligible pool 521.

## 3. Mutation (committed raffle tests only)

Run on a worktree of b98e893 with `TZ=Europe/London`, the 4 raffle test files (52 tests; baseline 52 pass).
Each mutant applied with a perl one-liner, tests run, file restored.

| Mutant | Change | Result |
|--------|--------|--------|
| M1 | parser reads `raw.start` instead of `raw.start_local` | **killed**: 27 red |
| M2 | start key allow-list dropped: `str(raw.start_local) ?? str(raw.start)` | **killed**: 1 red |
| M3 | venue allow-list dropped: `str(raw.venue_name) ?? str(raw.venue)` | **killed**: 1 red |
| M4 | missing `start_local` swallowed (defaults to a fixed instant instead of dropping the night) | **killed**: 1 red |
| M5 | no UTC `Z` appended (`asUtcInstant` returns input) | **killed**: 4 red |
| M6 | yesterday's night allowed in `boardForEvent` | **killed**: 1 red |
| M7 | fixtures use `start:` instead of `start_local:` | **killed**: 11 red |
| M8 | `'start'` added to `RAFFLE_BOARD_NIGHT_KEYS` | **killed**: 1 red |

No mutant stayed green. M2/M3/M4/M6/M8 are each killed by a single test, so those tests are load-bearing;
do not delete them.

## 4. Flag `VITE_ENABLE_RAFFLE_V2`

- Only definition: `src/lib/featureFlags.ts:24` `raffleV2: import.meta.env.VITE_ENABLE_RAFFLE_V2 === 'true'` (default OFF).
- Not set in `.env.example` (only `VITE_ENABLE_RAFFLES_PAGE=` empty), no `.env*` with it, not in any
  `.github/workflows/*.yml`, not in `vercel.json`.
- Every reader is a flag check: `RaffleBlock.tsx:534`, `Raffles.tsx:141`, `BentoPage.tsx:193` and `:389`,
  `RaffleEntryDialog.tsx:175`. `useRaffleBoard` is imported only by the two flag-gated components (enforced by
  `useRaffleBoard.test.ts:31`). Flag OFF renders the legacy block / page (`RaffleBlock.board.test.tsx:102`,
  `Raffles.board.test.tsx:102`).
- `/raffles` is additionally behind `flags.rafflesPage` (`AnimatedRoutes.tsx:162`).
- The Vercel project env could NOT be read: `VERCEL_TOKEN` is set, but the sandbox proxy refuses the tunnel to
  api.vercel.com (403). See Not verified.

## 5. Checks at head b98e893 (GitHub check runs, 39)

All completed. Green: `unit (Europe/London, full)`, `unit (America/New_York, tz-sensitive)`,
`unit (Australia/Sydney, tz-sensitive)`, `phone-qa (1)`, `phone-qa (2)`, `phone-qa (3)`, `e2e-smoke`,
`build-smoke`, `integrity`, `bundle-budget`, `contract-check`, `live-db-gate`, `real-data-verified`,
`phone-qa-section`, `bom-check`, `bom-check-routed`, `wallclock-brand`, `notification-check`, `masking-check`,
`dancer-area-isolation`, `route`, `decide`, `open-pr`, `no-preview-reason` (x4).
Skipped (path filters / preview-only): `og-preview`, `og-check`, `synthetic`, `synthetic-preview`, `doc-weight`,
`lighthouse`, `seo-preview`, `seo-check`, `enable`.
Cancelled: one earlier `real-data-verified`, `phone-qa-section` and `decide` run each; each was superseded by a
green run of the same job at the same head. **No red job**, so nothing to compare with main.

## 6. Empty / past / huge board shapes

| Shape | Event tile (`RaffleBlock.tsx`) | /raffles (`Raffles.tsx`) |
|-------|-------------------------------|--------------------------|
| `pool_count` 0, nights present | Tile does not show the pool count; normal in-raffle / elsewhere copy | "0 In the draw" (:96); nights and winners as usual |
| No nights (`nights: []`) | "No raffle nights open right now. Enter and you will be in when one opens." (:475-476); no elsewhere heading (:456), no "See who won" (:516); lever + "Free to enter" still offered | Counters 0 / 0 / 0 (:96-98); "No raffle nights are open right now. Check back soon..." (:104-105) |
| Only past nights for this event (yesterday / winner night up to 7 days back) | Skipped by `boardForEvent` (`raffleBoard.ts:101`) -> "Win a free night elsewhere" if the board has other nights | Past winner nights in this London week list under "This week's winners" (:110); past open nights count in "Nights open" (see N1) |
| 100+ nights (prod: 148) | One linear scan per render, memoised (`RaffleBlock.tsx:441-444`) | Counts only, no night list; week list holds only winner nights of one week. Reply is one jsonb, so the 100-row API cap does not apply. Throwaway test (not committed): 150 nights / 21 events parse to 150, earliest-upcoming picked per event. |

## Findings (ranked; none blocks)

- **N1 (low)**: "Nights open" (`Raffles.tsx:70`) counts every board night without a winner, including
  yesterday's still-open nights (RPC window starts `today - 1`). Prod has 0 such nights right now, so the count is
  correct today; it can over-count by a night's worth the day after. Claim: filter by London date >= today, the
  same rule as `boardForEvent`. Check: a fixture with a yesterday night asserting the counter.
- **N2 (cosmetic, on main, not in this diff)**: `src/lib/featureFlags.ts:22-23` says "nothing reads it yet";
  after this PR five places read `raffleV2`. Update when convenient.
- **Owner / admin calls carried from r1, unchanged** (must be settled BEFORE the flag flips, not before merge):
  `raffle_public_board_v1` runs `raffle_sweep_no_shows_v1()` (a write) on every anonymous read; meaning of
  `total_winners` / `winners_this_month` (counts `raffle_attendance` pairs); no anon "am I in the pool" read.

## Verified
- Head b98e893 = brief target; PR base is current main.
- Prod `raffle_public_board_v1` key list = parser key list (read-only `pg_get_functiondef`).
- Prod shape counts (148 nights, 21 events, max 9/event, 0 null start/event/venue, 0 winner rows, pool 521).
- 4 raffle test files: 52/52 pass at b98e893 (`TZ=Europe/London`).
- 8 mutants, all killed.
- Flag OFF by default; no code path enables v2 without it (grep of src, `.env.example`, workflows, `vercel.json`).
- All 39 GitHub check runs at b98e893 completed with no failure.

## Not verified
- Vercel project env value of `VITE_ENABLE_RAFFLE_V2` (proxy 403 to api.vercel.com): needs owner, or a session
  with Vercel API access.
- That BentoPage's resolved `eventId` equals the board's `public_event_id` on prod (not proven in r1 or here).
- No browser walk at 390x844, no phone; no `raffle_public_board_v1` call (it writes).
- `npx tsc` / full `test:unit` not re-run on the PR head here (CI `unit (Europe/London, full)` is green).
